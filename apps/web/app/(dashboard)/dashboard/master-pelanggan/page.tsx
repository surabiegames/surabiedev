// app/(dashboard)/dashboard/master-pelanggan/page.tsx — /dashboard/master-pelanggan
//
// Halaman tipis: baca sesi, oper role, seluruh interaksi ada di
// features/dashboard/components/master-pelanggan.
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@workspace/auth"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { MasterPelangganClient } from "@/features/dashboard/components/master-pelanggan/master-pelanggan-client"

export const metadata: Metadata = { title: "Rekonsiliasi data induk" }

export default async function MasterPelangganPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <HalamanDasbor
      eyebrow="Data Induk"
      judul="Rekonsiliasi data induk"
      deskripsi="ALAT TRANSISI, bukan langkah bulanan. Data induk pelanggan aplikasi ini berdiri sendiri — siklus closing tidak membaca satu pun berkas luar. Halaman ini hanya untuk mencocokkan populasi saat pindah dari sistem lama, dan membetulkan data yang telanjur terimpor salah."
    >
      <MasterPelangganClient role={session.user.role} />
    </HalamanDasbor>
  )
}
