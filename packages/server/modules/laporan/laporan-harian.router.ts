// server/modules/laporan/laporan-harian.router.ts — laporan harian petugas
// (pra-verifikasi), dengan alur verifikasi BERJENJANG V1→V2→V3
// (Supervisor → Manager → Senior Manager; spesifikasi: tabel.md di
// features/dashboard/components/verifikasi/). Laporan BERMUARA ke
// PembacaanMeter resmi hanya di V3: satu transaksi membuat baris
// PembacaanMeter dari data laporan (memakai koreksi V1 bila ada) lalu
// menautkannya balik (`pembacaanId`) — itulah yang membuat laporan
// lapangan naik jadi angka resmi penagihan.
//
// Pola relasi + snapshot (pelangganId opsional + namaPelanggan/alamat teks)
// mengikuti keputusan schema: baris orphan (pelanggan belum ter-import)
// tetap punya identitas yang terbaca di UI, lihat prisma/README.md.
import { Hono } from "hono"
import { z } from "zod"
import { KondisiCatat, KategoriPembacaan } from "@workspace/db"
import { prisma } from "@workspace/db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok, created, paginated } from "../../lib/response"
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError, isPrismaKnownError } from "../../lib/errors"
import { paginationQuerySchema, buildSkipTake, buildMeta, buildOrderBy, sortQuery } from "../../lib/pagination"
import { periodeToDate, dateToPeriode } from "../../lib/periode"
import { simpanBerkas, BerkasTidakValidError } from "../../lib/storage"
import JSZip from "jszip"

export const laporanHarianRouter = new Hono()

/// Status verifikasi TURUNAN (tidak ada kolomnya sendiri): MENUNGGU =
/// belum pernah disentuh verifikator (verifiedAt null); DIVERIFIKASI =
/// isVerified true; DITOLAK = isVerified false TAPI verifiedAt terisi
/// (reject mengisi verifiedAt tanpa menaikkan isVerified). Filter
/// isVerified saja tidak bisa membedakan MENUNGGU dari DITOLAK.
const STATUS_VERIF = ["MENUNGGU", "DIVERIFIKASI", "DITOLAK"] as const
type StatusVerif = (typeof STATUS_VERIF)[number]

const WHERE_STATUS_VERIF: Record<StatusVerif, Record<string, unknown>> = {
  MENUNGGU: { verifiedAt: null },
  DIVERIFIKASI: { isVerified: true },
  DITOLAK: { isVerified: false, verifiedAt: { not: null } },
}

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery(["tanggalCatat", "periode", "standAwal", "standAkhir", "pemakaian", "kondisi", "nomorLangganan", "namaPelanggan", "isVerified", "persentase", "createdAt"]),
  q: z.string().trim().min(1).optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
  isVerified: z.coerce.boolean().optional(),
  statusVerif: z.enum(STATUS_VERIF).optional(),
  pencatatId: z.string().optional(),
  pelangganId: z.string().optional(),
})

laporanHarianRouter.get("/", requireRole(...ROLE_GROUPS.STAFF_UP), validate("query", listQuerySchema), async (c) => {
  const query = c.req.valid("query")
  const { skip, take } = buildSkipTake(query)
  const where = {
    periode: query.periode,
    isVerified: query.isVerified,
    pencatatId: query.pencatatId,
    pelangganId: query.pelangganId,
    ...(query.statusVerif ? WHERE_STATUS_VERIF[query.statusVerif] : {}),
    ...(query.q
      ? { OR: [{ nomorLangganan: { contains: query.q } }, { namaPelanggan: { contains: query.q, mode: "insensitive" as const } }] }
      : {}),
  }
  const [data, total] = await Promise.all([
    prisma.laporanHarianPetugas.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy(query, { tanggalCatat: "desc" }),
      include: {
        // Tabel verifikasi (tabel.md) butuh kolom turunan pelanggan (tarif,
        // rute, W = wilayah seksi, zona), stand resmi dari pembacaan, dan
        // nama verifikator tiap ring — semuanya select sempit, bukan row utuh.
        pelanggan: {
          select: {
            id: true,
            nomorLangganan: true,
            nama: true,
            alamat: true,
            tarifGolongan: { select: { kodeAsli: true } },
            rute: { select: { kode: true } },
            zona: { select: { kode: true, wilayahSeksi: { select: { kode: true } } } },
          },
        },
        pencatat: { select: { id: true, namaLapangan: true } },
        pembacaan: { select: { id: true, standAkhir: true } },
        verifiedBy: { select: { id: true, name: true } },
        verif1By: { select: { id: true, name: true } },
        verif2By: { select: { id: true, name: true } },
        verif3By: { select: { id: true, name: true } },
      },
    }),
    prisma.laporanHarianPetugas.count({ where }),
  ])
  return paginated(c, data, buildMeta(total, query))
})

/// Ringkasan untuk halaman verifikasi: hitungan per status + daftar periode
/// yang benar-benar punya data (untuk dropdown filter). Terdaftar SEBELUM
/// /:id supaya "stats" tidak tertelan param id.
const statsQuerySchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

laporanHarianRouter.get("/stats", requireRole(...ROLE_GROUPS.STAFF_UP), validate("query", statsQuerySchema), async (c) => {
  const { periode } = c.req.valid("query")
  const where = periode ? { periode } : {}
  // Ambang anomali dikonfigurasi lewat Konfigurasi (lihat komentar kolom
  // `persentase` di operasional.prisma); 50% bila belum diset.
  const konf = await prisma.konfigurasi.findUnique({ where: { kunci: "AMBANG_ANOMALI_PERSEN" } })
  const ambangAnomali = Number.parseInt(konf?.nilai ?? "", 10) || 50
  const [total, menunggu, diverifikasi, ditolak, anomali, periodes] = await Promise.all([
    prisma.laporanHarianPetugas.count({ where }),
    prisma.laporanHarianPetugas.count({ where: { ...where, ...WHERE_STATUS_VERIF.MENUNGGU } }),
    prisma.laporanHarianPetugas.count({ where: { ...where, ...WHERE_STATUS_VERIF.DIVERIFIKASI } }),
    prisma.laporanHarianPetugas.count({ where: { ...where, ...WHERE_STATUS_VERIF.DITOLAK } }),
    prisma.laporanHarianPetugas.count({
      where: { ...where, OR: [{ persentase: { gt: ambangAnomali } }, { persentase: { lt: -ambangAnomali } }] },
    }),
    prisma.laporanHarianPetugas.groupBy({ by: ["periode"], orderBy: { periode: "desc" }, take: 24 }),
  ])
  return ok(c, { total, menunggu, diverifikasi, ditolak, anomali, ambangAnomali, periodes: periodes.map((p) => p.periode) })
})

