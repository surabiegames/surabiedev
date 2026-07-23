// features/publik/components/hasil-tagihan/header.tsx — identitas
// pelanggan + status ringkas di atas kartu hasil cek-tagihan.
import { Badge } from "@workspace/ui/components/badge"
import { StatusDot } from "./atoms"
import { statusTagihanTampilan } from "../../lib/format"
import type { HasilCekTagihan } from "../../lib/api"

export function HasilTagihanHeader({ hasil }: { hasil: HasilCekTagihan }) {
  const { pelanggan, tagihan } = hasil

  const belumBayar = tagihan.filter((t) => t.status !== "SUDAH_BAYAR")
  // Status "aktif" ditampilkan di badge: prioritaskan tagihan yang belum
  // lunas (paling relevan bagi pelanggan), fallback ke tagihan terbaru.
  const statusAktif = statusTagihanTampilan(belumBayar[0]?.status ?? tagihan[0]?.status ?? "SUDAH_BAYAR")

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">No. Pelanggan</p>
          <p className="font-mono text-base font-bold text-foreground">{pelanggan.nomorLangganan}</p>
          <p className="truncate text-sm text-muted-foreground">{pelanggan.nama}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge variant="outline" className={`gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold tracking-wide ${statusAktif.badgeClass}`}>
            <StatusDot className={statusAktif.dotClass} />
            {statusAktif.label}
          </Badge>
          {belumBayar.length > 0 && <p className="text-[11px] text-muted-foreground">{belumBayar.length} tagihan belum lunas</p>}
        </div>
      </div>
      <div className="mt-4 h-px bg-border/60" />
    </div>
  )
}
