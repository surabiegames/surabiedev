// app/akun/page.tsx — /akun, portal warga: daftar laporan pengaduan miliknya.
import type { Metadata } from "next"
import { auth } from "@workspace/auth"
import { ambilTiketSaya } from "@/features/akun/lib/queries"
import { RiwayatSaya } from "@/features/akun/components/riwayat-saya"

export const metadata: Metadata = { title: "Laporan Saya" }

export default async function AkunPage() {
  // Layout sudah menjamin sesi ada (redirect ke /login kalau tidak) — di
  // sini hanya menyempitkan tipe, bukan pengecekan kedua.
  const session = await auth()
  const tiket = await ambilTiketSaya(session!.user.id)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Laporan Saya</h1>
        <p className="text-sm text-muted-foreground">
          Semua pengaduan yang Anda kirim saat sedang masuk ke akun ini — klik satu baris untuk melihat
          perkembangannya.
        </p>
      </div>
      <RiwayatSaya tiket={tiket} />
    </div>
  )
}
