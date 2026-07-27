// prisma/seed/steps/11-daftar-catat.ts — DAFTAR CATAT PER PERIODE +
// DETEKSI CABUTAN, diturunkan progresif bulan demi bulan.
//
// ATURAN YANG DIPEGANG (ditetapkan pemilik data, diverifikasi ke berkas):
//
//   ProgresCater adalah SUMBER KEBENARAN. Januari membentuk populasi awal;
//   bulan berikutnya MEMPERBARUI. Pelanggan yang HILANG antar-bulan berarti
//   DICABUT. Pelanggan yang MUNCUL berarti sambungan baru dari PBPK bulan
//   sebelumnya.
//
//   lapdatameter TIDAK dipakai di sini. Ia laporan pencatatan petugas dan
//   boleh berbeda dari ProgresCater — kalau berbeda, lapdatameter yang
//   salah, karena ProgresCater yang jadi bahan laporan resmi bulanan.
//
// ARITMETIKA DAFTAR KERJA, terverifikasi pada Mei (bulan yang datanya
// lengkap) dan konsisten di seluruh rantai jan→juni:
//
//     Daftar catat(N) = ditagih(N) + dicabut pada N + PBPK(N)
//
//     Mei  : 22.523 + 19 + 11 = 22.553  = isi lapdatameter Mei, persis
//     Juni : 22.515 + 19 +  5 = 22.539
//
// Yang dicabut PADA bulan N TETAP masuk daftar kerja bulan itu — petugas
// tetap mengunjunginya — tapi TIDAK ditagih. Terbukti di Mei: ke-19 nomor
// r-nomor ada di lapdatameter Mei, dan NOL di ProgresCater Mei.
//
// RANTAI POPULASI yang harus tereproduksi:
//     jan 22.549
//     feb 22.549 − 24 + 26 = 22.551
//     mar 22.551 − 27 +  8 = 22.532
//     apr 22.532 − 10 +  5 = 22.527
//     mei 22.527 − 19 + 15 = 22.523
//     jun 22.523 − 19 + 11 = 22.515
//
// JENIS PENCABUTAN TIDAK PERNAH DITEBAK. Kalau nomornya ada di r-nomor,
// jenisnya diambil dari sana lewat mapJenisPemutusanToStatus() di
// lib/status.ts — kamus yang sama yang menerjemahkan dialek ProgresCater,
// supaya "SPT" dan "tupsp" tidak berujung status berbeda.
// Kalau tidak ada di r-nomor mana pun, statusnya diset TUTUP_SEMENTARA —
// pilihan yang PALING TIDAK MERUGIKAN karena masih bisa dibuka kembali,
// sedangkan TUTUP_SPT mengunci sambungan sampai tunggakan lunas — dan
// barisnya DILAPORKAN supaya petugas menentukan jenis sebenarnya.
// TSM dan SPT berbeda akibat hukumnya; menebak di antara keduanya bukan
// wewenang skrip.
//
// PERIODE r-nomor DIAMBIL DARI KOLOMNYA, bukan dari folder tempat berkasnya
// disimpan: pencabutan yang dicatat bulan ini bisa saja terjadi bulan lalu.

import type { Prisma, StatusPelanggan } from "../../../generated/client"
import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { PERIODE_TERSEDIA, readProgresCaterPeriode } from "../lib/csv"
import { normalizeNolg } from "../lib/normalize"
import { statusTerminal } from "../lib/status"

const STEP = "11-daftar-catat"

/// 22 ribu insert satu per satu ke Postgres terkelola makan waktu berjam-jam.
const UKURAN_BATCH = 1000

interface SnapshotBaris {
  ruteKode: string
  pencatat: string
}

interface IsiPeriode {
  thbl: number
  /// nolg -> snapshot rute/petugas dari baris ProgresCater periode itu.
  ditagih: Map<string, SnapshotBaris>
}

function bacaPeriode(folder: string, thbl: number): IsiPeriode {
  const ditagih = new Map<string, SnapshotBaris>()
  for (const row of readProgresCaterPeriode(folder)) {
    const nolg = normalizeNolg(row.nolg)
    if (!nolg) continue
    ditagih.set(nolg, {
      ruteKode: row.rute_kode.trim(),
      pencatat: row.pencatat.trim().toUpperCase(),
    })
  }
  return { thbl, ditagih }
}

