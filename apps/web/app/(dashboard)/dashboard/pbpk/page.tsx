// app/(dashboard)/dashboard/pbpk/page.tsx — /dashboard/pbpk
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@workspace/auth"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { PbpkClient } from "@/features/dashboard/components/pbpk/pbpk-client"

export const metadata: Metadata = { title: "Impor PBPK" }

export default async function PbpkPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <HalamanDasbor
      eyebrow="Pelanggan & Sambungan"
      judul="Impor PBPK"
      deskripsi="Pasang baru & pasang kembali — pintu masuk sambungan baru ke siklus penagihan. Sambungan dicatat bulan ini dengan stand nol dan mulai ditagih bulan berikutnya. Pratinjau dulu; nomor yang sudah ada tidak ditimpa."
    >
      <PbpkClient role={session.user.role} />
    </HalamanDasbor>
  )
}
