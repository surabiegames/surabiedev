// server/modules/closing/bulan-baru.service.ts — BUKA BULAN BARU: menerbitkan
// Daftar Catat (DPM) periode berikutnya.
//
// INI PASANGAN DARI CLOSING. Closing menutup bulan; berkas ini membukanya
// lagi. Tanpa keduanya siklus bulanan tidak berputar: aplikasi bisa mengunci
// Mei tapi tidak bisa menyiapkan pekerjaan Juni, dan operator harus kembali
// ke Aurora — persis yang ingin kita hentikan.
//
// ATURAN YANG DIPAKAI:
//
//     DPM(N+1) = SELURUH pelanggan yang masih layak ditagih
//                − yang ditandai DICABUT pada DPM(N)
//
// BASISNYA MASTER PELANGGAN, BUKAN DAFTAR BULAN LALU. Ini bukan detail
// selera — versi pertama berkas ini menurunkan DPM(N+1) dari baris DPM(N),
// dan analisis enam periode (jan–juni 2026) membuktikan itu BOCOR:
//
//     transisi     bocor bila basisnya daftar bulan lalu
//     mar -> apr   156 sambungan
//     apr -> mei    34 sambungan
//
// "Bocor" = sambungan yang NYATANYA ditagih pada bulan itu, tapi tidak akan
// pernah masuk daftar kerja yang kita turunkan — artinya tidak dikunjungi,
// tidak dicatat, dan tidak tertagih. Sebabnya: berkas daftar kerja Aurora
// (lapdatameter) kadang menjatuhkan baris yang masih aktif lalu
// mengembalikannya bulan berikutnya. Menurunkan dari daftar bulan lalu
// mewarisi lubang itu dan MELESTARIKANNYA.
//
// Master pelanggan tidak pernah menjatuhkan mereka: diuji terhadap
// PEL202604-PW5.csv dan PEL202606-PW5.csv dari STI, basis master menutupi
// 100% sambungan yang ditagih (nol bocor di seluruh transisi yang bisa
// diuji). Tabel `Pelanggan` di aplikasi ini SETARA dengan master itu —
// terverifikasi 22.542 nomor STI + 11 PBPK Mei = 22.553 baris, tanpa sisa.
//
// Aturan lama tetap benar untuk sisi KELUAR-nya, dan itu dipertahankan:
//     22.553 − 19 dicabut = 22.534  (cocok dengan 22.523 ditagih + 11 PBPK)
// Yang berubah hanya dari mana daftar 22.553 itu diambil.
//
// SISI MASUK ikut terjawab dengan sendirinya. Analisis enam periode
// menunjukkan MASUK(N→N+1) = PBPK(N) secara persis — 26/26, 8/8, 5/5,
// 11/11 di empat transisi yang bisa diuji. Dengan basis master, sambungan
// PBPK yang sudah menjadi baris Pelanggan otomatis ikut tanpa aturan
// tambahan.
//
// KENAPA RUTE & PENCATAT DI-SNAPSHOT ULANG, BUKAN DISALIN DARI BULAN LALU:
// DaftarCatat menyimpan rute & pencatat SAAT DAFTAR DIBEKUKAN. Saat membuka
// bulan baru, penugasan yang berlaku adalah penugasan HARI INI — itulah
// sebabnya Aurora menjalankan "Update zonasi" tepat sebelum "Create Bulan
// baru". Menyalin dari bulan lalu akan membuat perubahan rute tidak pernah
// sampai ke lapangan, dan 11 PBPK yang bulan lalu berpetugas "-" akan tetap
// tak berpetugas selamanya — padahal justru bulan inilah mereka pertama kali
// masuk beban kerja.

import type { Prisma, StatusPelanggan } from "@workspace/db"
import { prisma } from "@workspace/db"
import { BadRequestError, ConflictError } from "../../lib/errors"
import { recordAudit } from "../../lib/audit"
import type { HambatanClosing, JejakAudit } from "./closing.service"

