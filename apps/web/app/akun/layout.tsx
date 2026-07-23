// app/akun/layout.tsx — kerangka portal akun warga (/akun/*): header ringkas
// + guard sesi. Beda dari (dashboard) yang penuh sidebar staf — ini untuk
// warga/pelapor biasa (role USER), jadi tampilannya dekat ke permukaan
// publik, bukan dashboard operasional.
//
// PENJAGAAN BERLAPIS, pola sama seperti (dashboard)/layout.tsx:
//   1. proxy.ts (edge) menggerbangi /akun lebih dulu.
//   2. Layout ini TETAP memanggil auth() dan redirect sendiri, untuk kasus
//      matcher proxy.ts kelak berubah, dan karena kita memang butuh data
//      user-nya di sini.
import Link from "next/link"
import { redirect } from "next/navigation"
import { auth, signOut } from "@workspace/auth"
import { AppLogo } from "@/components/app-logo"
import { Button } from "@workspace/ui/components/button"
import { ThemeToggle } from "@/components/theme-toggle"

export default async function AkunLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/login?callbackUrl=/akun")

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/70">
        <Link href="/" className="flex items-center">
          <AppLogo />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {session.user.name ?? session.user.email}
          </span>
          <ThemeToggle />
          <div aria-hidden="true" className="h-5 w-px bg-border" />
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/" })
            }}
          >
            <Button type="submit" variant="ghost" size="sm">
              Keluar
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 p-4 md:p-6">{children}</main>
    </div>
  )
}