// ── Rute Baca Meter (RBM) petugas — dipakai aplikasi mobile pencatat.
// Terdaftar SEBELUM /:id supaya "rute-saya" tidak tertelan param id.
//
// Alurnya: akun User (token) → Pencatat (jembatan userId) → Rute yang
// ditugaskan (pencatat.ruteId, diatur dari dashboard web lewat
// PATCH /pencatat/:id) → seluruh pelanggan rute itu, dilengkapi stand
// resmi terakhir (prefill stand lalu), pemakaian lalu (dasar peringatan
// deviasi), dan status sudah/belum dicatat pada periode berjalan. Respons
// ini sekaligus "paket unduhan rute" yang di-cache aplikasi untuk kerja
// offline di lapangan.
const ruteSayaQuerySchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

laporanHarianRouter.get("/rute-saya", requireRole(...ROLE_GROUPS.STAFF_UP), validate("query", ruteSayaQuerySchema), async (c) => {
  const user = getSessionUser(c)
  // Default periode = bulan kalender berjalan: pencatatan lapangan merekam
  // bulan berjalan (beda dari dashboard yang memakai periode terakhir
  // ber-data — closing bulanan boleh tertinggal, rute tidak).
  const periode = c.req.valid("query").periode ?? dateToPeriode(new Date())

  const pencatat = await prisma.pencatat.findUnique({
    where: { userId: user.id },
    include: {
      // Rute yang dipetakan admin (many-to-many BERURUT lewat PenugasanRute,
      // halaman Pemetaan Rute). Satu pencatat bisa memegang banyak rute;
      // urutannya menentukan urutan kerja di lapangan.
      penugasanRute: {
        orderBy: { urutan: "asc" },
        include: { rute: { select: { id: true, kode: true, seksiCater: { select: { kode: true, nama: true } } } } },
      },
    },
  })
  if (!pencatat || !pencatat.isAktif) {
    throw new BadRequestError(
      "Akun Anda belum tertaut ke data Pencatat aktif — minta admin menautkannya di menu Pencatat dashboard web.",
    )
  }

  // Jumlah laporan yang DIA catat pada periode ini (lintas rute — pindah
  // rute di tengah bulan tidak menghilangkan hasil kerjanya) — angka
  // "hasil kerja saya" di beranda aplikasi.
  const dicatatSaya = await prisma.laporanHarianPetugas.count({
    where: { periode, pencatatId: pencatat.id },
  })

  // Belum ditugaskan rute = bukan error: rute dipetakan admin di halaman
  // Pemetaan Rute dashboard (PenugasanRute). Aplikasi menampilkan keadaan
  // "belum ditugaskan — hubungi admin", bukan layar gagal.
  const penugasan = pencatat.penugasanRute
  if (penugasan.length === 0) {
    return ok(c, {
      pencatat: { id: pencatat.id, namaLapangan: pencatat.namaLapangan },
      rute: null,
      rutes: [],
      periode,
      target: 0,
      terbaca: 0,
      dicatatSaya,
      pelanggan: [],
    })
  }

  const ruteIds = penugasan.map((pg) => pg.ruteId)
  // Peta rute → { kode, seksiCater, urutan kerja } untuk memberi label per
  // baris pelanggan dan mengurutkan lintas rute.
  const ruteInfo = new Map(penugasan.map((pg) => [pg.ruteId, { kode: pg.rute.kode, seksiCater: pg.rute.seksiCater, urutan: pg.urutan }]))

  const pelanggan = await prisma.pelanggan.findMany({
    // CABUT_PERMANEN tidak dikunjungi lagi; status lain (DISEGEL,
    // TUTUP_SEMENTARA) tetap masuk buku rute — petugas tetap lewat dan
    // status ditampilkan di baris. Lintas SEMUA rute yang ditugaskan.
    where: { ruteId: { in: ruteIds }, deletedAt: null, status: { not: "CABUT_PERMANEN" } },
    // Urutan kunjungan DALAM rute (noUrutRute); urutan ANTAR rute diterapkan
    // di bawah mengikuti PenugasanRute.urutan.
    orderBy: [{ noUrutRute: { sort: "asc", nulls: "last" } }, { nomorLangganan: "asc" }],
    select: {
      id: true,
      nomorLangganan: true,
      nama: true,
      alamat: true,
      rt: true,
      rw: true,
      status: true,
      notelp: true,
      geoLat: true,
      geoLong: true,
      noUrutRute: true,
      ruteId: true,
      tarifGolongan: { select: { kodeAsli: true } },
      meter: { where: { isAktif: true }, take: 1, select: { id: true, nomorMeter: true } },
    },
  })
  // Urutkan lintas rute: rute sesuai urutan kerja, lalu noUrutRute dalam rute.
  pelanggan.sort((a, b) => {
    const ua = ruteInfo.get(a.ruteId!)?.urutan ?? 0
    const ub = ruteInfo.get(b.ruteId!)?.urutan ?? 0
    if (ua !== ub) return ua - ub
    const na = a.noUrutRute ?? Number.MAX_SAFE_INTEGER
    const nb = b.noUrutRute ?? Number.MAX_SAFE_INTEGER
    if (na !== nb) return na - nb
    return a.nomorLangganan.localeCompare(b.nomorLangganan)
  })

  const meterIds = pelanggan.flatMap((p) => p.meter.map((m) => m.id))
  // Jendela riwayat: 6 bulan ke belakang dari periode berjalan — cukup untuk
  // memilih 3 pembacaan resmi terakhir per meter (pola period1..period3
  // Aurora: bahan jawaban petugas saat pelanggan menanyakan riwayatnya),
  // tanpa menyeret seluruh histori bertahun-tahun.
  const batasRiwayat = periodeToDate(periode)
  batasRiwayat.setMonth(batasRiwayat.getMonth() - 6)
  const pelangganIds = pelanggan.map((p) => p.id)
  const [bacaanResmi, laporanPeriode, tagihanTerakhir] = await Promise.all([
    meterIds.length
      ? prisma.pembacaanMeter.findMany({
          where: { meterId: { in: meterIds }, periode: { gte: batasRiwayat } },
          orderBy: [{ meterId: "asc" }, { periode: "desc" }],
          select: { meterId: true, periode: true, standLalu: true, standAkhir: true, pemakaianM3: true },
        })
      : Promise.resolve([]),
    prisma.laporanHarianPetugas.findMany({
      where: { periode, nomorLangganan: { in: pelanggan.map((p) => p.nomorLangganan) } },
      select: { id: true, nomorLangganan: true, standAkhir: true, kondisi: true, tanggalCatat: true },
    }),
    // Komponen tetap tagihan (beban + admin) dari tagihan RESMI terakhir tiap
    // pelanggan — bahan estimasi total di layar catat (air progresif + beban
    // + admin, pola calculateTagihan Aurora). Per-tagihan, bukan per-golongan
    // (sumber CSV beabeban/beaadmin), jadi diambil dari riwayat pelanggan itu
    // sendiri; pelanggan tanpa tagihan sebelumnya → null (estimasi jatuh ke
    // air-saja). Terurut periode desc, elemen pertama = paling baru.
    pelangganIds.length
      ? prisma.tagihan.findMany({
          where: { pelangganId: { in: pelangganIds } },
          orderBy: [{ pelangganId: "asc" }, { periode: "desc" }],
          select: { pelangganId: true, beaBeban: true, beaAdmin: true },
        })
      : Promise.resolve([]),
  ])
  // Kelompokkan per meter; baris sudah terurut periode desc, jadi elemen
  // pertama = pembacaan resmi terakhir (prefill stand lalu).
  const riwayatPerMeter = new Map<string, typeof bacaanResmi>()
  for (const b of bacaanResmi) {
    const daftar = riwayatPerMeter.get(b.meterId) ?? []
    if (daftar.length < 3) riwayatPerMeter.set(b.meterId, [...daftar, b])
  }
  const laporanPerNomor = new Map(laporanPeriode.map((l) => [l.nomorLangganan, l]))
  // Ambil hanya tagihan terbaru per pelanggan (baris terurut periode desc).
  const biayaTetapPerPelanggan = new Map<string, { beaBeban: number; beaAdmin: number }>()
  for (const t of tagihanTerakhir) {
    if (!biayaTetapPerPelanggan.has(t.pelangganId)) {
      biayaTetapPerPelanggan.set(t.pelangganId, { beaBeban: t.beaBeban, beaAdmin: t.beaAdmin })
    }
  }

  // Nomor urut fallback dihitung PER RUTE, bukan lintas seluruh beban kerja:
  // pelanggan tanpa noUrutRute harus bernomor 1..n di dalam rutenya sendiri
  // (petugas membaca "urutan 1 dari rute R-042"), bukan posisinya di daftar
  // datar gabungan semua rute. `pelanggan` sudah terurut (rute, lalu
  // noUrutRute), jadi baris tiap rute kontigu — cukup hitung berjalan per rute.
  const urutPerRute = new Map<string, number>()
  const rows = pelanggan.map((p) => {
    const meter = p.meter[0] ?? null
    const riwayat = (meter ? riwayatPerMeter.get(meter.id) : undefined) ?? []
    const bacaan = riwayat[0]
    const laporan = laporanPerNomor.get(p.nomorLangganan)
    const biayaTetap = biayaTetapPerPelanggan.get(p.id) ?? null
    const seqRute = (urutPerRute.get(p.ruteId ?? "") ?? 0) + 1
    urutPerRute.set(p.ruteId ?? "", seqRute)
    return {
      pelangganId: p.id,
      nomorLangganan: p.nomorLangganan,
      nama: p.nama,
      alamat: p.alamat,
      rt: p.rt,
      rw: p.rw,
      status: p.status,
      notelp: p.notelp,
      geoLat: p.geoLat,
      geoLong: p.geoLong,
      golonganTarif: p.tarifGolongan?.kodeAsli ?? null,
      /// Rute asal baris — mobile mengelompokkan daftar per rute sesuai
      /// urutan kerja.
      ruteId: p.ruteId,
      ruteKode: ruteInfo.get(p.ruteId!)?.kode ?? null,
      /// Urutan kunjungan RBM; fallback ke posisi DALAM RUTE (bukan lintas
      /// semua rute) untuk data lama yang belum punya noUrutRute.
      urutan: p.noUrutRute ?? seqRute,
      noUrutRute: p.noUrutRute,
      meterId: meter?.id ?? null,
      nomorMeter: meter?.nomorMeter ?? null,
      standLalu: bacaan?.standAkhir ?? null,
      pemakaianLalu: bacaan?.pemakaianM3 ?? null,
      /// Komponen tetap tagihan terakhir (null bila pelanggan belum pernah
      /// ditagih) — mobile menambahkannya ke estimasi uang air progresif.
      beaBeban: biayaTetap?.beaBeban ?? null,
      beaAdmin: biayaTetap?.beaAdmin ?? null,
      /// Maks. 3 pembacaan resmi terakhir, terbaru dulu (period1..period3
      /// di Aurora) — di-cache aplikasi untuk ditunjukkan ke pelanggan
      /// saat ada sengketa tagihan di lapangan.
      riwayat: riwayat.map((r) => ({
        periode: dateToPeriode(r.periode),
        standLalu: r.standLalu,
        standAkhir: r.standAkhir,
        pemakaianM3: r.pemakaianM3,
      })),
      sudahDicatat: !!laporan,
      laporan: laporan
        ? { id: laporan.id, standAkhir: laporan.standAkhir, kondisi: laporan.kondisi, tanggalCatat: laporan.tanggalCatat }
        : null,
    }
  })

  // Ringkasan per rute (urut kerja) — target = jumlah pelanggan rute,
  // terbaca = yang sudah dicatat periode ini. Header aplikasi memakai ini.
  const rutes = penugasan.map((pg) => {
    const barisRute = rows.filter((r) => r.ruteId === pg.ruteId)
    return {
      id: pg.ruteId,
      kode: pg.rute.kode,
      seksiCater: pg.rute.seksiCater,
      urutan: pg.urutan,
      target: barisRute.length,
      terbaca: barisRute.filter((r) => r.sudahDicatat).length,
    }
  })

  return ok(c, {
    pencatat: { id: pencatat.id, namaLapangan: pencatat.namaLapangan },
    // `rute` (tunggal, rute pertama) dipertahankan untuk kompatibilitas
    // aplikasi versi lama; `rutes` adalah daftar penuh yang dibaca versi baru.
    rute: rutes[0] ? { id: rutes[0].id, kode: rutes[0].kode, seksiCater: rutes[0].seksiCater } : null,
    rutes,
    periode,
    target: rows.length,
    terbaca: rows.filter((r) => r.sudahDicatat).length,
    dicatatSaya,
    pelanggan: rows,
  })
})

