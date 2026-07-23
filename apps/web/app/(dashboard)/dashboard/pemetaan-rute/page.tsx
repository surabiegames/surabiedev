// app/(dashboard)/dashboard/pemetaan-rute/page.tsx — /dashboard/pemetaan-rute
//
// Pemetaan rute↔petugas yang PERMANEN (berlaku tiap periode tanpa admin
// mengatur ulang), banyak rute per petugas, berurut, dan rute boleh dibagi.
// Menggantikan dialog penugasan rute tunggal di halaman Organisasi.
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { PemetaanRuteClient } from "@/features/dashboard/components/pemetaan-rute/pemetaan-rute-client"

export const metadata: Metadata = { title: "Pemetaan rute" }

export default function PemetaanRutePage() {
  return (
    <HalamanDasbor
      eyebrow="Operasional Lapangan"
      judul="Pemetaan rute"
      deskripsi="Tetapkan rute baca meter ke tiap petugas beserta urutan kerjanya. Berlaku otomatis tiap periode; satu rute boleh dibagi ke beberapa petugas (mis. pengganti saat cuti)."
    >
      <PemetaanRuteClient />
    </HalamanDasbor>
  )
}
