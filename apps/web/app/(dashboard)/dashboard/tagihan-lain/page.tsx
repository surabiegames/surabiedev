// app/(dashboard)/dashboard/tagihan-lain/page.tsx — /dashboard/tagihan-lain
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { TagihanLainGrid } from "@/features/dashboard/components/grids/tagihan-lain-grid"

export const metadata: Metadata = { title: "Tagihan non-air" }

export default function TagihanLainPage() {
  return (
    <HalamanDasbor
      eyebrow="Penagihan"
      judul="Tagihan non-air"
      deskripsi="Pungutan insidental di luar siklus bulanan: pasang baru, balik nama, ganti meter, denda pelanggaran."
    >
      <TagihanLainGrid />
    </HalamanDasbor>
  )
}