// ── Upload berkas bukti petugas (foto stand / segel / rumah, plus video
// pembacaan). multipart/form-data karena membawa berkas; validasi isi
// (magic bytes) + penamaan deterministik terjadi di simpanBerkas(). Client
// memanggil ini per berkas, lalu menyertakan URL-nya di POST / atau /batch
// (fotoStandUrl/fotoSegelUrl/fotoRumahUrl/videoUrl). Field form tetap
// bernama `foto` juga untuk video — kontrak satu pintu, jangan dipecah.
const JENIS_FOTO = ["stand", "segel", "rumah", "video"] as const

laporanHarianRouter.post("/foto", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const form = await c.req.formData()
  const parsed = z
    .object({
      nomorLangganan: z.string().trim().regex(/^\d{11}$/, "Nomor langganan harus 11 digit angka"),
      periode: z.coerce.number().int().min(190001).max(999912),
      jenis: z.enum(JENIS_FOTO),
    })
    .parse({
      nomorLangganan: form.get("nomorLangganan"),
      periode: form.get("periode"),
      jenis: form.get("jenis"),
    })

  const foto = form.get("foto")
  if (!(foto instanceof File)) throw new BadRequestError("Foto wajib dilampirkan sebagai field `foto`.")

  try {
    const hasil = await simpanBerkas(foto, {
      prefix: "laporan-harian",
      namaBerkas: `${parsed.periode}_${parsed.jenis}_${parsed.nomorLangganan}`,
      subFolder: `${parsed.periode}`,
      jenisMedia: parsed.jenis === "video" ? "video" : "foto",
    })
    return created(c, { jenis: parsed.jenis, url: hasil.url, publicId: hasil.publicId })
  } catch (err) {
    if (err instanceof BerkasTidakValidError) throw new BadRequestError(err.message)
    throw err
  }
})

laporanHarianRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const row = await prisma.laporanHarianPetugas.findUnique({
    where: { id: c.req.param("id") },
    include: {
      pelanggan: true,
      pencatat: true,
      pembacaan: true,
      meterVerif: { select: { id: true, nomorMeter: true } },
      verifiedBy: { select: { id: true, name: true } },
      verif1By: { select: { id: true, name: true } },
      verif2By: { select: { id: true, name: true } },
      verif3By: { select: { id: true, name: true } },
    },
  })
  if (!row) throw new NotFoundError("LaporanHarianPetugas")
  return ok(c, row)
})

const urlFotoSchema = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v.startsWith("https://") || v.startsWith("http://") || v.startsWith("/"), {
    message: "URL foto harus absolut (http/https) atau path relatif server",
  })

const createSchema = z.object({
  nomorLangganan: z.string().trim().min(1).max(20),
  pelangganId: z.string().min(1).nullable().optional(),
  namaPelanggan: z.string().trim().max(200).nullable().optional(),
  alamatPelanggan: z.string().trim().max(500).nullable().optional(),
  periode: z.coerce.number().int().min(190001).max(999912),
  standAwal: z.coerce.number().int().min(0),
  standAkhir: z.coerce.number().int().min(0),
  pemakaianLalu: z.coerce.number().int().min(0).nullable().optional(),
  persentase: z.coerce.number().int().nullable().optional(),
  kondisi: z.enum(KondisiCatat).optional(),
  kategori: z.enum(KategoriPembacaan).optional(),
  nomorMeter: z.string().trim().max(50).nullable().optional(),
  pencatatId: z.string().min(1).nullable().optional(),
  tanggalCatat: z.coerce.date().nullable().optional(),
  /// Tiga foto bukti dari aplikasi petugas: stand meter, segel, rumah.
  /// Diterima juga path relatif ("/api/public/berkas/…") — bentuk URL yang
  /// dikembalikan simpanBerkas() pada fallback disk lokal saat development;
  /// z.string().url() murni akan menolaknya dan mematikan alur foto di dev.
  fotoStandUrl: urlFotoSchema.nullable().optional(),
  fotoSegelUrl: urlFotoSchema.nullable().optional(),
  fotoRumahUrl: urlFotoSchema.nullable().optional(),
  /// Video pembacaan (opsional) — unggah dulu lewat POST /foto jenis=video.
  videoUrl: urlFotoSchema.nullable().optional(),
  /// Posisi GPS petugas saat menyimpan catatan (pola bill_longlatcatat
  /// Aurora). jarakMeter TIDAK diterima dari client — dihitung server dari
  /// pasangan ini terhadap koordinat pelanggan.
  latCatat: z.coerce.number().min(-90).max(90).nullable().optional(),
  longCatat: z.coerce.number().min(-180).max(180).nullable().optional(),
  /// Kondisi segel yang ditemukan di lapangan (bill_issegel Aurora).
  isSegel: z.boolean().nullable().optional(),
  /// Usulan koreksi data pelanggan dari lapangan (bill_perubahan Aurora).
  usulanPerubahan: z.string().trim().max(1000).nullable().optional(),
  /// Usulan nomor urut kunjungan baru (bill_reqnourutbaru Aurora) — admin
  /// menerapkannya ke Pelanggan.noUrutRute saat closing.
  usulanNoUrut: z.coerce.number().int().min(1).nullable().optional(),
  /// Pembaruan No. HP pelanggan dari lapangan (bill_nohp Aurora) —
  /// diterapkan langsung ke Pelanggan.notelp bila laporan tertaut
  /// pelanggan; string kosong/null diabaikan (bukan perintah menghapus).
  notelpBaru: z.string().trim().max(30).nullable().optional(),
})

type CreateLaporanInput = z.infer<typeof createSchema>

/// Jarak (meter, bulat) posisi catat petugas ke titik pelanggan — bukti
/// kehadiran di lokasi (marginMeter di Aurora). Prioritas kolom PostGIS
/// `koordinat`; fallback geoLat/geoLong legacy HANYA bila masuk akal sebagai
/// koordinat (placeholder Excel-serial ~46168 di data lama harus tersaring).
/// $queryRawUnsafe + parameter posisi — JANGAN Prisma.raw (server/README.md).
async function hitungJarakMeter(pelangganId: string, latCatat: number, longCatat: number): Promise<number | null> {
  const hasil = await prisma.$queryRawUnsafe<{ jarak: number | null }[]>(
    `SELECT ST_DistanceSphere(
        COALESCE(
          koordinat,
          CASE WHEN "geoLat" BETWEEN -90 AND 90 AND "geoLong" BETWEEN -180 AND 180
               THEN ST_SetSRID(ST_MakePoint("geoLong", "geoLat"), 4326) END
        ),
        ST_SetSRID(ST_MakePoint($1, $2), 4326)
     ) AS jarak
     FROM pelanggan WHERE id = $3`,
    longCatat,
    latCatat,
    pelangganId,
  )
  const jarak = hasil[0]?.jarak
  return jarak == null ? null : Math.round(jarak)
}

/// Inti penyimpanan satu laporan — dipakai POST / dan POST /batch supaya
/// aturan bisnisnya (pemakaian dihitung server, snapshot identitas, jarak
/// GPS) tidak bercabang dua.
async function simpanLaporan(input: CreateLaporanInput, pencatatIdDefault: string | null) {
  // notelpBaru bukan kolom laporan — dipisah sebelum spread ke create().
  const { notelpBaru, ...body } = input
  // pemakaian dihitung server dari stand, bukan diterima dari client.
  const pemakaian = Math.max(0, body.standAkhir - body.standAwal)

  // pencatatId tidak dikirim client mobile — diisi dari akun token (jembatan
  // Pencatat.userId), supaya laporan lapangan selalu tahu siapa pencatatnya
  // tanpa memercayai client menyebut identitasnya sendiri.
  const pencatatId = body.pencatatId === undefined ? pencatatIdDefault : body.pencatatId

  // Snapshot identitas (nama/alamat) WAJIB terisi selama pelanggannya
  // dikenal — baris harus tetap terbaca di UI walau relasi pelanggan
  // kelak terputus (pola relasi+snapshot, lihat prisma/README.md).
  let { namaPelanggan, alamatPelanggan } = body
  if (body.pelangganId && (!namaPelanggan || !alamatPelanggan)) {
    const p = await prisma.pelanggan.findUnique({
      where: { id: body.pelangganId },
      select: { nama: true, alamat: true },
    })
    namaPelanggan ??= p?.nama ?? null
    alamatPelanggan ??= p?.alamat ?? null
  }

  const jarakMeter =
    body.pelangganId && body.latCatat != null && body.longCatat != null
      ? await hitungJarakMeter(body.pelangganId, body.latCatat, body.longCatat)
      : null

  const row = await prisma.laporanHarianPetugas.create({
    data: { ...body, pencatatId, namaPelanggan, alamatPelanggan, pemakaian, jarakMeter, tanggalUpload: new Date() },
  })

  // Pembaruan kontak dari lapangan diterapkan SETELAH laporan tersimpan —
  // gagalnya update notelp (mis. pelanggan terhapus) tidak boleh
  // menggagalkan laporan yang sudah susah payah dicatat.
  if (notelpBaru && body.pelangganId) {
    try {
      await prisma.pelanggan.update({ where: { id: body.pelangganId }, data: { notelp: notelpBaru } })
    } catch {
      // baris pelanggan hilang/berubah — laporan tetap sah tanpa update HP.
    }
  }
  return row
}