/// Sama alasannya dengan UKURAN_BATCH di closing.service.ts: 22 ribu insert
/// satu per satu ke Postgres terkelola makan waktu berjam-jam.
const UKURAN_BATCH = 1000

/// Maksimal nomor langganan yang dicantumkan per hambatan — sama dengan
/// closing.service.ts supaya tampilannya seragam.
const MAKS_CONTOH = 20

/// Status pelanggan yang TIDAK boleh masuk daftar kerja bulan depan —
/// SEKARANG KOSONG, dan itu kesimpulan, bukan kelalaian.
///
/// TUTUP_SEMENTARA, DISEGEL, dan TUTUP_SPT sengaja tidak ada di sini: di data
/// 202605 sambungan berstatus tutup tetap dikunjungi petugas (tetap pekerjaan
/// nyata), dan yang benar-benar keluar dari daftar hanyalah yang DICABUT pada
/// periode itu. Dulu daftar ini berisi `CABUT_PERMANEN` sebagai "yang tidak
/// mungkin ditagih lagi" — status itu sudah dihapus karena di PDAM tidak ada
/// pencabutan selamanya: bekas pelanggan kapan pun boleh memasang kembali.
/// Jadi tidak ada satu pun status yang mengeluarkan sambungan dari daftar
/// kerja; yang mengeluarkannya hanyalah kejadian dicabut pada periode itu.
const STATUS_TIDAK_IKUT: readonly StatusPelanggan[] = []

export function periodeBerikutnya(periode: number): number {
  const tahun = Math.floor(periode / 100)
  const bulan = periode % 100
  return bulan === 12 ? (tahun + 1) * 100 + 1 : tahun * 100 + (bulan + 1)
}

export interface PratinjauBulanBaru {
  periodeSumber: number
  periodeBaru: number
  /// Isi DPM periode sumber, per status.
  sumber: { total: number; perStatus: Record<string, number> }
  /// Sudah adakah DPM periode baru, dan sudah bergerakkah isinya.
  tujuan: { sudahAda: number; sudahBergerak: number }
  /// Perkiraan hasil bila dijalankan sekarang.
  ///
  /// PERHATIAN pemakai: `tanpaPencatat` adalah SUPERSET dari `tanpaRute` —
  /// sambungan tanpa rute otomatis juga tanpa pencatat. Jadi jangan
  /// menjumlahkan keduanya; `tanpaPencatat` sudah merupakan total "belum ada
  /// yang bertanggung jawab".
  perkiraan: { akanDibuat: number; tanpaRute: number; tanpaPencatat: number }
  hambatan: HambatanClosing[]
  bisaDibuka: boolean
}

interface BarisCalon {
  pelangganId: string
  nomorLangganan: string
  ruteId: string | null
  pencatatId: string | null
  urutan: number
}

interface HasilHitung {
  calon: BarisCalon[]
  hambatan: HambatanClosing[]
  sumberTotal: number
  sumberPerStatus: Record<string, number>
}

