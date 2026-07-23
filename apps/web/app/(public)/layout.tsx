// app/(public)/layout.tsx — kerangka halaman untuk WARGA/PELANGGAN (tanpa
// login).
//
// Route group `(public)` tidak menjadi segmen URL — halaman di dalamnya
// tetap /cek-tagihan, /pengaduan, /lapor-meter. Header + footer dipakai
// BERSAMA dengan landing page (features/beranda) supaya seluruh permukaan
// publik terasa satu situs — jangan membuat header kedua di sini.
import type { Metadata } from "next"
import { auth } from "@workspace/auth"
import { SiteHeader } from "@/features/beranda/components/site-header"
import { SiteFooter } from "@/features/beranda/components/site-footer"

export const metadata: Metadata = {
  // Halaman publik BOLEH diindeks — justru harus mudah ditemukan warga.
  // (Kebalikan dari app/(auth)/layout.tsx yang robots: index=false.)
  robots: { index: true, follow: true },
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Hanya untuk tombol header ("Masuk Petugas" vs "Buka Dasbor") — sesi JWT
  // dibaca dari cookie, tanpa query database.
  const session = await auth()

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader sesiPetugas={!!session?.user} />
      {/* Tanpa max-w di sini: tiap halaman memakai HalamanPublik
          (features/publik/components/halaman-publik.tsx) yang membawa pita
          judul full-bleed + kontainer max-w-6xl — grammar yang sama dengan
          seksi-seksi beranda. */}
      <main className="flex-1">{children}</main>
      <div className="border-t border-border/70">
        <SiteFooter />
      </div>
    </div>
  )
}