laporanHarianRouter.post("/", requireRole(...ROLE_GROUPS.STAFF_UP), validate("json", createSchema), async (c) => {
  const body = c.req.valid("json")
  const requester = getSessionUser(c)
  let pencatatIdDefault: string | null = null
  if (body.pencatatId === undefined) {
    const pencatat = await prisma.pencatat.findUnique({ where: { userId: requester.id }, select: { id: true } })
    pencatatIdDefault = pencatat?.id ?? null
  }
  const row = await simpanLaporan(body, pencatatIdDefault)
  return created(c, row)
})

// ── Sinkronisasi batch dari aplikasi petugas (pola dev_store_data.php
// Aurora): petugas bekerja OFFLINE seharian lalu mengunggah borongan.
// Kontraknya per-record, BUKAN semua-atau-gagal: satu baris bermasalah
// tidak boleh membatalkan ratusan baris lain yang sudah susah payah
// dicatat di lapangan. DUPLIKAT (P2002 pada [nomorLangganan, periode])
// diperlakukan sebagai sukses-idempoten — terjadi saat unggah ulang karena
// sinyal putus sebelum respons pertama sampai; client cukup menandai baris
// itu "sudah terunggah".
const batchSchema = z.object({
  laporan: z.array(createSchema).min(1).max(300),
})

laporanHarianRouter.post("/batch", requireRole(...ROLE_GROUPS.STAFF_UP), validate("json", batchSchema), async (c) => {
  const { laporan } = c.req.valid("json")
  const requester = getSessionUser(c)
  const pencatat = await prisma.pencatat.findUnique({ where: { userId: requester.id }, select: { id: true } })
  const pencatatIdDefault = pencatat?.id ?? null

  const hasil: {
    index: number
    nomorLangganan: string
    periode: number
    status: "TERSIMPAN" | "DUPLIKAT" | "GAGAL"
    id?: string
    pesan?: string
  }[] = []

  // Sequential, bukan Promise.all — batch 300 baris paralel akan menghabiskan
  // pool koneksi dan urutan hasil harus stabil mengikuti urutan kiriman.
  for (const [index, item] of laporan.entries()) {
    const identitas = { index, nomorLangganan: item.nomorLangganan, periode: item.periode }
    try {
      const row = await simpanLaporan(item, pencatatIdDefault)
      hasil.push({ ...identitas, status: "TERSIMPAN", id: row.id })
    } catch (err) {
      if (isPrismaKnownError(err) && err.code === "P2002") {
        hasil.push({ ...identitas, status: "DUPLIKAT", pesan: "Laporan periode ini sudah pernah terunggah." })
      } else if (isPrismaKnownError(err) && err.code === "P2003") {
        hasil.push({ ...identitas, status: "GAGAL", pesan: "Referensi pelanggan/pencatat tidak valid." })
      } else {
        // Pesan internal tidak diteruskan — bisa memuat detail infrastruktur.
        console.error("[laporan-harian/batch] baris gagal:", identitas, err)
        hasil.push({ ...identitas, status: "GAGAL", pesan: "Terjadi kesalahan menyimpan baris ini." })
      }
    }
  }

  const hitung = (s: "TERSIMPAN" | "DUPLIKAT" | "GAGAL") => hasil.filter((h) => h.status === s).length
  return ok(c, {
    total: laporan.length,
    tersimpan: hitung("TERSIMPAN"),
    duplikat: hitung("DUPLIKAT"),
    gagal: hitung("GAGAL"),
    hasil,
  })
})

// ── Impor cadangan lapangan (berkas backup aplikasi petugas → laporan).
// Dipakai halaman "Impor cadangan" dashboard.
//
// Format backup baru (per-tipe, nama datar `periode_tipe_nomor`) — sesuai
// core/services/backup_lokal.dart:
//   stand/202607_stand_00700800867.jpg  rumah/…  segel/…  video/…
//   catatan/202607_catatan.csv          # satu baris teks per pembacaan
//
// Admin BEBAS memilih tipe yang diimpor (field `tipe`, boleh berulang), dan
// mengunggah ZIP penuh ATAU berkas lepasan (mis. hanya foto rumah). Dua kelas
// entri diproses beda:
//  - `catatan` (CSV) → MEMBUAT LaporanHarianPetugas lewat simpanLaporan() yang
//    sama dengan /batch (idempoten: P2002 → DUPLIKAT). Ini sumber angka
//    stand/kondisi.
//  - foto/video (`stand|segel|rumah|video`) → MELAMPIRKAN URL ke pembacaan
//    yang SUDAH ADA pada (nomorLangganan, periode) itu. Bila pembacaannya
//    belum ada (foto diimpor tanpa catatan) → status TANPA_PENCATATAN, bukan
//    gagal — impor catatannya lebih dulu lalu ulangi.
// Catatan diproses SEBELUM foto, jadi mengimpor keduanya sekaligus langsung
// nyambung.
const IMPOR_MAKS_ZIP_BYTE = 80 * 1024 * 1024
const IMPOR_MAKS_ENTRI = 5000
const TIPE_FOTO = ["stand", "segel", "rumah", "video"] as const
const TIPE_IMPOR = [...TIPE_FOTO, "catatan"] as const
type TipeImpor = (typeof TIPE_IMPOR)[number]
const FIELD_URL_FOTO: Record<string, "fotoStandUrl" | "fotoSegelUrl" | "fotoRumahUrl" | "videoUrl"> = {
  stand: "fotoStandUrl",
  segel: "fotoSegelUrl",
  rumah: "fotoRumahUrl",
  video: "videoUrl",
}
// `periode_tipe_nomor.ext` pada nama-dasar berkas (abaikan prefix folder ZIP).
const POLA_FOTO = /(?:^|\/)(\d{6})_(stand|segel|rumah|video)_(\d{6,20})\.(jpe?g|png|webp|mp4)$/i

