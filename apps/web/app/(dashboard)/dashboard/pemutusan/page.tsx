// app/(dashboard)/dashboard/pemutusan/page.tsx — /dashboard/pemutusan
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { PemutusanGrid } from "@/features/dashboard/components/grids/pemutusan-grid"

export const metadata: Metadata = { title: "Pemutusan" }

export default function PemutusanPage() {
  return (
    <HalamanDasbor
      eyebrow="Pelanggan & Sambungan"
      judul="Pemutusan sambungan"
      deskripsi="Tutup sementara dan SPT — data pemutusan tidak pernah mengubah status pelanggan secara otomatis."
    >
      <PemutusanGrid />
    </HalamanDasbor>
  )
}
