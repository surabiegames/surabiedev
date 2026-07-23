"use client"

// Impor cadangan lapangan — admin mengunggah berkas backup dari aplikasi
// petugas (format per-tipe: stand/rumah/segel/video + CSV catatan, nama datar
// `periode_tipe_nomor`). Admin BEBAS memilih tipe yang diimpor dan mengunggah
// ZIP penuh ATAU berkas lepasan (mis. hanya foto rumah).
//   - `catatan` (CSV) → MEMBUAT laporan (idempoten: DUPLIKAT bila sudah ada).
//   - foto/video → MELAMPIRKAN ke pembacaan yang sudah ada di periode itu.
import * as React from "react"
import { AlertTriangle, CheckCircle2, Loader2, Upload } from "lucide-react"
import { kirimForm, ApiError } from "../../lib/api-client"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

const TIPE = [
  { id: "catatan", label: "Catatan / teks (CSV)", nada: "Angka stand & kondisi — membuat pembacaan" },
  { id: "stand", label: "Foto stand", nada: "Dilampirkan ke pembacaan" },
  { id: "rumah", label: "Foto rumah", nada: "Dilampirkan ke pembacaan" },
  { id: "segel", label: "Foto segel", nada: "Dilampirkan ke pembacaan" },
  { id: "video", label: "Video", nada: "Dilampirkan ke pembacaan" },
] as const
type TipeId = (typeof TIPE)[number]["id"]

type Status = "TERSIMPAN" | "DUPLIKAT" | "DILAMPIRKAN" | "TANPA_PENCATATAN" | "GAGAL"
interface HasilBaris {
  index: number
  jenis: TipeId
  nomorLangganan: string
  periode: number
  status: Status
  pesan?: string
}
interface HasilImpor {
  total: number
  tersimpan: number
  duplikat: number
  dilampirkan: number
  tanpaPencatatan: number
  gagal: number
  hasil: HasilBaris[]
}

export function ImporCadanganClient() {
  const [files, setFiles] = React.useState<File[]>([])
  const [pilih, setPilih] = React.useState<Set<TipeId>>(new Set(TIPE.map((t) => t.id)))
  const [mengirim, setMengirim] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [hasil, setHasil] = React.useState<HasilImpor | null>(null)

  function togglePilih(id: TipeId) {
    setPilih((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function impor() {
    if (files.length === 0 || pilih.size === 0) return
    setMengirim(true)
    setGalat(null)
    setHasil(null)
    try {
      const form = new FormData()
      for (const f of files) form.append("berkas", f)
      for (const t of pilih) form.append("tipe", t)
      setHasil(await kirimForm<HasilImpor>("/laporan-harian/import-backup", form))
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal mengimpor cadangan.")
    } finally {
      setMengirim(false)
    }
  }

  // Baris yang perlu perhatian: gagal + foto tanpa pencatatan induk.
  const bermasalah = hasil?.hasil.filter((h) => h.status === "GAGAL" || h.status === "TANPA_PENCATATAN") ?? []

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-base font-semibold">Unggah berkas cadangan</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Petugas mengekspor cadangan dari menu <span className="font-medium">Cadangan Data</span> di aplikasi (ZIP),
          atau kirim berkas lepasan langsung (mis. hanya folder <span className="font-mono">rumah/</span>). Nama berkas
          mengikuti pola <span className="font-mono">periode_tipe_nomor.jpg</span> — mis.{" "}
          <span className="font-mono">202607_rumah_00700800867.jpg</span>. Aman diimpor berulang.
        </p>

        <div className="mt-4">
          <p className="text-sm font-medium">Jenis yang diimpor</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {TIPE.map((t) => (
              <label
                key={t.id}
                htmlFor={`tipe-${t.id}`}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-background p-2.5"
              >
                <Checkbox id={`tipe-${t.id}`} checked={pilih.has(t.id)} onCheckedChange={() => togglePilih(t.id)} />
                <span className="grid gap-0.5 leading-none">
                  <Label htmlFor={`tipe-${t.id}`} className="cursor-pointer text-sm">
                    {t.label}
                  </Label>
                  <span className="text-xs text-muted-foreground">{t.nada}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="file"
            multiple
            accept=".zip,application/zip,.csv,text/csv,image/jpeg,image/png,image/webp,video/mp4"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="cursor-pointer"
          />
          <Button onClick={impor} disabled={files.length === 0 || pilih.size === 0 || mengirim} className="shrink-0">
            {mengirim ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {mengirim ? "Mengimpor…" : "Impor"}
          </Button>
        </div>
        {files.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {files.length} berkas dipilih{files.length <= 3 ? `: ${files.map((f) => f.name).join(", ")}` : ""}.
          </p>
        )}
        {pilih.size === 0 && <p className="mt-2 text-xs text-amber-600">Pilih minimal satu jenis untuk diimpor.</p>}
        {galat && <p className="mt-3 text-sm text-destructive">{galat}</p>}
      </div>

      {hasil && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            {hasil.gagal === 0 ? (
              <CheckCircle2 className="size-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="size-5 text-amber-600" />
            )}
            <h3 className="text-base font-semibold">Hasil impor</h3>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">Total {hasil.total}</Badge>
            {hasil.tersimpan > 0 && (
              <Badge className="bg-emerald-600 hover:bg-emerald-600">Pembacaan {hasil.tersimpan}</Badge>
            )}
            {hasil.dilampirkan > 0 && (
              <Badge className="bg-sky-600 hover:bg-sky-600">Foto dilampirkan {hasil.dilampirkan}</Badge>
            )}
            {hasil.duplikat > 0 && <Badge variant="outline">Duplikat {hasil.duplikat}</Badge>}
            {hasil.tanpaPencatatan > 0 && (
              <Badge variant="outline" className="border-amber-500 text-amber-600">
                Tanpa pencatatan {hasil.tanpaPencatatan}
              </Badge>
            )}
            {hasil.gagal > 0 && <Badge variant="destructive">Gagal {hasil.gagal}</Badge>}
          </div>
          {bermasalah.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Perlu perhatian:</p>
              <ul className="divide-y rounded-md border text-sm">
                {bermasalah.map((h) => (
                  <li key={h.index} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="font-mono">
                      {h.nomorLangganan || "?"}
                      <span className="ml-2 text-xs text-muted-foreground">{h.jenis}</span>
                    </span>
                    <span className="text-right text-muted-foreground">{h.pesan ?? "Gagal."}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
