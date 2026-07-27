import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Paket workspace mengekspor source .ts mentah (bukan build) — Next wajib
  // ikut men-transpile-nya, kalau tidak impor @workspace/* gagal saat build.
  transpilePackages: [
    "@workspace/ui",
    "@workspace/auth",
    "@workspace/db",
    "@workspace/domain",
    // "@workspace/server" WAJIB ikut. Ia mengekspor .ts mentah seperti paket
    // workspace lain, dan halaman dashboard mengimpor service-nya langsung
    // (mis. pemeriksaan kesehatan data di features/dashboard/lib/queries.ts).
    // Tanpa baris ini dev server gagal dengan "Module not found: Can't
    // resolve '@workspace/server/kesehatan'" — route /api/[[...route]] kebetulan
    // selamat karena Next memperlakukan route handler berbeda, sehingga
    // kekurangannya baru terlihat setelah ada halaman yang mengimpornya.
    "@workspace/server",
  ],
}

export default nextConfig
