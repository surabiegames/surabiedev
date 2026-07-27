// server/modules/impor/impor.router.ts — IMPOR BERKAS SUMBER PER BATCH.
//
// KENAPA PER BATCH, BUKAN SATU BERKAS SEKALI KIRIM. Berkas nyata berisi
// ~22.500 baris. Mengirimkannya sebagai satu permintaan berarti: satu
// timeout menghanguskan seluruh pekerjaan, tidak ada yang bisa ditampilkan
// ke pengguna selama menunggu, dan satu baris rusak di tengah membuat
// nasib 22.499 sisanya tidak jelas. Klien memecahnya jadi potongan kecil,
// mengirim berurutan, dan menampilkan kemajuannya.
//
// TIGA SIKAP YANG DIJAGA:
//
// 1. **Idempoten.** Setiap baris dikunci pada pasangan alami (nomor
//    langganan + periode). Mengirim ulang batch yang sama menghasilkan
//    DUPLIKAT — dilaporkan, bukan digandakan. Ini yang membuat "ulangi
//    batch yang gagal" aman dilakukan pengguna tanpa takut dobel.
//
// 2. **Satu baris rusak tidak menjatuhkan batch.** Kegagalan dicatat
//    per baris berikut nomor barisnya di berkas asli, supaya pengguna tahu
//    persis baris mana yang harus diperbaiki.
//
// 3. **Periode yang sudah DIKUNCI ditolak.** Mengimpor pencatatan ke
//    periode yang tagihannya sudah terbit akan menulis ulang dasar
//    penagihan yang sudah sah. Penjaganya di sini, bukan di klien.

import { Hono } from "hono"
import { z } from "zod"
import { prisma } from "@workspace/db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok } from "../../lib/response"
import { BadRequestError, isPrismaKnownError } from "../../lib/errors"
import { periodeToDate } from "../../lib/periode"

export const imporRouter = new Hono()

/// Sengaja tidak besar: satu batch harus selesai jauh di bawah batas
/// timeout proxy mana pun, dan cukup kecil supaya bilah kemajuan bergerak
/// terasa hidup. 500 baris ~ 1-2 detik pada koneksi normal.
const MAKS_BARIS_PER_BATCH = 1000

type StatusBaris = "TERSIMPAN" | "DUPLIKAT" | "DILEWATI" | "GAGAL"

interface HasilBaris {
  /// Nomor baris di BERKAS ASLI (bukan di batch) — supaya pengguna bisa
  /// langsung membukanya di Excel.
  baris: number
  nomorLangganan: string
  status: StatusBaris
  pesan?: string
}

interface HasilBatch {
  diproses: number
  tersimpan: number
  duplikat: number
  dilewati: number
  gagal: number
  /// Hanya baris bermasalah yang dikembalikan. Mengembalikan 1.000 baris
  /// "TERSIMPAN" tiap batch tidak menolong siapa pun dan membengkakkan
  /// respons sampai puluhan MB pada berkas penuh.
  masalah: HasilBaris[]
}

/// ── Penjaga periode ──────────────────────────────────────────────────────
/// Periode dianggap TERKUNCI bila sudah punya tagihan terbit. Impor
/// pencatatan ke periode seperti itu akan menggeser dasar penagihan yang
/// sudah sah, jadi ditolak dengan pesan yang menyebut jalan keluarnya.
async function pastikanPeriodeTerbuka(periode: number): Promise<void> {
  const jumlahTagihan = await prisma.tagihan.count({ where: { periode: periodeToDate(periode) } })
  if (jumlahTagihan > 0) {
    throw new BadRequestError(
      `Periode ${periode} sudah punya ${jumlahTagihan.toLocaleString("id-ID")} tagihan terbit — impor pencatatan ditolak. ` +
        `Buka kembali periodenya lewat Closing bila memang perlu diperbaiki.`
    )
  }
}

