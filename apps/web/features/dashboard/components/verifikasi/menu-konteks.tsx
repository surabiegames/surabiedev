"use client"

// features/dashboard/components/verifikasi/menu-konteks.tsx — menu aksi
// klik kanan pada baris grid verifikasi. AG Grid menangani event contextmenu
// sendiri (bukan lewat elemen trigger React), jadi dipakai DropdownMenu
// terkontrol yang di-anchor ke titik kursor lewat trigger tak kasatmata —
// bukan Radix ContextMenu yang menuntut membungkus elemen pemicunya.
import type { LucideIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

export interface AksiKonteks {
  label: string
  icon?: LucideIcon
  onPilih: () => void
  /** Aksi tampil tapi tidak bisa dijalankan; `keterangan` menjelaskan kenapa. */
  disabled?: boolean
  keterangan?: string
  destruktif?: boolean
  /** Garis pemisah SEBELUM item ini. */
  pemisah?: boolean
}

export function MenuKonteks({
  posisi,
  judul,
  aksi,
  onTutup,
}: {
  /** Koordinat viewport titik klik kanan; null = menu tertutup. */
  posisi: { x: number; y: number } | null
  /** Identitas baris (mis. nomor langganan) di kepala menu. */
  judul?: string
  aksi: AksiKonteks[]
  onTutup: () => void
}) {
  if (!posisi) return null

  return (
    <DropdownMenu open onOpenChange={(buka) => !buka && onTutup()}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          className="block size-0"
          style={{ position: "fixed", left: posisi.x, top: posisi.y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" sideOffset={2} className="w-64">
        {judul && (
          <>
            <DropdownMenuLabel className="font-mono text-[11px] text-muted-foreground">
              {judul}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {aksi.map((a) => (
          <div key={a.label}>
            {a.pemisah && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={a.disabled}
              variant={a.destruktif ? "destructive" : "default"}
              onSelect={a.onPilih}
            >
              {a.icon && <a.icon className="size-3.5" />}
              <span className="flex min-w-0 flex-col">
                <span>{a.label}</span>
                {a.keterangan && (
                  <span className="text-[10px] leading-tight text-muted-foreground">
                    {a.keterangan}
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