/// Menghitung isi DPM periode berikutnya. MURNI MEMBACA — tidak menulis
/// apa pun. Dipakai oleh pratinjau maupun eksekusi, supaya angka yang
/// ditampilkan ke operator dan angka yang benar-benar ditulis berasal dari
/// satu jalur yang sama.
async function hitungCalon(periodeSumber: number): Promise<HasilHitung> {
  // BASIS: seluruh pelanggan yang masih layak ditagih. Inilah populasi yang
  // benar (lihat kepala berkas) — bukan baris DPM bulan lalu.
  const [pelangganLayak, barisSumber, pernahDicabut] = await Promise.all([
    prisma.pelanggan.findMany({
      where: { deletedAt: null, status: { notIn: [...STATUS_TIDAK_IKUT] } },
      select: { id: true, nomorLangganan: true, ruteId: true, noUrutRute: true },
    }),
    // DPM bulan lalu tetap dibaca, tapi perannya berubah: ia bukan lagi
    // SUMBER daftar, melainkan sumber snapshot rute/petugas sebagai cadangan
    // penugasan.
    prisma.daftarCatat.findMany({
      where: { periode: periodeSumber },
      select: { pelangganId: true, status: true, ruteId: true, pencatatId: true },
    }),
    // Cabutan bersifat PERMANEN sampai ada pemasangan kembali, jadi sinyalnya
    // harus dibaca dari SELURUH riwayat sampai periode sumber — bukan hanya
    // dari DPM periode sumber.
    //
    // Ini ditemukan lewat uji siklus penuh: setelah DPM 202606 terbit (yang
    // isinya semua BELUM_DICATAT, tanpa satu pun DICABUT), pratinjau siklus
    // berikutnya melaporkan 22.553 — 19 sambungan yang dicabut pada Mei
    // HIDUP KEMBALI hanya karena tanda dicabutnya ada di periode 202605 dan
    // bukan di 202606. Membaca riwayat menutup lubang itu.
    //
    // Sambungan yang benar-benar dipasang kembali masuk lagi lewat impor
    // PBPK (yang memang membuat baris daftar catat baru) — jalur yang sama
    // dengan Aurora, di mana "PK" berarti pasang kembali.
    prisma.daftarCatat.findMany({
      where: { periode: { lte: periodeSumber }, status: "DICABUT" },
      select: { pelangganId: true, periode: true },
    }),
  ])

  const dicabutSelamanya = new Map<string, number>()
  for (const d of pernahDicabut) dicabutSelamanya.set(d.pelangganId, d.periode)

  const sumberPerStatus: Record<string, number> = {}
  const dpmSumber = new Map<string, (typeof barisSumber)[number]>()
  for (const b of barisSumber) {
    sumberPerStatus[b.status] = (sumberPerStatus[b.status] ?? 0) + 1
    dpmSumber.set(b.pelangganId, b)
  }

  // Penugasan rute -> pencatat dimuat SEKALI. Satu rute bisa punya lebih dari
  // satu pencatat (model PenugasanRute unik pada pasangan, bukan pada rute),
  // jadi pilihannya dibuat DETERMINISTIK: urutan terkecil, lalu id terkecil.
  // Rute yang berpencatat ganda dilaporkan sebagai hambatan supaya
  // pemilihannya tidak diam-diam.
  const penugasan = await prisma.penugasanRute.findMany({
    select: { ruteId: true, pencatatId: true, urutan: true },
    orderBy: [{ urutan: "asc" }, { pencatatId: "asc" }],
  })
  const pencatatPerRute = new Map<string, string>()
  const ruteGanda = new Set<string>()
  for (const p of penugasan) {
    if (pencatatPerRute.has(p.ruteId)) ruteGanda.add(p.ruteId)
    else pencatatPerRute.set(p.ruteId, p.pencatatId)
  }

  const calon: BarisCalon[] = []
  const terkena = {
    dicabut: [] as string[],
    tanpaRute: [] as string[],
    tanpaPencatat: [] as string[],
    pencatatCadangan: [] as string[],
    pulih: [] as string[],
  }
  const jumlah = {
    dicabut: 0,
    tanpaRute: 0,
    tanpaPencatat: 0,
    pencatatCadangan: 0,
    pulih: 0,
  }
  const catat = (kunci: keyof typeof terkena, nomor: string) => {
    jumlah[kunci]++
    if (terkena[kunci].length < MAKS_CONTOH) terkena[kunci].push(nomor)
  }

  for (const p of pelangganLayak) {
    const b = dpmSumber.get(p.id)

    // Satu-satunya yang dikeluarkan: pernah ditandai DICABUT sampai periode
    // sumber (lihat alasan riwayat di atas).
    if (dicabutSelamanya.has(p.id)) {
      catat("dicabut", p.nomorLangganan)
      continue
    }
    // Layak ditagih tapi TIDAK ADA di daftar bulan lalu — inilah baris yang
    // hilang bila basisnya daftar bulan lalu (156 di Maret, 34 di April pada
    // data nyata). Tetap dimasukkan, dan dilaporkan supaya pemulihannya
    // terlihat, bukan diam-diam.
    if (!b) catat("pulih", p.nomorLangganan)

    // Penugasan pencatat, dua tingkat:
    //   1. PenugasanRute yang berlaku hari ini — sumber resminya.
    //   2. CADANGAN: pencatat dari daftar bulan lalu, TAPI hanya bila rute
    //      pelanggan tidak berubah. Ini bukan kemewahan: di database ini
    //      PenugasanRute baru mencakup sebagian kecil rute, sementara daftar
    //      bulan lalu punya petugas untuk hampir semua baris. Tanpa cadangan
    //      ini, membuka bulan baru akan MENGOSONGKAN penugasan puluhan ribu
    //      SL — memperburuk keadaan, bukan memperbaikinya. Bila rutenya
    //      berubah, cadangan TIDAK dipakai: petugas lama belum tentu
    //      memegang rute yang baru.
    let pencatatId = p.ruteId ? (pencatatPerRute.get(p.ruteId) ?? null) : null
    let dariCadangan = false
    if (!pencatatId && p.ruteId && b?.pencatatId && b.ruteId === p.ruteId) {
      pencatatId = b.pencatatId
      dariCadangan = true
    }

    if (!p.ruteId) catat("tanpaRute", p.nomorLangganan)
    else if (!pencatatId) catat("tanpaPencatat", p.nomorLangganan)
    else if (dariCadangan) catat("pencatatCadangan", p.nomorLangganan)

    calon.push({
      pelangganId: p.id,
      nomorLangganan: p.nomorLangganan,
      ruteId: p.ruteId,
      pencatatId,
      urutan: p.noUrutRute ?? 0,
    })
  }

  const hambatan: HambatanClosing[] = []
  if (jumlah.dicabut > 0) {
    hambatan.push({
      kode: "KELUAR_DICABUT",
      pesan:
        "Dicabut pada periode sumber — sesuai aturan DPM mereka TIDAK ikut ke bulan baru. Ini yang diharapkan, bukan masalah",
      jumlah: jumlah.dicabut,
      contoh: terkena.dicabut,
    })
  }
  if (jumlah.pulih > 0) {
    hambatan.push({
      kode: "DIPULIHKAN_DARI_MASTER",
      pesan:
        "Masih layak ditagih tetapi TIDAK ADA di daftar catat periode sumber — dimasukkan kembali dari data induk pelanggan. Tanpa ini mereka tidak akan dikunjungi, tidak dicatat, dan tidak tertagih (pada data Aurora nyata: 156 sambungan di Maret, 34 di April)",
      jumlah: jumlah.pulih,
      contoh: terkena.pulih,
    })
  }
  if (jumlah.tanpaRute > 0) {
    hambatan.push({
      kode: "TANPA_RUTE",
      pesan:
        "Belum punya rute — tetap masuk daftar, tetapi tidak akan muncul di beban kerja pencatat mana pun sampai rutenya diisi",
      jumlah: jumlah.tanpaRute,
      contoh: terkena.tanpaRute,
    })
  }
  if (jumlah.tanpaPencatat > 0) {
    hambatan.push({
      kode: "RUTE_TANPA_PENCATAT",
      pesan:
        "Rutenya belum ditugaskan ke pencatat mana pun — tetap masuk daftar, tetapi belum ada yang bertanggung jawab mengunjunginya",
      jumlah: jumlah.tanpaPencatat,
      contoh: terkena.tanpaPencatat,
    })
  }
  if (jumlah.pencatatCadangan > 0) {
    hambatan.push({
      kode: "PENCATAT_DARI_BULAN_LALU",
      pesan:
        "Rutenya belum punya PenugasanRute resmi, jadi petugasnya diwarisi dari daftar bulan lalu (rutenya tidak berubah). Daftar kerjanya benar, tetapi penugasan resmi di Data Induk sebaiknya dilengkapi supaya tidak bergantung pada warisan",
      jumlah: jumlah.pencatatCadangan,
      contoh: terkena.pencatatCadangan,
    })
  }
  if (ruteGanda.size > 0) {
    hambatan.push({
      kode: "RUTE_BERPENCATAT_GANDA",
      pesan:
        "Rute ini ditugaskan ke lebih dari satu pencatat — daftar bulan baru memilih yang urutan penugasannya terkecil. Periksa penugasan rutenya bila itu bukan yang dimaksud",
      jumlah: ruteGanda.size,
      contoh: [],
    })
  }

  return { calon, hambatan, sumberTotal: barisSumber.length, sumberPerStatus }
}

