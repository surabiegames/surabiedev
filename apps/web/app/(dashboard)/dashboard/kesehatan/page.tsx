// app/(dashboard)/dashboard/kesehatan/page.tsx — /dashboard/kesehatan
//
// Pemeriksaan dijalankan DI SERVER untuk render awal (alasan sama seperti
// halaman dasbor lain: halaman ini dirender di server yang sama dengan
// API-nya, jadi tidak perlu perjalanan HTTP ke diri sendiri). Halaman tetap
// bisa memeriksa ulang lewat /api/v1/kesehatan setelah perbaikan.
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@workspace/auth"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { KesehatanClient } from "@/features/dashboard/components/kesehatan/kesehatan-client"
import { ambilLaporanKesehatan } from "@/features/dashboard/lib/queries"

export const metadata: Metadata = { title: "Kesehatan data" }

export default async function KesehatanPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const laporanAwal = await ambilLaporanKesehatan()

  return (
    <HalamanDasbor
      eyebrow="Sistem"
      judul="Kesehatan data"
      deskripsi="Memeriksa apakah data di aplikasi ini bisa dipertanggungjawabkan sebagai dasar penagihan. Yang berkaitan dengan angka uang dan status pelanggan sengaja TIDAK diperbaiki mesin — hanya ditunjukkan untuk diputuskan manusia."
    >
      <KesehatanClient role={session.user.role} laporanAwal={laporanAwal} />
    </HalamanDasbor>
  )
}
