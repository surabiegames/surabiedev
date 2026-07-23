"use client"

// features/dashboard/components/user-menu.tsx — avatar + menu keluar di
// header dashboard.
import { LogOut } from "lucide-react"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

/// Inisial dari nama ("Wiska Prayoga" -> "WP"). Fallback ke email bila nama
/// kosong — akun bisa dibuat tanpa nama lewat POST /api/v1/users.
function inisial(nama: string | null, email: string): string {
  const sumber = nama?.trim() || email
  const kata = sumber.split(/[\s@.]+/).filter(Boolean)
  return (kata[0]?.[0] ?? "?").concat(kata[1]?.[0] ?? "").toUpperCase()
}

export function UserMenu({
  nama,
  email,
  role,
  onKeluar,
}: {
  nama: string | null
  email: string
  role: string
  // Server action dioper dari layout — komponen ini tidak mengimpor `auth`
  // (yang akan menyeret Prisma ke bundle client).
  onKeluar: () => Promise<void>
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menu akun">
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">{inisial(nama, email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col items-start gap-0.5">
          <span className="w-full truncate text-sm font-medium">{nama ?? email}</span>
          <span className="w-full truncate text-xs font-normal text-muted-foreground">{email}</span>
          <span className="mt-1.5 border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-primary uppercase">
            {role.replaceAll("_", " ")}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={onKeluar}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut />
              Keluar
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