export async function pratinjauBulanBaru(periodeSumber: number): Promise<PratinjauBulanBaru> {
  const periodeBaru = periodeBerikutnya(periodeSumber)

  const [periodeRow, hasil, sudahAda, sudahBergerak] = await Promise.all([
    prisma.periodePenagihan.findUnique({ where: { periode: periodeSumber } }),
    hitungCalon(periodeSumber),
    prisma.daftarCatat.count({ where: { periode: periodeBaru } }),
    prisma.daftarCatat.count({
      where: { periode: periodeBaru, status: { not: "BELUM_DICATAT" } },
    }),
  ])

  const hambatan = [...hasil.hambatan]
  let bisaDibuka = true

  if (hasil.sumberTotal === 0) {
    hambatan.push({
      kode: "SUMBER_KOSONG",
      pesan: `Periode ${periodeSumber} belum punya daftar catat sama sekali — tidak ada yang bisa diturunkan`,
      jumlah: 0,
      contoh: [],
    })
    bisaDibuka = false
  }
  if (periodeRow?.status !== "TERKUNCI") {
    hambatan.push({
      kode: "SUMBER_BELUM_DITUTUP",
      pesan: `Periode ${periodeSumber} belum ditutup. Daftar bulan baru diturunkan dengan mengeluarkan sambungan yang DICABUT pada periode sumber, dan itu baru pasti setelah periodenya dikunci — tutup ${periodeSumber} lebih dulu`,
      jumlah: 0,
      contoh: [],
    })
    bisaDibuka = false
  }
  if (sudahBergerak > 0) {
    hambatan.push({
      kode: "TUJUAN_SUDAH_BERJALAN",
      pesan: `Daftar catat ${periodeBaru} sudah dipakai bekerja (ada baris yang statusnya bukan BELUM_DICATAT) — menerbitkan ulang akan menghapus pekerjaan itu, jadi ditolak`,
      jumlah: sudahBergerak,
      contoh: [],
    })
    bisaDibuka = false
  }

  return {
    periodeSumber,
    periodeBaru,
    sumber: { total: hasil.sumberTotal, perStatus: hasil.sumberPerStatus },
    tujuan: { sudahAda, sudahBergerak },
    perkiraan: {
      akanDibuat: hasil.calon.length,
      tanpaRute: hasil.calon.filter((c) => !c.ruteId).length,
      tanpaPencatat: hasil.calon.filter((c) => !c.pencatatId).length,
    },
    hambatan,
    bisaDibuka,
  }
}

