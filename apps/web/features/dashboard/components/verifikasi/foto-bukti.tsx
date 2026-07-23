"use client"

// features/dashboard/components/verifikasi/foto-bukti.tsx — lampiran foto
// meter di panel verifikasi.
//
// Sejak 2026-07-19 frame-nya BERUKURAN TETAP lewat BingkaiFoto
// (components/bingkai-foto.tsx): dulu tinggi preview mengikuti file foto
// (max-h-72 object-contain) sehingga panel melar-menciut per laporan.
// Mode "utuh" (object-contain berbingkai) dipertahankan — angka stand meter
// harus terbaca tanpa membuka dialog; dialog zoom tetap ada untuk
// memastikan digit.
import { ImageOff } from "lucide-react"
import { BingkaiFoto } from "@/components/bingkai-foto"

// Re-export dari lokasi barunya — pemakai lama (tab-foto.tsx, modal
// verifikasi V1) tidak perlu tahu komponennya pindah rumah.
export { FotoZoom } from "@/components/bingkai-foto"

/// Empty state yang menjelaskan diri — bukan kotak kosong tanpa keterangan.
/// Laporan petugas dari sistem lama memang tidak menyertakan foto, jadi ini
/// jalur yang normal, bukan kegagalan.
export function FotoKosong({ label, keterangan }: { label: string; keterangan?: string }) {
  return (
    <div className="flex items-center gap-2.5 border border-dashed border-border px-3 py-2.5">
      <ImageOff className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{keterangan ?? "Belum ada foto yang diunggah."}</p>
      </div>
    </div>
  )
}

export function FotoBukti({
  url,
  label,
  keterangan,
}: {
  url: string | null | undefined
  label: string
  /** Teks empty state bila foto tidak ada. */
  keterangan?: string
}) {
  if (!url) return <FotoKosong label={label} keterangan={keterangan} />

  return (
    <div className="flex flex-col gap-1">
      <BingkaiFoto src={url} alt={label} rasio="4/3" mode="utuh" />
      <p className="text-center text-[11px] text-muted-foreground">Klik foto untuk perbesar & zoom</p>
    </div>
  )
}
