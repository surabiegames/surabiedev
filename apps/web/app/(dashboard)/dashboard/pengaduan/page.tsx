// app/(dashboard)/dashboard/pengaduan/page.tsx — /dashboard/pengaduan
//
// Menerima ?q= (mis. nomor tiket dari panel "Perlu tindakan" di Ringkasan)
// sebagai isi awal kotak pencarian grid.
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { PapanPengaduan } from "@/features/dashboard/components/pengaduan/papan-pengaduan"

export const metadata: Metadata = { title: "Pengaduan" }

export default async function PengaduanPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  return (
    <HalamanDasbor
      eyebrow="Operasional Lapangan"
      judul="Pengaduan warga"
      deskripsi="Klik satu baris untuk menangani tiketnya — tugaskan petugas, catat tindak lanjut, ubah status. Prioritas darurat/tinggi dan tiket lewat tenggat ditangani lebih dulu."
    >
      <PapanPengaduan initialQ={q} />
    </HalamanDasbor>
  )
}
