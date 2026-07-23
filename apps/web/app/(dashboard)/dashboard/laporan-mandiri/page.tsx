// app/(dashboard)/dashboard/laporan-mandiri/page.tsx — /dashboard/laporan-mandiri
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { LaporanMandiriGrid } from "@/features/dashboard/components/grids/laporan-mandiri-grid"

export const metadata: Metadata = { title: "Laporan mandiri" }

export default function LaporanMandiriPage() {
  return (
    <HalamanDasbor
      eyebrow="Operasional Lapangan"
      judul="Laporan meter mandiri"
      deskripsi="Kiriman warga dari halaman publik — berstatus menunggu sampai diverifikasi petugas, baru menjadi pencatatan resmi."
    >
      <LaporanMandiriGrid />
    </HalamanDasbor>
  )
}
