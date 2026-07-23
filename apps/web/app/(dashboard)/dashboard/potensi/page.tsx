// app/(dashboard)/dashboard/potensi/page.tsx — /dashboard/potensi
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { PotensiGrid } from "@/features/dashboard/components/grids/potensi-grid"

export const metadata: Metadata = { title: "Potensi pelanggan" }

export default function PotensiPage() {
  return (
    <HalamanDasbor
      eyebrow="Pelanggan & Sambungan"
      judul="Potensi pelanggan baru"
      deskripsi="Prospek hasil survei lapangan — kandidat sambungan baru beserta status tindak lanjutnya."
    >
      <PotensiGrid />
    </HalamanDasbor>
  )
}
