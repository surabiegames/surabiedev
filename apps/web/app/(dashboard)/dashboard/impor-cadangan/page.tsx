// app/(dashboard)/dashboard/impor-cadangan/page.tsx — /dashboard/impor-cadangan
//
// Impor cadangan lapangan: admin mengunggah ZIP cadangan yang diekspor
// aplikasi petugas (bundel catatan.json + foto per pembacaan) → jadi laporan
// harian. Penyelamat bila perangkat/DB petugas rusak sebelum sempat upload.
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { ImporCadanganClient } from "@/features/dashboard/components/impor-cadangan/impor-cadangan-client"

export const metadata: Metadata = { title: "Impor cadangan lapangan" }

export default function ImporCadanganPage() {
  return (
    <HalamanDasbor
      eyebrow="Operasional Lapangan"
      judul="Impor cadangan lapangan"
      deskripsi="Ubah berkas cadangan (ZIP) dari aplikasi petugas menjadi laporan harian. Idempoten — aman diimpor berulang; pembacaan yang sudah ada ditandai duplikat."
    >
      <ImporCadanganClient />
    </HalamanDasbor>
  )
}