type StatusImpor = "TERSIMPAN" | "DUPLIKAT" | "DILAMPIRKAN" | "TANPA_PENCATATAN" | "GAGAL"
interface BarisHasil {
  index: number
  jenis: TipeImpor
  nomorLangganan: string
  periode: number
  status: StatusImpor
  id?: string
  pesan?: string
}

/// Entri sumber terunifikasi: berasal dari file lepasan atau isi ZIP.
interface EntriImpor {
  nama: string
  buffer: () => Promise<ArrayBuffer>
  teks: () => Promise<string>
}

/// Pengurai CSV RFC-4180 ringkas (tangani kutip, koma dalam kutip, CRLF).
function uraiCsv(teks: string): string[][] {
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQ = false
  for (let i = 0; i < teks.length; i++) {
    const ch = teks[i]
    if (inQ) {
      if (ch === '"') {
        if (teks[i + 1] === '"') { field += '"'; i++ } else inQ = false
      } else field += ch
      continue
    }
    if (ch === '"') inQ = true
    else if (ch === ",") { row.push(field); field = "" }
    else if (ch === "\r") { /* abaikan */ }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = "" }
    else field += ch
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((v) => v.trim() !== ""))
}

laporanHarianRouter.post("/import-backup", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const form = await c.req.formData()
  const berkasMasuk = form.getAll("berkas").filter((f): f is File => f instanceof File)
  if (berkasMasuk.length === 0) throw new BadRequestError("Lampirkan minimal satu berkas (ZIP atau foto/CSV) di field `berkas`.")

  // Tipe yang dipilih admin (boleh berulang); kosong = semua tipe.
  const tipePilih = new Set(
    form.getAll("tipe").map(String).filter((t): t is TipeImpor => (TIPE_IMPOR as readonly string[]).includes(t)),
  )
  const aktif = (t: TipeImpor) => tipePilih.size === 0 || tipePilih.has(t)

  const requester = getSessionUser(c)
  const pencatat = await prisma.pencatat.findUnique({ where: { userId: requester.id }, select: { id: true } })
  const pencatatIdDefault = pencatat?.id ?? null

  // ── Kumpulkan entri dari semua berkas (ZIP di-flatten, lepasan apa adanya).
  const entri: EntriImpor[] = []
  let totalByte = 0
  for (const f of berkasMasuk) {
    totalByte += f.size
    if (totalByte > IMPOR_MAKS_ZIP_BYTE) throw new BadRequestError("Total ukuran unggahan melebihi 80 MB.")
    const isZip = f.name.toLowerCase().endsWith(".zip") || f.type.includes("zip")
    if (isZip) {
      let zip: JSZip
      try {
        zip = await JSZip.loadAsync(await f.arrayBuffer())
      } catch {
        throw new BadRequestError(`Berkas "${f.name}" bukan ZIP yang valid.`)
      }
      for (const jalur of Object.keys(zip.files)) {
        const item = zip.files[jalur]
        if (item.dir) continue
        entri.push({ nama: jalur, buffer: () => item.async("arraybuffer"), teks: () => item.async("string") })
      }
    } else {
      entri.push({ nama: f.name, buffer: () => f.arrayBuffer(), teks: () => f.text() })
    }
  }
  if (entri.length > IMPOR_MAKS_ENTRI) throw new BadRequestError(`Terlalu banyak berkas (maks ${IMPOR_MAKS_ENTRI}).`)

  // ── Klasifikasi entri: CSV catatan vs foto/video (dari nama-dasar).
  const entriCsv = entri.filter((e) => /(?:^|\/)catatan\//i.test(e.nama) || /_catatan\.csv$/i.test(e.nama))
  const entriFoto: { e: EntriImpor; periode: number; jenis: string; nomor: string }[] = []
  for (const e of entri) {
    const m = POLA_FOTO.exec(e.nama)
    if (m) entriFoto.push({ e, periode: Number(m[1]), jenis: m[2].toLowerCase(), nomor: m[3] })
  }
  if (entriCsv.length === 0 && entriFoto.length === 0) {
    throw new BadRequestError("Tidak ada berkas yang dikenali (nama harus `periode_tipe_nomor.jpg` atau CSV catatan).")
  }

  const hasil: BarisHasil[] = []
  let idx = 0

  // ── 1) Catatan (CSV) → buat pembacaan. Header baris pertama memetakan kolom.
  if (aktif("catatan")) {
    for (const e of entriCsv) {
      let baris: string[][]
      try {
        baris = uraiCsv(await e.teks())
      } catch {
        hasil.push({ index: idx++, jenis: "catatan", nomorLangganan: "?", periode: 0, status: "GAGAL", pesan: `CSV "${e.nama}" gagal dibaca.` })
        continue
      }
      if (baris.length < 2) continue
      const header = baris[0].map((h) => h.trim())
      for (const kolom of baris.slice(1)) {
        const obj: Record<string, string> = {}
        header.forEach((h, i) => {
          const v = (kolom[i] ?? "").trim()
          if (v !== "") obj[h] = v
        })
        const nomorLangganan = obj.nomorLangganan ?? ""
        const periode = Number(obj.periode ?? 0)
        const identitas = { index: idx++, jenis: "catatan" as const, nomorLangganan, periode }
        // isSegel di CSV berupa teks "true"/"false"; createSchema mengharap
        // boolean asli (bukan z.coerce), jadi dikonversi sebelum validasi.
        const input: Record<string, unknown> = { ...obj }
        if ("isSegel" in obj) input.isSegel = obj.isSegel === "true" || obj.isSegel === "1"
        // Tautkan ke Pelanggan lewat nomorLangganan (CSV tidak membawa
        // pelangganId) supaya pembacaan tertaut benar (snapshot nama/alamat,
        // jarak GPS, alur verifikasi) — bukan baris orphan.
        if (!input.pelangganId && nomorLangganan) {
          const p = await prisma.pelanggan.findFirst({
            where: { nomorLangganan, deletedAt: null },
            select: { id: true },
          })
          if (p) input.pelangganId = p.id
        }
        const parsed = createSchema.safeParse(input)
        if (!parsed.success) {
          hasil.push({ ...identitas, status: "GAGAL", pesan: "Baris catatan tidak valid / stand tidak lengkap." })
          continue
        }
        try {
          const row = await simpanLaporan(parsed.data, pencatatIdDefault)
          hasil.push({ ...identitas, status: "TERSIMPAN", id: row.id })
        } catch (err) {
          if (isPrismaKnownError(err) && err.code === "P2002") {
            hasil.push({ ...identitas, status: "DUPLIKAT", pesan: "Pembacaan periode ini sudah ada." })
          } else if (isPrismaKnownError(err) && err.code === "P2003") {
            hasil.push({ ...identitas, status: "GAGAL", pesan: "Referensi pelanggan/pencatat tidak valid." })
          } else {
            console.error("[import-backup] catatan gagal:", identitas, err)
            hasil.push({ ...identitas, status: "GAGAL", pesan: "Terjadi kesalahan menyimpan baris ini." })
          }
        }
      }
    }
  }

  // ── 2) Foto/video → LAMPIRKAN ke pembacaan yang sudah ada (nomor, periode).
  for (const { e, periode, jenis, nomor } of entriFoto) {
    if (!aktif(jenis as TipeImpor)) continue
    const identitas = { index: idx++, jenis: jenis as TipeImpor, nomorLangganan: nomor, periode }
    try {
      const buf = await e.buffer()
      const berkasFoto = new File([buf], `${periode}_${jenis}_${nomor}.${jenis === "video" ? "mp4" : "jpg"}`, {
        type: jenis === "video" ? "video/mp4" : "image/jpeg",
      })
      let url: string
      try {
        const simpan = await simpanBerkas(berkasFoto, {
          prefix: "laporan-harian",
          namaBerkas: `${periode}_${jenis}_${nomor}`,
          subFolder: `${periode}`,
          jenisMedia: jenis === "video" ? "video" : "foto",
        })
        url = simpan.url
      } catch (err) {
        if (err instanceof BerkasTidakValidError) {
          hasil.push({ ...identitas, status: "GAGAL", pesan: "Berkas foto/video rusak atau tak dikenal." })
          continue
        }
        throw err
      }
      // Lampirkan ke pembacaan yang ada — tanpa membuat baris baru.
      const upd = await prisma.laporanHarianPetugas.updateMany({
        where: { nomorLangganan: nomor, periode },
        data: { [FIELD_URL_FOTO[jenis]]: url },
      })
      hasil.push(
        upd.count > 0
          ? { ...identitas, status: "DILAMPIRKAN" }
          : { ...identitas, status: "TANPA_PENCATATAN", pesan: "Belum ada pencatatan periode ini — impor catatannya dulu." },
      )
    } catch (err) {
      console.error("[import-backup] foto gagal:", identitas, err)
      hasil.push({ ...identitas, status: "GAGAL", pesan: "Terjadi kesalahan memproses berkas ini." })
    }
  }

  const hitung = (s: StatusImpor) => hasil.filter((h) => h.status === s).length
  return ok(c, {
    total: hasil.length,
    tersimpan: hitung("TERSIMPAN"),
    duplikat: hitung("DUPLIKAT"),
    dilampirkan: hitung("DILAMPIRKAN"),
    tanpaPencatatan: hitung("TANPA_PENCATATAN"),
    gagal: hitung("GAGAL"),
    hasil,
  })
})

