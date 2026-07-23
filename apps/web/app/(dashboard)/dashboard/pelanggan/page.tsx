// app/(dashboard)/dashboard/pelanggan/page.tsx — /dashboard/pelanggan
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { PelangganGrid } from "@/features/dashboard/components/grids/pelanggan-grid"

export const metadata: Metadata = { title: "Data pelanggan" }

export default function PelangganPage() {
  return (
    <HalamanDasbor
      eyebrow="Pelanggan & Sambungan"
      judul="Data pelanggan"
      deskripsi="Seluruh sambungan terdaftar — cari berdasarkan nama, nomor langganan, atau alamat."
    >
      <PelangganGrid />
    </HalamanDasbor>
  )
}
