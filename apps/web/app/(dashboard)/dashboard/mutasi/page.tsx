// app/(dashboard)/dashboard/mutasi/page.tsx — /dashboard/mutasi
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { MutasiGrid } from "@/features/dashboard/components/grids/mutasi-grid"

export const metadata: Metadata = { title: "Mutasi" }

export default function MutasiPage() {
  return (
    <HalamanDasbor
      eyebrow="Pelanggan & Sambungan"
      judul="Riwayat mutasi pelanggan"
      deskripsi="Arsip pasang baru (PB) dan pasang kembali (PK) per periode — hanya dibaca. Pemetaan sambungan barunya dikerjakan di layar Mutasi PBPK."
    >
      <MutasiGrid />
    </HalamanDasbor>
  )
}
