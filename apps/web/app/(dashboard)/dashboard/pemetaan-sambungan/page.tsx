// app/(dashboard)/dashboard/pemetaan-sambungan/page.tsx
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@workspace/auth"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import {
  PemetaanSambunganClient,
  type DataPerluRute,
} from "@/features/dashboard/components/pemetaan-sambungan/pemetaan-sambungan-client"
import { ambilSambunganPerluRute } from "@/features/dashboard/lib/queries"

export const metadata: Metadata = { title: "Mutasi PBPK" }

export default async function PemetaanSambunganPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const dataAwal: DataPerluRute = await ambilSambunganPerluRute()

  return (
    <HalamanDasbor
      eyebrow="Pelanggan & Sambungan"
      judul="Mutasi PBPK"
      deskripsi="Sambungan baru periode berjalan: petakan ke rute & petugas, lalu isi pencatatan awalnya. Ikut ditampilkan sambungan lama yang rutenya belum berpetugas — akibatnya sama: tidak dikunjungi, tidak dicatat, tidak tertagih."
    >
      <PemetaanSambunganClient role={session.user.role} dataAwal={dataAwal} />
    </HalamanDasbor>
  )
}
