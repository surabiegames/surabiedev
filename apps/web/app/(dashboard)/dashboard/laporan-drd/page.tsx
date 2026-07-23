// app/(dashboard)/dashboard/laporan-drd/page.tsx — /dashboard/laporan-drd
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { LaporanDrd } from "@/features/dashboard/components/laporan/laporan-drd"

export const metadata: Metadata = { title: "Laporan DRD" }

export default function LaporanDrdPage() {
  return (
    <HalamanDasbor
      eyebrow="Laporan"
      judul="Daftar Rekening Ditagih (DRD)"
      deskripsi="Rekap dan rincian seluruh rekening air yang ditagihkan per periode"
    >
      <LaporanDrd />
    </HalamanDasbor>
  )
}
