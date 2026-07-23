import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Paket workspace mengekspor source .ts mentah (bukan build) — Next wajib
  // ikut men-transpile-nya, kalau tidak impor @workspace/* gagal saat build.
  transpilePackages: [
    "@workspace/ui",
    "@workspace/auth",
    "@workspace/db",
    "@workspace/domain",
  ],
}

export default nextConfig
