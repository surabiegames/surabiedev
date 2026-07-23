// app/(dashboard)/dashboard/pengguna/page.tsx — /dashboard/pengguna
// Endpoint /users adalah MANAGEMENT_UP — menu ini pun hanya tampil untuk
// role tersebut; server tetap penjaga aslinya.
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { PenggunaGrid } from "@/features/dashboard/components/grids/pengguna-grid"

export const metadata: Metadata = { title: "Pengguna & akses" }

export default function PenggunaPage() {
  return (
    <HalamanDasbor
      eyebrow="Administrasi"
      judul="Pengguna & akses"
      deskripsi="Akun petugas & manajemen — akun dibuat administrator, tidak ada pendaftaran mandiri."
    >
      <PenggunaGrid />
    </HalamanDasbor>
  )
}