// ── 1) PENCATATAN HARIAN (lapdatameter) ──────────────────────────────────
//
// Sumber: setoran harian petugas. Selama aplikasi mobile belum menggantikan
// setoran berkas, inilah pintunya. Baris masuk sebagai LaporanHarianPetugas
// (pra-verifikasi) — BUKAN langsung PembacaanMeter. Kenaikan jadi angka
// resmi hanya terjadi di V3, sama seperti kiriman aplikasi petugas.
const barisPencatatanSchema = z.object({
  baris: z.number().int().min(1),
  nomorLangganan: z.string().trim().min(1).max(20),
  periode: z.number().int().min(190001).max(999912),
  standAwal: z.number().int().min(0),
  standAkhir: z.number().int().min(0),
  pemakaian: z.number().int().min(0).nullable().optional(),
  pemakaianLalu: z.number().int().min(0).nullable().optional(),
  persentase: z.number().int().nullable().optional(),
  kondisi: z.string().trim().max(40).nullable().optional(),
  namaPetugas: z.string().trim().max(120).nullable().optional(),
  tanggalCatat: z.string().trim().max(40).nullable().optional(),
})

const batchPencatatanSchema = z.object({
  periode: z.number().int().min(190001).max(999912),
  baris: z.array(barisPencatatanSchema).min(1).max(MAKS_BARIS_PER_BATCH),
})

/// Kondisi catat di lapdatameter disimpan sebagai KODE di kolom `Kd_kel`
/// (nama kolomnya menyesatkan — isinya bukan kelurahan). Peta ini HARUS
/// sama persis dengan yang dipakai seed (`normalizeKondisiCatat` di
/// prisma/seed/lib/normalize.ts); disalin, bukan diimpor, karena
/// @workspace/server tidak boleh bergantung pada isi folder seed.
///
/// Kode yang TIDAK dikenali dibiarkan kosong, bukan ditebak jadi NORMAL —
/// menebak akan menyembunyikan pembacaan bermasalah dari verifikator,
/// persis orang yang seharusnya melihatnya.
const KONDISI_DARI_KODE: Record<string, string> = {
  "": "NORMAL",
  "-": "NORMAL",
  "2": "DK",
  "3": "MTA",
  "4": "MB",
  "5": "TTB",
  "6": "BMK_BMB",
  "7": "METER_MATI_ADA_AIR",
  "8": "TIDAK_ADA_AIR",
  "9": "LOS_METER",
  AA: "METER_DALAM_AIR",
  D: "DICABUT",
  E: "TERHALANG",
  F: "METER_MUNDUR",
  H: "TIDAK_DIPAKAI",
  N: "STAND_TEMPEL",
  O: "METER_RUSAK",
  P: "REV_PENCATAT",
  Q: "ADA_ANJING",
  R: "RUMAH_KOSONG",
  T: "METER_TERBALIK",
  U: "MUDA_KEMBALI",
  Z: "STAND_KONSUMEN",
}

