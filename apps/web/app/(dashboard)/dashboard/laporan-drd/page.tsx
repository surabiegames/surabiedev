// app/(dashboard)/dashboard/laporan-drd/page.tsx — /dashboard/laporan-drd
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { LaporanDrd } from "@/features/dashboard/components/laporan/laporan-drd"
import { UnduhDrd } from "@/features/dashboard/components/laporan/unduh-drd"
import { ambilRiwayatPeriode } from "@/features/dashboard/lib/queries"

export const metadata: Metadata = { title: "Laporan DRD" }

export default async function LaporanDrdPage() {
  // Hanya periode TERKUNCI yang boleh diekspor — daftarnya dibaca di server
  // supaya tombolnya sudah siap saat halaman tampil, bukan setelah request
  // kedua dari browser.
  const periode = (await ambilRiwayatPeriode()).filter((p) => p.status === "TERKUNCI")

  return (
    <HalamanDasbor
      eyebrow="Laporan"
      judul="Daftar Rekening Ditagih (DRD)"
      deskripsi="Rekap dan rincian seluruh rekening air yang ditagihkan per periode"
      aksi={<UnduhDrd periode={periode.map((p) => p.periode)} />}
    >
      <LaporanDrd />
    </HalamanDasbor>
  )
}