// ── Verifikasi berjenjang V1 → V2 → V3 (spesifikasi: tabel.md di
// features/dashboard/components/verifikasi/). PembacaanMeter resmi BARU
// dibuat saat V3 — bukan di V1 seperti alur lama. Urutan ring wajib, tapi
// role di atasnya boleh mengerjakan ring bawah (V1 = SUPERVISOR_UP,
// V2 = MANAGEMENT_UP, V3 = SENIOR_UP).

const verif1Schema = z.object({
  /// Meter tujuan pembacaan resmi, dipilih di V1 (paling dekat ke lapangan).
  /// Wajib eksplisit: `nomorMeter` di laporan bisa duplikat/orphan (681
  /// duplikat di data lapangan), jadi penentuan meter yang benar adalah
  /// keputusan verifikator, bukan tebakan sistem.
  meterId: z.string().min(1),
  blokTarif: z.coerce.number().int().min(1).max(4),
  catatanVerif: z.string().trim().max(500).nullable().optional(),
  /// "ST akhir revisi": koreksi stand akhir bila petugas salah input.
  /// TIDAK menimpa standAkhir (angka catat) — keduanya tampil berdampingan;
  /// V3 memakai revisi (bila ada) sebagai stand pembacaan resmi.
  standAkhirRevisi: z.coerce.number().int().min(0).nullable().optional(),
  /// Koreksi keterangan/kondisi catat (DK, BMK/BMB, dst.) — stand revisi
  /// kumulatif kerap menuntut kondisi ikut dibenarkan. Ikut mengalir ke
  /// PembacaanMeter resmi saat V3 (V3 membaca laporan.kondisi).
  kondisi: z.enum(KondisiCatat).optional(),
})

laporanHarianRouter.patch("/:id/verif1", requireRole(...ROLE_GROUPS.SUPERVISOR_UP), validate("json", verif1Schema), async (c) => {
  const id = c.req.param("id")
  const body = c.req.valid("json")
  const requester = getSessionUser(c)

  const laporan = await prisma.laporanHarianPetugas.findUnique({ where: { id } })
  if (!laporan) throw new NotFoundError("LaporanHarianPetugas")
  if (laporan.pembacaanId) throw new ConflictError("Laporan sudah menjadi pembacaan resmi")
  if (laporan.verif1At) throw new ConflictError("V1 sudah diisi — batalkan dulu bila perlu mengulang")

  const meter = await prisma.meter.findUnique({ where: { id: body.meterId } })
  if (!meter) throw new NotFoundError("Meter")

  const row = await prisma.laporanHarianPetugas.update({
    where: { id },
    data: {
      verif1At: new Date(),
      verif1ById: requester.id,
      meterVerifId: body.meterId,
      blokTarifVerif: body.blokTarif,
      standAkhirRevisi: body.standAkhirRevisi,
      // undefined = kondisi tidak dikoreksi, nilai lama dipertahankan.
      kondisi: body.kondisi,
      // ?? null (bukan undefined): tanpa catatan baru, catatan penolakan
      // lama ikut terhapus — bukan menempel di laporan yang sudah lolos V1.
      catatanVerif: body.catatanVerif ?? null,
      // Laporan DITOLAK boleh diverifikasi ulang bila ternyata benar —
      // V1 baru menghapus jejak penolakan (penanda status DITOLAK adalah
      // verifiedAt terisi tanpa isVerified).
      verifiedAt: null,
      verifiedById: null,
    },
    include: { verif1By: { select: { id: true, name: true } } },
  })
  return ok(c, row)
})

const catatanSchema = z.object({ catatanVerif: z.string().trim().max(500).nullable().optional() })

laporanHarianRouter.patch("/:id/verif2", requireRole(...ROLE_GROUPS.MANAGEMENT_UP), validate("json", catatanSchema), async (c) => {
  const id = c.req.param("id")
  const requester = getSessionUser(c)
  const laporan = await prisma.laporanHarianPetugas.findUnique({ where: { id } })
  if (!laporan) throw new NotFoundError("LaporanHarianPetugas")
  if (laporan.pembacaanId) throw new ConflictError("Laporan sudah menjadi pembacaan resmi")
  if (!laporan.verif1At) throw new BadRequestError("V2 menunggu V1 — laporan belum diperiksa supervisor")
  if (laporan.verif2At) throw new ConflictError("V2 sudah diisi — batalkan dulu bila perlu mengulang")

  const body = c.req.valid("json")
  const row = await prisma.laporanHarianPetugas.update({
    where: { id },
    data: {
      verif2At: new Date(),
      verif2ById: requester.id,
      ...(body.catatanVerif !== undefined ? { catatanVerif: body.catatanVerif } : {}),
    },
  })
  return ok(c, row)
})

