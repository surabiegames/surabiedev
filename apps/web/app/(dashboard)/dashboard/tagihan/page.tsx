// app/(dashboard)/dashboard/tagihan/page.tsx — /dashboard/tagihan
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { TagihanGrid } from "@/features/dashboard/components/grids/tagihan-grid"

export const metadata: Metadata = { title: "Tagihan air" }

export default function TagihanPage() {
  return (
    <HalamanDasbor
      eyebrow="Penagihan"
      judul="Tagihan air periodik"
      deskripsi="Rekening air bulanan — pelunasan hanya lewat konfirmasi pembayaran supaya setiap pelunasan punya jejak ledger."
    >
      <TagihanGrid />
    </HalamanDasbor>
  )
}
