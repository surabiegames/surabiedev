// app/(dashboard)/dashboard/laporan-harian/page.tsx — /dashboard/laporan-harian
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { LaporanHarianGrid } from "@/features/dashboard/components/grids/laporan-harian-grid"

export const metadata: Metadata = { title: "Laporan harian petugas" }

export default function LaporanHarianPage() {
  return (
    <HalamanDasbor
      eyebrow="Operasional Lapangan"
      judul="Laporan harian petugas"
      deskripsi="Setoran baca meter petugas lapangan sebelum verifikasi dan closing bulanan."
    >
      <LaporanHarianGrid />
    </HalamanDasbor>
  )
}
