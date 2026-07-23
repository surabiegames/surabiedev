// app/(dashboard)/dashboard/tarif/page.tsx — /dashboard/tarif
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { TarifGrid } from "@/features/dashboard/components/grids/tarif-grid"

export const metadata: Metadata = { title: "Golongan tarif" }

export default function TarifPage() {
  return (
    <HalamanDasbor
      eyebrow="Data Induk"
      judul="Golongan tarif"
      deskripsi="Klasifikasi tarif pelanggan. Blok tarif progresif per golongan diubah lewat API — perubahan tarif selalu baris baru, bukan menimpa histori."
    >
      <TarifGrid />
    </HalamanDasbor>
  )
}