imporRouter.post(
  "/pencatatan",
  requireRole(...ROLE_GROUPS.STAFF_UP),
  validate("json", batchPencatatanSchema),
  async (c) => {
    const { periode, baris } = c.req.valid("json")
    await pastikanPeriodeTerbuka(periode)

    const requester = getSessionUser(c)
    const pencatatSaya = await prisma.pencatat.findUnique({
      where: { userId: requester.id },
      select: { id: true },
    })

    // Preload sekali per batch — bukan per baris. Dengan 1.000 baris, dua
    // query di sini menggantikan 2.000 round-trip.
    const nomor = baris.map((b) => b.nomorLangganan)
    const [pelanggan, pencatat] = await Promise.all([
      prisma.pelanggan.findMany({
        where: { nomorLangganan: { in: nomor }, deletedAt: null },
        select: { id: true, nomorLangganan: true, nama: true, alamat: true },
      }),
      prisma.pencatat.findMany({ select: { id: true, namaLapangan: true } }),
    ])
    const petaPelanggan = new Map(pelanggan.map((p) => [p.nomorLangganan, p]))
    const petaPencatat = new Map(pencatat.map((p) => [p.namaLapangan.toUpperCase(), p.id]))

    const hasil: HasilBatch = { diproses: baris.length, tersimpan: 0, duplikat: 0, dilewati: 0, gagal: 0, masalah: [] }

    for (const b of baris) {
      const kondisi = b.kondisi ? KONDISI_DARI_KODE[b.kondisi.trim().toUpperCase()] : undefined

      const p = petaPelanggan.get(b.nomorLangganan)
      if (!p) {
        // Nomor tak dikenal BUKAN kegagalan sistem, dan sebabnya ada DUA yang
        // berlawanan arah — membedakannya menentukan apakah operator perlu
        // bertindak atau tidak:
        //
        //   kondisi DICABUT  sambungan yang sudah dicabut sebelum periode ini.
        //                    Petugas masih mendatanginya sekali untuk memastikan
        //                    (stand tidak bergerak), lalu ia lenyap dari sistem.
        //                    TIDAK ADA yang perlu dikerjakan — membuatkan
        //                    pelanggan justru menghidupkan sambungan mati yang
        //                    akan menagih beban tiap bulan tanpa pernah dibayar.
        //
        //   selain itu       lazimnya sambungan baru yang PBPK-nya belum
        //                    diimpor. Ini yang menuntut tindakan.
        //
        // Pesan lama menyebut keduanya "impor PBPK dulu", dan untuk yang
        // dicabut itu menyesatkan — operator akan mencarinya di berkas PBPK
        // yang memang tidak akan pernah memuatnya.
        hasil.dilewati++
        hasil.masalah.push({
          baris: b.baris,
          nomorLangganan: b.nomorLangganan,
          status: "DILEWATI",
          pesan:
            kondisi === "DICABUT"
              ? "Sambungan sudah DICABUT — sengaja tidak dibuatkan pelanggan. Tidak ada yang perlu dikerjakan."
              : "Nomor langganan tidak ada di data pelanggan — impor PBPK-nya lebih dulu bila ini sambungan baru.",
        })
        continue
      }
      const pencatatId =
        (b.namaPetugas ? petaPencatat.get(b.namaPetugas.trim().toUpperCase()) : undefined) ??
        pencatatSaya?.id ??
        null
      const tanggalCatat = b.tanggalCatat ? new Date(b.tanggalCatat) : null

      try {
        await prisma.laporanHarianPetugas.create({
          data: {
            nomorLangganan: b.nomorLangganan,
            pelangganId: p.id,
            namaPelanggan: p.nama,
            alamatPelanggan: p.alamat,
            periode: b.periode,
            standAwal: b.standAwal,
            standAkhir: b.standAkhir,
            // PEMAKAIAN DIAMBIL APA ADANYA dari berkas, bukan dihitung dari
            // selisih stand. lapdatameter & ProgresCater adalah keluaran
            // verifikasi berjenjang Aurora — angkanya sudah matang, dan
            // menghitung ulang berarti menaksir ulang keputusan yang sudah
            // diambil manusia. Selisih stand tetap tersimpan terpisah
            // (standAwal/standAkhir) supaya keduanya bisa dibandingkan.
            //
            // Fallback ke selisih stand HANYA bila berkasnya memang tidak
            // membawa kolom pemakaian.
            pemakaian: b.pemakaian ?? Math.max(0, b.standAkhir - b.standAwal),
            ...(b.pemakaianLalu !== null && b.pemakaianLalu !== undefined
              ? { pemakaianLalu: b.pemakaianLalu }
              : {}),
            // Diambil apa adanya dari berkas — ini angka yang jadi dasar
            // penyaringan anomali di layar verifikasi.
            ...(b.persentase !== null && b.persentase !== undefined
              ? { persentase: b.persentase }
              : {}),
            ...(kondisi ? { kondisi: kondisi as never } : {}),
            ...(pencatatId ? { pencatatId } : {}),
            ...(tanggalCatat && !Number.isNaN(tanggalCatat.getTime()) ? { tanggalCatat } : {}),
          },
        })
        hasil.tersimpan++
      } catch (err) {
        if (isPrismaKnownError(err) && err.code === "P2002") {
          hasil.duplikat++
          hasil.masalah.push({
            baris: b.baris,
            nomorLangganan: b.nomorLangganan,
            status: "DUPLIKAT",
            pesan: "Pencatatan periode ini sudah pernah masuk.",
          })
        } else {
          hasil.gagal++
          hasil.masalah.push({
            baris: b.baris,
            nomorLangganan: b.nomorLangganan,
            status: "GAGAL",
            pesan: (err as Error).message.slice(0, 200),
          })
        }
      }
    }

    return ok(c, hasil)
  }
)

// ── 2) PEMUTUSAN (r-nomor) ───────────────────────────────────────────────
//
// Mencatat FAKTA pemutusan. Status pelanggannya TIDAK diubah di sini —
// sikap yang sama yang dipegang seed sejak awal: mengubah status adalah
// keputusan berkonsekuensi hukum & tagihan, dan harus lewat layar
// pemutusan dengan manusia yang menyetujuinya.
const barisPemutusanSchema = z.object({
  baris: z.number().int().min(1),
  nomorLangganan: z.string().trim().min(1).max(20),
  periode: z.number().int().min(190001).max(999912),
  jenis: z.string().trim().min(1).max(20),
  noSurat: z.string().trim().max(100).nullable().optional(),
  tanggalTutup: z.string().trim().max(40).nullable().optional(),
  tanggalCabut: z.string().trim().max(40).nullable().optional(),
})

