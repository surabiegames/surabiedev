"use client"

// features/publik/components/lapor-meter-sukses.tsx — layar konfirmasi
// setelah laporan meter terkirim.
import { BingkaiFoto } from "@/components/bingkai-foto"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

export interface HasilLaporanTampilan {
  nomorLangganan: string
  nama: string
  periodeLabel: string
  stand: number
  fotoPreviewUrl: string
}

export function LaporMeterSukses({ hasil, onReset }: { hasil: HasilLaporanTampilan; onReset: () => void }) {
  return (
    <div className="space-y-6 px-5 py-8">
      <div className="flex flex-col items-center space-y-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Laporan terkirim</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Laporan stand meter Anda telah kami terima dan akan diverifikasi petugas sebelum dipakai menghitung tagihan.
          </p>
        </div>
      </div>

      <div className="h-px bg-border/60" />

      <div className="space-y-3">
        {[
          { label: "Nama pelanggan", value: hasil.nama },
          { label: "No. pelanggan", value: hasil.nomorLangganan, mono: true },
          { label: "Periode", value: hasil.periodeLabel },
          { label: "Stand dilaporkan", value: `${hasil.stand.toLocaleString("id-ID")} m³`, mono: true },
        ].map(({ label, value, mono }) => (
          <div key={label} className="flex items-start justify-between border-b border-dashed border-border/50 pb-3">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
            <p className={`text-right text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Foto terkirim</p>
        {/* Frame rasio tetap; blob: lokal jadi tanpa dialog zoom. Mode
            "utuh": angka stand meter tidak boleh terpotong crop. */}
        <BingkaiFoto src={hasil.fotoPreviewUrl} alt="Foto stand meter" mode="utuh" rasio="16/9" tanpaDialog />
      </div>

      <Button onClick={onReset} variant="outline" className="h-11 w-full rounded-xl">
        Lapor meter lain
      </Button>
    </div>
  )
}
