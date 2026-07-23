// app/(dashboard)/layout.tsx — kerangka dashboard internal: sidebar + header.
//
// Route group `(dashboard)`: URL-nya tetap /dashboard/*. Pola sama seperti
// (auth) & (public) — lihat FRONTEND.md.
//
// PENJAGAAN BERLAPIS, dan itu disengaja:
//   1. proxy.ts (edge) menggerbangi /dashboard lebih dulu — pengunjung tanpa
//      sesi tidak sampai ke sini.
//   2. Layout ini TETAP memanggil auth() dan redirect sendiri.
// Nomor 2 bukan mubazir: middleware hanya memeriksa keberadaan cookie sesi
// di edge (tanpa akses Prisma), dan kalau matcher proxy.ts kelak diubah,
// halaman ini tidak boleh ikut terbuka diam-diam. Selain itu kita memang
// butuh data user-nya di sini.
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowUpRight } from "lucide-react"
import { auth, signOut } from "@workspace/auth"
import { Button } from "@workspace/ui/components/button"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@workspace/ui/components/sidebar"

import { ThemeToggle } from "@/components/theme-toggle"
import { AppSidebar } from "@/features/dashboard/components/app-sidebar"
import { UserMenu } from "@/features/dashboard/components/user-menu"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  // role USER = akun warga mandiri lewat /daftar, bukan staf — dashboard
  // ini dibangun untuk peran internal (STAFF ke atas). Sebelum akun
  // self-service ada, role USER hanya dibuat admin (kasus langka), jadi
  // celah ini belum pernah tereksploitasi; SEKARANG wajib dijaga eksplisit,
  // bukan cuma "session ada" seperti di atas — kalau tidak, warga yang
  // login akan sampai ke SHELL dashboard staf (sidebar boleh saja
  // menyembunyikan menu berdasarkan role, tapi query data server component
  // di bawah /dashboard tidak semuanya mengecek role).
  if (session.user.role === "USER") redirect("/akun")

  const { name, email, role } = session.user

  return (
    <SidebarProvider>
      <AppSidebar role={role} />

      <SidebarInset className="h-dvh overflow-hidden">
        {/* sticky: daftar pelanggan bisa ribuan baris — header (dan tombol
            sidebar di layar kecil) harus tetap terjangkau saat menggulir.
            backdrop-blur + bg semi transparan: grammar yang sama dengan
            SiteHeader di permukaan publik.
            (shrink-0 sudah ada di bawah — dengan SidebarInset sekarang
            h-dvh+overflow-hidden, header ini otomatis "diam" di atas
            tanpa perlu sticky lagi, tapi sticky tetap aman dibiarkan.) */}
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <SidebarTrigger className="-ml-1" />
          <div aria-hidden="true" className="h-5 w-px bg-border" />
          <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase max-sm:hidden">
            Sistem Informasi Pelayanan
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground max-md:hidden">
              <Link href="/" target="_blank">
                Situs publik
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
            <ThemeToggle />
            <div aria-hidden="true" className="h-5 w-px bg-border" />
            <UserMenu
              nama={name ?? null}
              email={email ?? ""}
              role={role}
              onKeluar={async () => {
                "use server"
                await signOut({ redirectTo: "/login" })
              }}
            />
          </div>
        </header>

        {/* min-h-0 + overflow-hidden BARU: dulu div ini cuma flex-1 tanpa
            batas, jadi kalau isinya (children) lebih tinggi dari sisa
            layar, div ini (dan SidebarInset di atasnya) ikut membengkak
            dan <body> yang scroll. Sekarang dia dipaksa PAS sisa ruang
            setelah header 56px; halaman anak (mis. VerifikasiLapangan)
            yang wajib mengatur scroll internalnya sendiri lewat h-full. */}
        <div className="min-h-0 flex-1 overflow-hidden p-4 md:p-6 lg:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}