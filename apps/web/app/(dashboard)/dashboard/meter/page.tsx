// app/(dashboard)/dashboard/meter/page.tsx — /dashboard/meter
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { MeterGrid } from "@/features/dashboard/components/grids/meter-grid"

export const metadata: Metadata = { title: "Meter" }

export default function MeterPage() {
  return (
    <HalamanDasbor
      eyebrow="Pelanggan & Sambungan"
      judul="Aset meter"
      deskripsi="Meter terpasang beserta histori penggantiannya — satu pelanggan bisa punya beberapa baris; hanya satu yang berstatus aktif."
    >
      <MeterGrid />
    </HalamanDasbor>
  )
}
