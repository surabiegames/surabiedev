"use client"

// features/dashboard/components/verifikasi/panel-bagian.tsx — potongan kecil
// yang dipakai kedua panel verifikasi (lapangan & mandiri): micro-label
// bagian, grid stand 3 kolom, badge status, dan empty state panel.
import { type LucideIcon } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

export function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{judul}</p>
      {children}
    </div>
  )
}

/// Kelas kolom ditulis utuh, bukan dirangkai (`grid-cols-${n}`) — Tailwind
/// memindai source secara statis, kelas hasil interpolasi tidak ikut ter-generate.
const KOLOM_GRID: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
}

export interface SelStand {
  label: string
  nilai: number
}

/// Murni penampil angka — panel kiri tidak punya aksi; koreksi/verifikasi
/// dipicu dari menu klik kanan pada baris tabel.
export function GridStand({ sel }: { sel: SelStand[] }) {
  return (
    <div className={cn("grid gap-px border border-border/70 bg-border/70", KOLOM_GRID[sel.length] ?? "grid-cols-3")}>
      {sel.map((s) => (
        <div key={s.label} className="bg-muted/30 px-2.5 py-2" title={s.nilai.toLocaleString("id-ID")}>
          <p className="text-[9px] font-semibold tracking-widest text-muted-foreground uppercase">{s.label}</p>
          <p className="mt-0.5 truncate font-mono text-sm font-bold tabular-nums text-foreground">
            {s.nilai.toLocaleString("id-ID")}
          </p>
        </div>
      ))}
    </div>
  )
}

/// Nada warna sama dengan selStatus di grids/sel.tsx supaya panel dan tabel
/// membaca status dengan bahasa visual yang identik.
const BADGE_STATUS: Record<string, { label: string; kelas: string }> = {
  MENUNGGU: {
    label: "Menunggu",
    kelas: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  },
  // Tahap alur berjenjang laporan lapangan (tahapLaporanHarian di tipe.ts).
  MENUNGGU_V1: {
    label: "Menunggu V1",
    kelas: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  },
  MENUNGGU_V2: {
    label: "Menunggu V2",
    kelas: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-400",
  },
  MENUNGGU_V3: {
    label: "Menunggu V3",
    kelas: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-400",
  },
  RESMI: {
    label: "Resmi",
    kelas:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  DIVERIFIKASI: {
    label: "Terverifikasi",
    kelas:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  DIGUNAKAN: {
    label: "Digunakan",
    kelas:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  DITOLAK: {
    label: "Ditolak",
    kelas: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400",
  },
}

export function BadgeStatusVerif({ status }: { status: string }) {
  const cfg = BADGE_STATUS[status] ?? { label: status, kelas: "border-border bg-muted text-muted-foreground" }
  return (
    <span className={cn("shrink-0 border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase", cfg.kelas)}>
      {cfg.label}
    </span>
  )
}

export function PanelKosong({ icon: Icon, pesan }: { icon: LucideIcon; pesan: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-14 text-center">
      <Icon className="size-5 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{pesan}</p>
    </div>
  )
}