/// V3 = final approval: satu-satunya tempat PembacaanMeter resmi dibuat.
/// Stand resmi = standAkhirRevisi (bila V1 mengoreksi) atau standAkhir catat.
laporanHarianRouter.patch("/:id/verif3", requireRole(...ROLE_GROUPS.SENIOR_UP), validate("json", catatanSchema), async (c) => {
  const id = c.req.param("id")
  const requester = getSessionUser(c)
  const laporan = await prisma.laporanHarianPetugas.findUnique({ where: { id } })
  if (!laporan) throw new NotFoundError("LaporanHarianPetugas")
  if (laporan.pembacaanId) throw new ConflictError("Laporan sudah menjadi pembacaan resmi")
  if (!laporan.verif1At || !laporan.verif2At) throw new BadRequestError("V3 menunggu V1 dan V2 selesai")
  if (!laporan.meterVerifId) throw new BadRequestError("Meter tujuan belum dipilih di V1")

  const standAkhir = laporan.standAkhirRevisi ?? laporan.standAkhir
  const pemakaian = Math.max(0, standAkhir - laporan.standAwal)
  const kini = new Date()

  const row = await prisma.$transaction(async (tx) => {
    const pembacaan = await tx.pembacaanMeter.create({
      data: {
        meterId: laporan.meterVerifId!,
        periode: periodeToDate(laporan.periode),
        standLalu: laporan.standAwal,
        standAkhir,
        pemakaianM3: pemakaian,
        blokTarif: laporan.blokTarifVerif ?? 1,
        pemakaianLalu: laporan.pemakaianLalu,
        kondisi: laporan.kondisi,
        kategori: laporan.kategori,
        pencatatId: laporan.pencatatId,
        tanggalCatat: laporan.tanggalCatat,
        // Foto stand ikut ke pembacaan resmi (cermin alur laporan mandiri
        // yang menyalin fotoUrl pelapor).
        fotoBukti: laporan.fotoStandUrl,
      },
    })
    return tx.laporanHarianPetugas.update({
      where: { id },
      data: {
        verif3At: kini,
        verif3ById: requester.id,
        // Penanda final legacy tetap diisi supaya filter statusVerif,
        // stats, dan konsumen lama (mobile) membaca status yang sama.
        isVerified: true,
        verifiedAt: kini,
        verifiedById: requester.id,
        pembacaanId: pembacaan.id,
      },
      include: { pembacaan: true },
    })
  })
  return ok(c, row)
})

const rejectSchema = z.object({ catatanVerif: z.string().trim().min(1).max(500) })

/// "Cek ulang": mengembalikan laporan ke petugas. Ring yang sudah terisi
/// ikut direset — setelah dicek ulang, verifikasi mulai lagi dari V1.
laporanHarianRouter.patch("/:id/reject", requireRole(...ROLE_GROUPS.SUPERVISOR_UP), validate("json", rejectSchema), async (c) => {
  const id = c.req.param("id")
  const requester = getSessionUser(c)
  const laporan = await prisma.laporanHarianPetugas.findUnique({ where: { id } })
  if (!laporan) throw new NotFoundError("LaporanHarianPetugas")
  if (laporan.pembacaanId) throw new BadRequestError("Laporan sudah menjadi pembacaan resmi, tidak bisa ditolak — batalkan verifikasinya dulu")

  const row = await prisma.laporanHarianPetugas.update({
    where: { id },
    data: {
      isVerified: false,
      verifiedAt: new Date(),
      verifiedById: requester.id,
      catatanVerif: c.req.valid("json").catatanVerif,
      verif1At: null,
      verif1ById: null,
      verif2At: null,
      verif2ById: null,
      verif3At: null,
      verif3ById: null,
      standAkhirRevisi: null,
      meterVerifId: null,
      blokTarifVerif: null,
    },
  })
  return ok(c, row)
})

/// "Unverifikasi": membatalkan SATU tahap terakhir (V3 → V2 → V1 → kosong;
/// baris DITOLAK kembali ke MENUNGGU). Role minimal mengikuti ring yang
/// dibatalkan. Pembatalan V3 menghapus PembacaanMeter resmi — ditolak bila
/// pembacaan sudah dipakai Tagihan (angka penagihan tidak boleh berubah
/// diam-diam).
laporanHarianRouter.patch("/:id/unverify", requireRole(...ROLE_GROUPS.SUPERVISOR_UP), async (c) => {
  const id = c.req.param("id")
  const requester = getSessionUser(c)
  const laporan = await prisma.laporanHarianPetugas.findUnique({ where: { id } })
  if (!laporan) throw new NotFoundError("LaporanHarianPetugas")

  const bolehSenior = (ROLE_GROUPS.SENIOR_UP as readonly string[]).includes(requester.role)
  const bolehManajemen = (ROLE_GROUPS.MANAGEMENT_UP as readonly string[]).includes(requester.role)

  if (laporan.pembacaanId) {
    if (!bolehSenior) throw new ForbiddenError("Membatalkan approve final (V3) memerlukan Senior Manager ke atas")
    const tagihan = await prisma.tagihan.findUnique({ where: { pembacaanId: laporan.pembacaanId } })
    if (tagihan) throw new ConflictError("Pembacaan resmi laporan ini sudah dipakai tagihan — tidak bisa dibatalkan")

    const pembacaanId = laporan.pembacaanId
    const row = await prisma.$transaction(async (tx) => {
      const diperbarui = await tx.laporanHarianPetugas.update({
        where: { id },
        data: { verif3At: null, verif3ById: null, isVerified: false, verifiedAt: null, verifiedById: null, pembacaanId: null },
      })
      await tx.pembacaanMeter.delete({ where: { id: pembacaanId } })
      return diperbarui
    })
    return ok(c, row)
  }

  if (laporan.verif2At) {
    if (!bolehManajemen) throw new ForbiddenError("Membatalkan V2 memerlukan Manager ke atas")
    return ok(c, await prisma.laporanHarianPetugas.update({ where: { id }, data: { verif2At: null, verif2ById: null } }))
  }

  if (laporan.verif1At) {
    return ok(
      c,
      await prisma.laporanHarianPetugas.update({
        where: { id },
        data: { verif1At: null, verif1ById: null, standAkhirRevisi: null, meterVerifId: null, blokTarifVerif: null },
      }),
    )
  }

  if (laporan.verifiedAt) {
    // Baris DITOLAK (cek ulang) — kembalikan ke MENUNGGU.
    return ok(
      c,
      await prisma.laporanHarianPetugas.update({
        where: { id },
        data: { verifiedAt: null, verifiedById: null, catatanVerif: null },
      }),
    )
  }

  throw new BadRequestError("Belum ada tahap verifikasi yang bisa dibatalkan")
})
