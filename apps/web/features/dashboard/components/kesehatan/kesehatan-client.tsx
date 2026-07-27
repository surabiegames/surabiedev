"use client"

// Kesehatan data — bukti bahwa aplikasi ini bisa mempertanggungjawabkan
// datanya sendiri, bukan menunggu ketahuan saat tagihan salah sampai ke
// rumah warga.
//
// TIGA TINGKAT KEPARAHAN, dan bedanya menentukan tindakan:
//   GAWAT     menghalangi penerbitan tagihan yang benar — beresi sebelum closing
//   PERHATIAN tidak menghalangi, tapi ada yang tidak beres
//   INFO      wajar, tapi perlu diketahui
//
// TOMBOL PERBAIKI SENGAJA TERBATAS. Ia hanya menyentuh temuan yang jawabannya
// sudah tertulis di data lain (mis. menurunkan petugas dari penugasan rute
// yang sudah terdaftar). Apa pun yang menyangkut ANGKA UANG atau STATUS
// PELANGGAN tidak pernah diperbaiki mesin — itu sebabnya sebagian temuan
// tampil tanpa tombol, dan itu disengaja.
import * as React from "react"
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw, Wrench } from "lucide-react"
import { ambilSatu, kirimJson, ApiError } from "../../lib/api-client"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

const SENIOR_UP = new Set(["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER"])

type Keparahan = "GAWAT" | "PERHATIAN" | "INFO"
interface Temuan {
  kode: string
  keparahan: Keparahan
  judul: string
  akibat: string
  jumlah: number
  contoh: string[]
  bisaOtomatis: boolean
}
interface Laporan {
  diperiksaPada: string
  ringkas: { gawat: number; perhatian: number; info: number }
  temuan: Temuan[]
}
interface HasilPerbaikan {
  kode: string
  diperbaiki: number
  keterangan: string
}

const angka = (n: number) => n.toLocaleString("id-ID")

const GAYA: Record<Keparahan, { kotak: string; lencana: string; label: string }> = {
  GAWAT: {
    kotak: "border-destructive/40 bg-destructive/5",
    lencana: "border-destructive text-destructive",
    label: "Gawat",
  },
  PERHATIAN: {
    kotak: "border-amber-500/40 bg-amber-500/5",
    lencana: "border-amber-500 text-amber-700",
    label: "Perhatian",
  },
  INFO: { kotak: "border-border bg-muted/30", lencana: "text-muted-foreground", label: "Info" },
}

export function KesehatanClient({ role, laporanAwal }: { role: string; laporanAwal: Laporan }) {
  const bolehPerbaiki = SENIOR_UP.has(role)
  const [laporan, setLaporan] = React.useState<Laporan>(laporanAwal)
  const [sibuk, setSibuk] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [hasilPerbaikan, setHasilPerbaikan] = React.useState<HasilPerbaikan[] | null>(null)

  const adaYangOtomatis = laporan.temuan.some((t) => t.bisaOtomatis && t.jumlah > 0)

  async function muatUlang() {
    setSibuk(true)
    setGalat(null)
    try {
      setLaporan(await ambilSatu<Laporan>("/kesehatan"))
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal memuat pemeriksaan.")
    } finally {
      setSibuk(false)
    }
  }

  async function perbaiki() {
    setSibuk(true)
    setGalat(null)
    try {
      setHasilPerbaikan(await kirimJson<HasilPerbaikan[]>("/kesehatan/perbaiki", "POST", {}))
      setLaporan(await ambilSatu<Laporan>("/kesehatan"))
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal menjalankan perbaikan.")
    } finally {
      setSibuk(false)
    }
  }

  const sehat = laporan.temuan.length === 0

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
        <div className="flex items-center gap-3">
          {sehat ? (
            <CheckCircle2 className="size-6 text-emerald-600" />
          ) : laporan.ringkas.gawat > 0 ? (
            <AlertTriangle className="size-6 text-destructive" />
          ) : (
            <AlertTriangle className="size-6 text-amber-600" />
          )}
          <div>
            <p className="text-base font-semibold">
              {sehat ? "Tidak ada temuan" : `${laporan.temuan.length} jenis temuan`}
            </p>
            <p className="text-xs text-muted-foreground">
              Diperiksa {new Date(laporan.diperiksaPada).toLocaleString("id-ID")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {laporan.ringkas.gawat > 0 && <Badge variant="destructive">{laporan.ringkas.gawat} gawat</Badge>}
          {laporan.ringkas.perhatian > 0 && (
            <Badge variant="outline" className="border-amber-500 text-amber-700">
              {laporan.ringkas.perhatian} perhatian
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => void muatUlang()} disabled={sibuk}>
            {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Periksa ulang
          </Button>
          {bolehPerbaiki && adaYangOtomatis && (
            <Button size="sm" onClick={() => void perbaiki()} disabled={sibuk}>
              <Wrench className="size-3.5" />
              Perbaiki yang bisa otomatis
            </Button>
          )}
        </div>
      </div>

      {galat && <p className="text-sm text-destructive">{galat}</p>}

      {hasilPerbaikan && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <p className="text-sm font-medium">Perbaikan dijalankan</p>
          </div>
          <ul className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">
            {hasilPerbaikan.map((h) => (
              <li key={h.kode}>
                {h.keterangan}: <span className="font-medium text-foreground">{angka(h.diperbaiki)} baris</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sehat ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
          <p className="mt-3 text-sm text-muted-foreground">
            Seluruh pemeriksaan integritas lolos. Data siap dipakai sebagai dasar penagihan.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {laporan.temuan.map((t) => {
            const g = GAYA[t.keparahan]
            return (
              <li key={t.kode} className={`rounded-xl border p-4 ${g.kotak}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${g.lencana}`}>
                    {g.label}
                  </Badge>
                  <span className="text-sm font-semibold">{t.judul}</span>
                  <Badge variant="secondary">{angka(t.jumlah)}</Badge>
                  {t.bisaOtomatis && (
                    <Badge variant="outline" className="border-emerald-500 text-[10px] text-emerald-700">
                      bisa diperbaiki otomatis
                    </Badge>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{t.akibat}</p>
                {t.contoh.length > 0 && (
                  <p className="mt-1.5 font-mono text-xs break-all text-muted-foreground">
                    {t.contoh.join(", ")}
                    {t.jumlah > t.contoh.length && ` … (+${angka(t.jumlah - t.contoh.length)} lagi)`}
                  </p>
                )}
                {!t.bisaOtomatis && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Info className="mt-0.5 size-3 shrink-0" />
                    Sengaja tidak diperbaiki mesin — perlu keputusan manusia.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
