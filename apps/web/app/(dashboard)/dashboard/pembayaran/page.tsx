// app/(dashboard)/dashboard/pembayaran/page.tsx — /dashboard/pembayaran
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { PembayaranGrid } from "@/features/dashboard/components/grids/pembayaran-grid"

export const metadata: Metadata = { title: "Pembayaran" }

export default function PembayaranPage() {
  return (
    <HalamanDasbor
      eyebrow="Penagihan"
      judul="Ledger pembayaran"
      deskripsi="Setiap PERCOBAAN pembayaran tercatat — termasuk transaksi PPOB yang masih pending atau kedaluwarsa."
    >
      <PembayaranGrid />
    </HalamanDasbor>
  )
}
