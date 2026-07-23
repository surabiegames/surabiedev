// app/(dashboard)/dashboard/konfigurasi/page.tsx — /dashboard/konfigurasi
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { KonfigurasiGrid } from "@/features/dashboard/components/grids/konfigurasi-grid"

export const metadata: Metadata = { title: "Konfigurasi" }

export default function KonfigurasiPage() {
  return (
    <HalamanDasbor
      eyebrow="Administrasi"
      judul="Konfigurasi sistem"
      deskripsi="Pasangan kunci-nilai runtime. Nilai rahasia disamarkan server untuk semua kecuali SUPER_ADMIN."
    >
      <KonfigurasiGrid />
    </HalamanDasbor>
  )
}
