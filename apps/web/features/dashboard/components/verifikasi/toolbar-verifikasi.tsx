"use client"

// features/dashboard/components/verifikasi/toolbar-verifikasi.tsx — bilah
// penyaring layar verifikasi.
//
// Disusun dua baris: baris 1 = pencarian + saringan pokok (periode, status,
// petugas), baris 2 = rentang tanggal + pintasan hari + ukuran halaman.
// Pemisahan ini disengaja — yang di baris 1 dipakai tiap hari, yang di baris
// 2 dipakai saat menelusuri.

import * as React from "react"
import { CalendarDays, Filter, RotateCcw, Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@workspace/ui/components/select"
import { formatPeriode } from "@/features/public/lib/format"

export interface FilterVerifikasi {
  q: string
  periode: number | null
  statusVerif: string
  pencatatId: string
  tanggalDari: string
  tanggalSampai: string
  hanyaAnomali: boolean
  pageSize: number
}

export const FILTER_AWAL: FilterVerifikasi = {
  q: "",
  periode: null,
  statusVerif: "",
  pencatatId: "",
  tanggalDari: "",
  tanggalSampai: "",
  hanyaAnomali: false,
  pageSize: 100,
}

/// Batas ATAS 5.000 mengikuti aplikasi lama, tapi batas bawahnya diturunkan
/// sampai 50: 500 baris sekaligus membuat tabel terasa berat untuk pekerjaan
/// sehari-hari yang sebenarnya cuma memeriksa selusin baris. Yang butuh
/// borongan tinggal menaikkannya; yang tidak, tidak perlu membayar ongkosnya.
export const PILIHAN_UKURAN = [50, 100, 200, 500, 1000, 2000, 5000] as const

const HARI_INI = () => new Date().toISOString().slice(0, 10)
const MUNDUR = (hari: number) => {
  const d = new Date()
  d.setDate(d.getDate() - hari)
  return d.toISOString().slice(0, 10)
}

export function ToolbarVerifikasi({
  filter,
  onGanti,
  periodes,
  pencatats,
  jumlahTampil,
  jumlahTotal,
  memuat,
}: {
  filter: FilterVerifikasi
  onGanti: (f: FilterVerifikasi) => void
  periodes: number[]
  pencatats: { id: string; namaLapangan: string }[]
  jumlahTampil: number
  jumlahTotal: number
  memuat: boolean
}) {
  const [cari, setCari] = React.useState(filter.q)

  // Pencarian ditunda 350 ms — mengetik 11 digit nomor langganan tidak boleh
  // memicu 11 permintaan.
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (cari !== filter.q) onGanti({ ...filter, q: cari })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cari])

  const set = <K extends keyof FilterVerifikasi>(k: K, v: FilterVerifikasi[K]) =>
    onGanti({ ...filter, [k]: v })

  const adaFilter =
    filter.q !== "" || filter.statusVerif !== "" || filter.pencatatId !== "" ||
    filter.tanggalDari !== "" || filter.tanggalSampai !== "" || filter.hanyaAnomali

  return (
    <div className="border-border/70 bg-card flex flex-col gap-2 border p-2">
      {/* Baris 1 — dipakai setiap hari */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Lebar TETAP: `flex-1` membuatnya melar memakan seluruh sisa
            bilah, padahal 11 digit nomor langganan tidak butuh selebar itu. */}
        <div className="relative w-72 shrink-0">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" aria-hidden />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari no. langganan atau nama…"
            className="h-9 pl-7 text-sm"
            aria-label="Cari laporan"
          />
        </div>

        <Select
          value={filter.periode === null ? "SEMUA" : String(filter.periode)}
          onValueChange={(v) => set("periode", v === "SEMUA" ? null : Number(v))}
        >
          <SelectTrigger size="sm" className="h-9 w-44 text-sm" aria-label="Periode">
            <SelectValue placeholder="Periode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SEMUA">Semua periode</SelectItem>
            {periodes.map((p) => (
              <SelectItem key={p} value={String(p)}>{formatPeriode(p)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filter.statusVerif || "SEMUA"} onValueChange={(v) => set("statusVerif", v === "SEMUA" ? "" : v)}>
          <SelectTrigger size="sm" className="h-9 w-40 text-sm" aria-label="Status verifikasi">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SEMUA">Semua status</SelectItem>
            <SelectItem value="MENUNGGU">Menunggu</SelectItem>
            <SelectItem value="DIVERIFIKASI">Resmi (V3)</SelectItem>
            <SelectItem value="DITOLAK">Cek ulang</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filter.pencatatId || "SEMUA"} onValueChange={(v) => set("pencatatId", v === "SEMUA" ? "" : v)}>
          <SelectTrigger size="sm" className="h-9 w-44 text-sm" aria-label="Petugas pencatat">
            <SelectValue placeholder="Petugas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SEMUA">Semua petugas</SelectItem>
            {pencatats.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.namaLapangan}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant={filter.hanyaAnomali ? "default" : "outline"}
          className="h-9 text-sm"
          onClick={() => set("hanyaAnomali", !filter.hanyaAnomali)}
          aria-pressed={filter.hanyaAnomali}
        >
          <Filter className="size-3.5" aria-hidden /> Hanya anomali
        </Button>
      </div>

      {/* Baris 2 — dipakai saat menelusuri */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
          <CalendarDays className="size-3.5" aria-hidden /> Tanggal catat
        </span>
        <Input
          type="date"
          value={filter.tanggalDari}
          onChange={(e) => set("tanggalDari", e.target.value)}
          className="h-9 w-40 text-sm"
          aria-label="Tanggal catat dari"
        />
        <span className="text-muted-foreground text-xs">s/d</span>
        <Input
          type="date"
          value={filter.tanggalSampai}
          onChange={(e) => set("tanggalSampai", e.target.value)}
          className="h-9 w-40 text-sm"
          aria-label="Tanggal catat sampai"
        />

        {/* Pintasan rentang — pekerjaan harian tidak perlu memilih tanggal
            dua kali untuk pertanyaan yang selalu sama. */}
        {([
          ["Hari ini", () => onGanti({ ...filter, tanggalDari: HARI_INI(), tanggalSampai: HARI_INI() })],
          ["7 hari", () => onGanti({ ...filter, tanggalDari: MUNDUR(6), tanggalSampai: HARI_INI() })],
          ["30 hari", () => onGanti({ ...filter, tanggalDari: MUNDUR(29), tanggalSampai: HARI_INI() })],
        ] as const).map(([label, aksi]) => (
          <Button key={label} size="sm" variant="ghost" className="h-9 text-sm" onClick={aksi}>
            {label}
          </Button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {adaFilter && (
            <Button
              size="sm"
              variant="ghost"
              className="h-9 text-sm"
              onClick={() => onGanti({ ...FILTER_AWAL, periode: filter.periode, pageSize: filter.pageSize })}
            >
              <RotateCcw className="size-3.5" aria-hidden /> Bersihkan saringan
            </Button>
          )}
          <Badge variant="outline" className="tabular-nums">
            {memuat ? "memuat…" : `${jumlahTampil.toLocaleString("id-ID")} / ${jumlahTotal.toLocaleString("id-ID")}`}
          </Badge>
          <Select value={String(filter.pageSize)} onValueChange={(v) => set("pageSize", Number(v))}>
            <SelectTrigger size="sm" className="h-9 w-32 text-sm" aria-label="Baris per halaman">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PILIHAN_UKURAN.map((n) => (
                <SelectItem key={n} value={String(n)}>{n.toLocaleString("id-ID")} baris</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
