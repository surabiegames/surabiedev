"use client"

// features/dashboard/components/verifikasi/dialog-verifikasi.tsx — kerangka
// modal aksi verifikasi, dipakai panel lapangan & mandiri.
//
// Kenapa aksi ada di modal, bukan di panel kiri: panel kiri murni penampil
// detail. Koreksi stand menuntut mata verifikator membandingkan angka di
// foto dengan angka yang tercatat — itu mustahil kalau fotonya kecil di
// panel sempit. Modal memberi foto ukuran besar (zoom + geser) BERDAMPINGAN
// dengan kotak isian, jadi mengoreksi tidak perlu bolak-balik tutup-buka
// pratinjau.
import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { FotoKosong, FotoZoom } from "./foto-bukti"
import { TabFoto, type ItemTabFoto } from "./tab-foto"

export function DialogVerifikasi({
  buka,
  onBuka,
  judul,
  subjudul,
  fotoUrl,
  fotoLabel,
  keteranganFoto,
  fotos,
  children,
}: {
  buka: boolean
  onBuka: (v: boolean) => void
  judul: string
  subjudul?: string
  fotoUrl?: string | null
  fotoLabel: string
  /** Teks empty state bila laporan memang tidak berfoto (umum di lapangan). */
  keteranganFoto?: string
  /** Bila diisi, kolom foto berupa TAB beberapa foto (stand/segel/rumah)
   *  menggantikan foto tunggal `fotoUrl`. */
  fotos?: ItemTabFoto[]
  /** Kotak isian + tombol aksi; ditempatkan di kolom kanan. */
  children: React.ReactNode
}) {
  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      {/* sm:max-w-5xl (bukan max-w-5xl): kelas dasar DialogContent memuat
          sm:max-w-sm — override tanpa prefix sm: kalah spesifik di
          tailwind-merge dan modal terkunci selebar 24rem di layar ≥640px. */}
      <DialogContent className="max-h-[92dvh] max-w-[calc(100vw-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border/70 px-4 py-3 text-left">
          <DialogTitle className="text-sm">{judul}</DialogTitle>
          {subjudul && (
            <DialogDescription className="text-xs">{subjudul}</DialogDescription>
          )}
        </DialogHeader>
        <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0">
            {fotos ? (
              <TabFoto varian="zoom" item={fotos} />
            ) : fotoUrl ? (
              <FotoZoom url={fotoUrl} label={fotoLabel} />
            ) : (
              <FotoKosong label={fotoLabel} keterangan={keteranganFoto} />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-3">{children}</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
