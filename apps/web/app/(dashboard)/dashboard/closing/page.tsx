// app/(dashboard)/dashboard/closing/page.tsx — /dashboard/closing
//
// Halaman tipis sesuai FRONTEND.md: baca sesi, oper role, seluruh interaksi
// ada di features/dashboard/components/closing.
//
// Role dibaca DI SINI dan dioper ke client hanya untuk menyembunyikan tombol
// yang tidak berlaku. Penjagaan sesungguhnya tetap di router API
// (requireRole SENIOR_UP untuk tutup, ADMIN untuk buka) — menyembunyikan
// tombol bukan otorisasi.
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@workspace/auth"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { ClosingClient } from "@/features/dashboard/components/closing/closing-client"
import { ambilRiwayatPeriode } from "@/features/dashboard/lib/queries"

export const metadata: Metadata = { title: "Closing periode" }

export default async function ClosingPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const riwayatAwal = await ambilRiwayatPeriode()

  return (
    <HalamanDasbor
      eyebrow="Penagihan"
      judul="Closing periode"
      deskripsi="Menerbitkan tagihan resmi satu periode sekaligus lalu menguncinya. Nominal selalu dihitung ulang dari tarif yang berlaku — tidak pernah datang dari layar ini. Tagihan yang sudah ada tidak akan ditimpa."
    >
      <ClosingClient role={session.user.role} riwayatAwal={riwayatAwal} />
    </HalamanDasbor>
  )
}