export interface BukaBulanBaruInput {
  /// Periode SUMBER (N). Yang diterbitkan adalah daftar catat N+1.
  periode: number
  olehUserId: string
  jejak?: JejakAudit
}

export interface HasilBukaBulanBaru {
  periodeSumber: number
  periodeBaru: number
  dibuat: number
  tanpaRute: number
  tanpaPencatat: number
  hambatan: HambatanClosing[]
}

export async function bukaBulanBaru(input: BukaBulanBaruInput): Promise<HasilBukaBulanBaru> {
  const periodeSumber = input.periode
  const periodeBaru = periodeBerikutnya(periodeSumber)

  // Prasyarat diperiksa DI SINI juga, bukan hanya di pratinjau. Pratinjau
  // adalah alat bantu operator; ia bisa saja dimuat beberapa menit sebelum
  // tombol ditekan, dan keadaannya bisa berubah di antara keduanya.
  const periodeRow = await prisma.periodePenagihan.findUnique({
    where: { periode: periodeSumber },
  })
  if (periodeRow?.status !== "TERKUNCI") {
    throw new ConflictError(
      `Periode ${periodeSumber} belum ditutup — tutup periodenya lebih dulu sebelum membuka ${periodeBaru}. Daftar bulan baru mengeluarkan sambungan yang dicabut pada periode sumber, dan itu baru pasti setelah periode dikunci.`
    )
  }

  const sudahBergerak = await prisma.daftarCatat.count({
    where: { periode: periodeBaru, status: { not: "BELUM_DICATAT" } },
  })
  if (sudahBergerak > 0) {
    throw new ConflictError(
      `Daftar catat ${periodeBaru} sudah dipakai bekerja (${sudahBergerak} baris sudah berstatus selain BELUM_DICATAT) — menerbitkan ulang akan menghapus pekerjaan itu.`
    )
  }

  const { calon, hambatan, sumberTotal } = await hitungCalon(periodeSumber)
  if (sumberTotal === 0) {
    throw new BadRequestError(
      `Periode ${periodeSumber} belum punya daftar catat sama sekali — tidak ada yang bisa diturunkan ke ${periodeBaru}.`
    )
  }
  if (calon.length === 0) {
    throw new BadRequestError(
      `Tidak ada satu pun sambungan yang layak dibawa ke ${periodeBaru} dari ${periodeSumber}.`
    )
  }

  // Hapus-lalu-tulis, BUKAN upsert per baris. Dua alasannya:
  //   1. Snapshot rute/pencatat harus benar-benar mencerminkan penugasan saat
  //      ini; upsert yang hanya membuat baris baru akan meninggalkan snapshot
  //      basi pada baris yang sudah ada dari percobaan sebelumnya.
  //   2. 22 ribu upsert satu per satu ke Postgres terkelola makan waktu
  //      berjam-jam (pelajaran dari skrip seed).
  // Aman karena penjagaan di atas sudah memastikan TIDAK ADA baris periode
  // baru yang sudah bergerak — yang dihapus hanyalah daftar yang belum
  // disentuh siapa pun. Karena itu pula operasi ini aman diulang.
  await prisma.daftarCatat.deleteMany({ where: { periode: periodeBaru } })

  let dibuat = 0
  for (let mulai = 0; mulai < calon.length; mulai += UKURAN_BATCH) {
    const kelompok = calon.slice(mulai, mulai + UKURAN_BATCH)
    const data: Prisma.DaftarCatatCreateManyInput[] = kelompok.map((c) => ({
      periode: periodeBaru,
      pelangganId: c.pelangganId,
      ruteId: c.ruteId,
      pencatatId: c.pencatatId,
      urutan: c.urutan,
      // Semua baris di sini berasal dari daftar periode sebelumnya — termasuk
      // PBPK, yang pada periode ini sudah "lulus" menjadi sambungan biasa.
      sumber: "CARRY_OVER",
      status: "BELUM_DICATAT",
    }))
    const res = await prisma.daftarCatat.createMany({ data, skipDuplicates: true })
    dibuat += res.count
  }

  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, {
      userId: input.olehUserId,
      aksi: "BUKA_BULAN_BARU",
      entitas: "DaftarCatat",
      entitasId: String(periodeBaru),
      perubahan: {
        periodeSumber,
        periodeBaru,
        dibuat,
        dariTotalSumber: sumberTotal,
        tanpaRute: calon.filter((c) => !c.ruteId).length,
        tanpaPencatat: calon.filter((c) => !c.pencatatId).length,
      },
      ipAddress: input.jejak?.ipAddress ?? null,
      userAgent: input.jejak?.userAgent ?? null,
    })
  })

  return {
    periodeSumber,
    periodeBaru,
    dibuat,
    tanpaRute: calon.filter((c) => !c.ruteId).length,
    tanpaPencatat: calon.filter((c) => !c.pencatatId).length,
    hambatan,
  }
}