const batchPemutusanSchema = z.object({
  baris: z.array(barisPemutusanSchema).min(1).max(MAKS_BARIS_PER_BATCH),
})

/// Kosakata r-nomor. Sengaja HANYA dua yang dikenal — nilai lain ditolak
/// per baris, tidak ditebak. TSM & SPT berbeda akibat hukumnya.
const JENIS_PEMUTUSAN: Record<string, string> = {
  TSM: "TUTUP_SEMENTARA",
  SPT: "TUTUP_SPT",
}

imporRouter.post(
  "/pemutusan",
  requireRole(...ROLE_GROUPS.SUPERVISOR_UP),
  validate("json", batchPemutusanSchema),
  async (c) => {
    const { baris } = c.req.valid("json")
    const nomor = baris.map((b) => b.nomorLangganan)
    const pelanggan = await prisma.pelanggan.findMany({
      where: { nomorLangganan: { in: nomor }, deletedAt: null },
      select: { id: true, nomorLangganan: true },
    })
    const peta = new Map(pelanggan.map((p) => [p.nomorLangganan, p.id]))

    const hasil: HasilBatch = { diproses: baris.length, tersimpan: 0, duplikat: 0, dilewati: 0, gagal: 0, masalah: [] }

    for (const b of baris) {
      const jenis = JENIS_PEMUTUSAN[b.jenis.trim().toUpperCase()]
      if (!jenis) {
        hasil.gagal++
        hasil.masalah.push({
          baris: b.baris,
          nomorLangganan: b.nomorLangganan,
          status: "GAGAL",
          pesan: `Jenis pemutusan "${b.jenis}" tidak dikenal — hanya TSM atau SPT.`,
        })
        continue
      }
      const pelangganId = peta.get(b.nomorLangganan)
      if (!pelangganId) {
        hasil.dilewati++
        hasil.masalah.push({
          baris: b.baris,
          nomorLangganan: b.nomorLangganan,
          status: "DILEWATI",
          pesan: "Nomor langganan tidak ada di data pelanggan.",
        })
        continue
      }

      const tglTutup = b.tanggalTutup ? new Date(b.tanggalTutup) : null
      const tglCabut = b.tanggalCabut ? new Date(b.tanggalCabut) : null
      // Kunci idempoten deterministik. @@unique([pelangganId, periode,
      // nomorSurat]) TIDAK cukup: nomorSurat selalu null untuk jenis SPT,
      // dan Postgres menganggap NULL selalu berbeda dari NULL lain — tanpa
      // sumberKey, mengulang batch akan diam-diam menggandakan baris SPT.
      // Bentuknya mengikuti yang sudah dipakai seed.
      const sumberKey = `RNOMOR:${b.periode}:${b.jenis.trim().toUpperCase()}:${b.nomorLangganan}`
      try {
        await prisma.pemutusan.create({
          data: {
            pelangganId,
            nomorLangganan: b.nomorLangganan,
            periode: b.periode,
            jenis: jenis as never,
            sumberData: "RNOMOR_CSV",
            sumberKey,
            ...(b.noSurat ? { nomorSurat: b.noSurat } : {}),
            ...(tglTutup && !Number.isNaN(tglTutup.getTime()) ? { tanggalTutup: tglTutup } : {}),
            ...(tglCabut && !Number.isNaN(tglCabut.getTime()) ? { tanggalCabut: tglCabut } : {}),
          },
        })
        hasil.tersimpan++
      } catch (err) {
        if (isPrismaKnownError(err) && err.code === "P2002") {
          hasil.duplikat++
          hasil.masalah.push({
            baris: b.baris,
            nomorLangganan: b.nomorLangganan,
            status: "DUPLIKAT",
            pesan: "Pemutusan periode ini sudah tercatat.",
          })
        } else {
          hasil.gagal++
          hasil.masalah.push({
            baris: b.baris,
            nomorLangganan: b.nomorLangganan,
            status: "GAGAL",
            pesan: (err as Error).message.slice(0, 200),
          })
        }
      }
    }

    return ok(c, hasil)
  }
)
