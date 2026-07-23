// prisma/seed/index.ts — orkestrator seed. Dijalankan via `pnpm db:seed`
// atau `npx prisma db seed` (lihat migrations.seed di prisma.config.ts).
//
// URUTAN STEP MENGIKUTI DEPENDENSI FK — jangan diacak:
//   01 referensi (Divisi, TarifGolongan)
//   02 wilayah (WilayahAdm..Zona, Kecamatan/Kelurahan)
//   03 golongan besar + DMA
//   04 pencatat
//   05 Pelanggan (butuh 01-04)                <- status-sensitive, lihat lib/status.ts
//   06 Meter + PembacaanMeter + Tagihan (butuh 05)
//   07 LaporanHarianPetugas (butuh 05, opsional 06)
//   08 MutasiPelanggan (butuh 05)
//   09 Pemutusan (butuh 05, TIDAK PERNAH mengubah Pelanggan.status)
//
// SETIAP step dibungkus try/catch level-atas di sini SEBAGAI TAMBAHAN dari
// penanganan per-baris di masing-masing step — kalau satu step gagal total
// (mis. file CSV hilang), step-step lain tetap lanjut jalan alih-alih
// seluruh proses berhenti. Semua upsert bersifat idempoten (aman dijalankan
// berkali-kali, lihat komentar di tiap steps/*.ts) sehingga re-run setelah
// error parsial tidak akan membuat duplikat.

import { prisma } from "./lib/db"
import { SeedReport } from "./lib/report"
import { seedReferensi } from "./steps/01-referensi"
import { seedWilayah } from "./steps/02-wilayah"
import { seedGolonganBesarDma } from "./steps/03-golongan-besar-dma"
import { seedPencatat } from "./steps/04-pencatat"
import { seedPelanggan } from "./steps/05-pelanggan"
import { seedMeterPembacaanTagihan } from "./steps/06-meter-pembacaan-tagihan"
import { seedLaporanHarian } from "./steps/07-laporan-harian"
import { seedMutasi } from "./steps/08-mutasi"
import { seedPemutusan } from "./steps/09-pemutusan"
import { seedGeometri } from "./steps/10-geometri"

const STEPS: Array<{ name: string; run: (report: SeedReport) => Promise<void> }> = [
  { name: "01-referensi", run: (r) => seedReferensi(prisma, r) },
  { name: "02-wilayah", run: (r) => seedWilayah(prisma, r) },
  { name: "03-golongan-besar-dma", run: (r) => seedGolonganBesarDma(prisma, r) },
  { name: "04-pencatat", run: (r) => seedPencatat(prisma, r) },
  { name: "05-pelanggan", run: (r) => seedPelanggan(prisma, r) },
  { name: "06-meter-pembacaan-tagihan", run: (r) => seedMeterPembacaanTagihan(prisma, r) },
  { name: "07-laporan-harian", run: (r) => seedLaporanHarian(prisma, r) },
  { name: "08-mutasi", run: (r) => seedMutasi(prisma, r) },
  { name: "09-pemutusan", run: (r) => seedPemutusan(prisma, r) },
  // Terakhir: geometri PostGIS (area kelurahan/kecamatan + koordinat
  // pelanggan dari GeoJSON) — butuh baris kelurahan (02) & pelanggan (05)
  // sudah ada untuk dicocokkan.
  { name: "10-geometri", run: (r) => seedGeometri(prisma, r) },
]

async function main(): Promise<void> {
  const report = new SeedReport()

  for (const step of STEPS) {
    const startedAt = Date.now()
    console.log(`\n>>> ${step.name} ...`)
    try {
      await step.run(report)
      console.log(`<<< ${step.name} selesai (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`)
    } catch (err) {
      // Jaring pengaman level-step: satu step gagal total TIDAK
      // menghentikan step lain. Error per-baris di dalam step sendiri
      // sudah ditangani di masing-masing steps/*.ts.
      report.error(step.name, `Step gagal total: ${(err as Error).message}`)
      console.error(`!!! ${step.name} GAGAL:`, err)
    }
  }

  report.printSummary()
  const reportPath = report.writeToFile()
  console.log(`Laporan lengkap: ${reportPath}`)

  await prisma.$disconnect()

  if (report.errorCount > 0) {
    process.exitCode = 1
  }
}

main().catch(async (err) => {
  console.error("Seed gagal fatal:", err)
  await prisma.$disconnect()
  process.exitCode = 1
})
