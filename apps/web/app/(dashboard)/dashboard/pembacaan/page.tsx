// app/(dashboard)/dashboard/pembacaan/page.tsx — /dashboard/pembacaan
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { PembacaanGrid } from "@/features/dashboard/components/grids/pembacaan-grid"

export const metadata: Metadata = { title: "Pembacaan meter" }

export default function PembacaanPage() {
  return (
    <HalamanDasbor
      eyebrow="Penagihan"
      judul="Pembacaan meter resmi"
      deskripsi="Hasil closing bulanan yang menjadi dasar perhitungan tagihan — satu baris per meter per periode."
    >
      <PembacaanGrid />
    </HalamanDasbor>
  )
}
