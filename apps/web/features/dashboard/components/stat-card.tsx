// features/dashboard/components/stat-card.tsx — sel angka ringkasan.
//
// Server component. Dirender sebagai SEL di dalam grid "menyatu" (lihat
// page.tsx: container grid gap-px bg-border/70, tiap sel bg-card) — pola
// hairline yang sama dengan StatsStrip di beranda, bukan kartu-kartu
// terpisah yang mengambang.
import type { LucideIcon } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

export function StatCard({
  label,
  nilai,
  keterangan,
  judulLengkap,
  icon: Icon,
  nada = "netral",
}: {
  label: string
  /** Sudah diringkas bila berupa uang — lihat formatRupiahRingkas(). */
  nilai: string
  keterangan?: string
  /** Nilai penuh, muncul sebagai tooltip saat kursor menyentuh angka ringkas. */
  judulLengkap?: string
  icon: LucideIcon
  /** `perhatian` untuk angka yang menuntut tindakan (tunggakan, aduan darurat). */
  nada?: "netral" | "perhatian"
}) {
  return (
    <div className="flex items-start justify-between gap-3 bg-card px-5 py-5">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{label}</p>
        {/* tabular-nums: digit selebar sama, jadi angka antar sel sejajar dan
            tidak "bergoyang" saat nilainya berubah.
            `title`: nilai penuh tetap bisa dilihat — versi ringkas ada demi
            muat, bukan untuk menyembunyikan angkanya. */}
        <p
          title={judulLengkap}
          className={cn(
            "mt-1.5 truncate font-mono text-2xl font-bold tracking-tight tabular-nums",
            nada === "perhatian" ? "text-destructive" : "text-foreground"
          )}
        >
          {nilai}
        </p>
        {keterangan && <p className="mt-1 truncate text-xs text-muted-foreground">{keterangan}</p>}
      </div>
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center border",
          nada === "perhatian"
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : "border-border bg-muted/40 text-muted-foreground"
        )}
      >
        <Icon className="size-4" />
      </div>
    </div>
  )
}