export async function seedDaftarCatat(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const periode = PERIODE_TERSEDIA.map((p) => bacaPeriode(p.folder, p.thbl))

  const [pelangganRows, ruteRows, pencatatRows] = await Promise.all([
    prisma.pelanggan.findMany({
      select: { id: true, nomorLangganan: true, noUrutRute: true, status: true },
    }),
    prisma.rute.findMany({ select: { id: true, kode: true } }),
    prisma.pencatat.findMany({ select: { id: true, namaLapangan: true } }),
  ])
  const pelangganCache = new Map(pelangganRows.map((p) => [p.nomorLangganan, p]))
  const ruteCache = new Map(ruteRows.map((r) => [r.kode, r.id]))
  const pencatatCache = new Map(pencatatRows.map((p) => [p.namaLapangan, p.id]))

  /// Sekali keluar, tidak kembali sendiri. Tanpa penanda ini, pelanggan yang
  /// hilang di Februari akan terhitung "dicabut lagi" setiap bulan sesudahnya.
  const sudahDicabut = new Set<string>()
  const perluTinjau: string[] = []
  const ringkasan: string[] = []

  for (let i = 0; i < periode.length; i++) {
    const kini = periode[i]!
    const lalu = i > 0 ? periode[i - 1]! : null

    // Dicabut PADA periode ini: ada bulan lalu, hilang bulan ini. Untuk
    // periode PERTAMA hal ini tidak bisa diketahui — tidak ada pembanding —
    // dan itu memang dibiarkan kosong, bukan ditebak.
    const dicabutKini = new Set<string>()
    if (lalu) {
      for (const nolg of lalu.ditagih.keys()) {
        if (!kini.ditagih.has(nolg) && !sudahDicabut.has(nolg)) dicabutKini.add(nolg)
      }
    }

    const anggota = new Map<string, { sumber: "CARRY_OVER" | "PBPK"; status: "DICATAT" | "DICABUT" | "TIDAK_TERCATAT" }>()
    for (const nolg of kini.ditagih.keys()) anggota.set(nolg, { sumber: "CARRY_OVER", status: "DICATAT" })
    for (const nolg of dicabutKini) anggota.set(nolg, { sumber: "CARRY_OVER", status: "DICABUT" })
    const baris: Prisma.DaftarCatatUncheckedCreateInput[] = []
    for (const [nolg, info] of anggota) {
      const pelanggan = pelangganCache.get(nolg)
      if (!pelanggan) {
        report.warn(STEP, `${nolg} ada di daftar kerja ${kini.thbl} tapi tidak punya baris Pelanggan — dilewati`, {
          key: nolg,
        })
        report.skipped(STEP)
        continue
      }
      // Snapshot rute & petugas dari baris periode itu sendiri bila ada;
      // untuk yang dicabut/PBPK dipakai baris bulan sebelumnya.
      const snap = kini.ditagih.get(nolg) ?? lalu?.ditagih.get(nolg) ?? null
      baris.push({
        periode: kini.thbl,
        pelangganId: pelanggan.id,
        ruteId: snap ? (ruteCache.get(snap.ruteKode) ?? null) : null,
        pencatatId: snap ? (pencatatCache.get(snap.pencatat) ?? null) : null,
        urutan: pelanggan.noUrutRute ?? 0,
        sumber: info.sumber,
        status: info.status,
        selesaiAt: new Date(),
      })
    }

    for (let m = 0; m < baris.length; m += UKURAN_BATCH) {
      const res = await prisma.daftarCatat.createMany({
        data: baris.slice(m, m + UKURAN_BATCH),
        skipDuplicates: true,
      })
      for (let n = 0; n < res.count; n++) report.created(STEP)
    }

    // ── Status pelanggan yang dicabut pada periode ini.
    for (const nolg of dicabutKini) {
      sudahDicabut.add(nolg)
      const pelanggan = pelangganCache.get(nolg)
      if (!pelanggan) continue

      // JENIS pemutusannya TIDAK bisa disimpulkan di sini, dan itu memang
      // seharusnya. ProgresCater cuma memberi tahu sebuah nomor HILANG; yang
      // tahu apakah itu tutup sementara (permintaan pelanggan) atau tutup SPT
      // (karena tunggakan) adalah berkas r-nomor, dan r-nomor masuk lewat
      // layar pemutusan menjelang closing — bukan lewat seed.
      let status: StatusPelanggan
      let alasan: string
      if (statusTerminal(pelanggan.status)) {
        // Sudah terminal dari BUKTI (mis. "tupsp" di ProgresCater lewat
        // step 05). Tebakan tanpa bukti TIDAK BOLEH menurunkannya: sekali
        // jadi TUTUP_SEMENTARA, sambungan bisa diaktifkan lagi tanpa
        // melunasi tunggakan. Dulu justru ini yang terjadi — 38 pelanggan
        // turun dari TUTUP_SPT hanya karena step 11 jalan belakangan.
        continue
      } else {
        // TUTUP_SEMENTARA adalah tebakan yang PALING TIDAK MERUGIKAN —
        // ia masih bisa dibuka kembali, sedangkan TUTUP_SPT mengunci
        // sambungan sampai tunggakannya lunas. Barisnya dilaporkan.
        // TUTUP_SEMENTARA adalah pilihan PALING TIDAK MERUGIKAN: masih bisa
        // dibuka kembali, sedangkan TUTUP_SPT mengunci sambungan sampai
        // tunggakannya lunas.
        status = "TUTUP_SEMENTARA"
        alasan = `hilang dari ProgresCater ${kini.thbl} — jenis pencabutan PERLU DITINJAU lewat layar pemutusan`
        perluTinjau.push(nolg)
      }

      if (pelanggan.status !== status) {
        await prisma.pelanggan.update({ where: { id: pelanggan.id }, data: { status } })
        report.statusChange({ nomorLangganan: nolg, from: pelanggan.status, to: status, reason: alasan })
        pelanggan.status = status
      }
    }

    ringkasan.push(
      `${kini.thbl}: ${anggota.size} = ditagih ${kini.ditagih.size} + dicabut ${dicabutKini.size}`
    )
  }

  // Ringkasan per periode dicetak sebagai satu warning supaya ikut masuk
  // laporan JSON — SeedReport tidak punya kanal "info".
  report.warn(STEP, `Aritmetika daftar catat per periode — ${ringkasan.join(" | ")}`)

  if (perluTinjau.length > 0) {
    report.warn(
      STEP,
      `${perluTinjau.length} pelanggan hilang dari ProgresCater tanpa baris r-nomor — status diset TUTUP_SEMENTARA, jenis pencabutan WAJIB ditinjau petugas: ${perluTinjau
        .slice(0, 20)
        .join(", ")}${perluTinjau.length > 20 ? ` … (+${perluTinjau.length - 20} lagi)` : ""}`
    )
  }
}
