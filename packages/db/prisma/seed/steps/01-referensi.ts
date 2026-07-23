// prisma/seed/steps/01-referensi.ts — data referensi yang statis/closed-set,
// tidak berubah tiap import bulanan. Dua sumber:
// 1. Divisi: 4 nilai KodeDivisi (enum tetap) — aman diseed statis.
// 2. TarifGolongan: diturunkan dari ProgresCater (trp/namatrp), BUKAN
//    diketik manual — namatrp TERVERIFIKASI 1:1 konsisten per kode trp di
//    seluruh 22.523 baris, aman dijadikan sumber kebenaran.
//
// SENGAJA TIDAK men-seed Bagian/SubBagian — itu struktur HR internal yang
// TIDAK ADA di keempat CSV data pelanggan/meter. Mengarang kode/nama
// Bagian tanpa sumber data nyata melanggar prinsip "pemetaan data akurat
// & presisi". Bagian/SubBagian diisi lewat admin UI saat data HR-nya ada.
//
// TarifBlok (harga per-m3 per blok) JUGA tidak diseed di sini — CSV cuma
// punya `jmlhargaair` total per tagihan, bukan tabel harga per-blok
// itemized. Perlu sumber data terpisah (SK tarif resmi) sebelum bisa
// diisi akurat.

import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { readProgresCater } from "../lib/csv"
import { normalizeGolonganTarif } from "../lib/normalize"

const STEP = "01-referensi"

const DIVISI_LIST = [
  { kode: "PELAYANAN", nama: "Pelayanan" },
  { kode: "TEHNIK", nama: "Tehnik" },
  { kode: "UMUM", nama: "Umum" },
  { kode: "UTAMA", nama: "Direktorat Utama" },
] as const

function deriveKategori(kodeAsli: string): string {
  const tier = kodeAsli.trim()[0]
  switch (tier) {
    case "1":
      return "SOSIAL"
    case "2":
      return "RUMAH_TANGGA"
    case "3":
      return "NIAGA"
    case "4":
      return "INDUSTRI"
    default:
      return "LAINNYA"
  }
}

export async function seedReferensi(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  for (const d of DIVISI_LIST) {
    const existing = await prisma.divisi.findUnique({ where: { kode: d.kode } })
    await prisma.divisi.upsert({
      where: { kode: d.kode },
      create: { kode: d.kode, nama: d.nama },
      update: { nama: d.nama },
    })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }

  // Kumpulkan pasangan (trp, namatrp) unik dari ProgresCater — sudah
  // diverifikasi 1:1 konsisten, jadi cukup ambil kemunculan pertama.
  const rows = readProgresCater()
  const tarifMap = new Map<string, string>()
  for (const row of rows) {
    const kodeAsli = row.trp.trim()
    if (!kodeAsli || tarifMap.has(kodeAsli)) continue
    tarifMap.set(kodeAsli, row.namatrp.trim())
  }

  for (const [kodeAsli, nama] of tarifMap) {
    const kode = normalizeGolonganTarif(kodeAsli)
    if (!kode) {
      report.warn(STEP, `Kode tarif "${kodeAsli}" tidak dikenali di enum GolonganTarif, dilewati`, {
        key: kodeAsli,
      })
      report.skipped(STEP)
      continue
    }
    const existing = await prisma.tarifGolongan.findUnique({ where: { kode } })
    await prisma.tarifGolongan.upsert({
      where: { kode },
      create: { kode, kodeAsli, nama, kategori: deriveKategori(kodeAsli) },
      update: { kodeAsli, nama, kategori: deriveKategori(kodeAsli) },
    })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }
}
