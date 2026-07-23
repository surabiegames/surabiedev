// app/page.tsx — beranda publik (landing page).
//
// Dulu route ini hanya redirect ke /dashboard atau /login; sekarang menjadi
// wajah publik sistem: pintu masuk warga ke cek-tagihan/lapor-meter/
// pengaduan. Petugas tidak lagi dilempar otomatis — header menampilkan
// "Buka Dasbor" bila sudah bersesi, dan /login tetap satu klik.
//
// Page tipis sesuai FRONTEND.md: baca sesi, rakit seksi dari
// features/beranda. Seluruh JSX panjang ada di sana.
import type { Metadata } from "next"
import { Suspense } from "react"
import { auth } from "@workspace/auth"
import { SiteHeader } from "@/features/beranda/components/site-header"
import { Hero } from "@/features/beranda/components/hero"
import { StatsStrip, StatsStripSkeleton } from "@/features/beranda/components/stats-strip"
import { KanalPembayaran } from "@/features/beranda/components/kanal-pembayaran"
import { LayananShowcase } from "@/features/beranda/components/layanan-showcase"
import { BentoKeandalan } from "@/features/beranda/components/bento-keandalan"
import { CtaBand } from "@/features/beranda/components/cta-band"
import { SiteFooter } from "@/features/beranda/components/site-footer"

export const metadata: Metadata = {
  title: "Layanan Pelanggan Air Minum Kota Bandung",
  description:
    "Cek tagihan air, lapor angka meter mandiri, dan sampaikan pengaduan gangguan ke PERUMDA Tirtawening Kota Bandung — daring, 24 jam, tanpa akun.",
  robots: { index: true, follow: true },
}

export default async function BerandaPage() {
  const session = await auth()

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader sesiPetugas={!!session?.user} />
      <main className="flex-1">
        <Hero />
        {/* Suspense: hero tampil seketika, angka menyusul — query statistik
            tidak boleh menahan first paint halaman publik. */}
        <Suspense fallback={<StatsStripSkeleton />}>
          <StatsStrip />
        </Suspense>
        <LayananShowcase />
        <BentoKeandalan />
        <KanalPembayaran />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  )
}
