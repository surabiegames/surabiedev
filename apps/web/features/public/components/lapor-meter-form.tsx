"use client"

// features/publik/components/lapor-meter-form.tsx
//
// Alur: ketik nomor langganan (11 digit) -> pratinjau identitas dicari
// otomatis lewat GET /api/public/pelanggan/:nomorLangganan (lookup SATU
// pelanggan exact-match, bukan pencarian sebagian — lihat catatan di
// server/modules/publik/publik.router.ts). Begitu pelanggan ketemu, field
// stand meter/foto/pelapor baru ditampilkan. TIDAK ada field nama pelanggan
// di sini — lihat catatan keputusan produk di server/modules/publik/verifikasi.ts.
import * as React from "react"
import { Loader2, Search, CheckCircle2, AlertCircle, Upload } from "lucide-react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { cariPelanggan, laporMeter, ApiError, type PelangganPratinjau } from "../lib/api"
import { formatPeriode } from "../lib/format"
import { PemilihFoto } from "./pemilih-foto"
import { LaporMeterSukses, type HasilLaporanTampilan } from "./lapor-meter-sukses"

export function LaporMeterForm() {
  const [nomorLangganan, setNomorLangganan] = React.useState("")
  const [pratinjau, setPratinjau] = React.useState<PelangganPratinjau | null>(null)
  const [cariPending, setCariPending] = React.useState(false)
  const [cariError, setCariError] = React.useState<string | null>(null)
  const pencarianTerbaru = React.useRef(0)

  const [standInput, setStandInput] = React.useState("")
  const [fotoFile, setFotoFile] = React.useState<File | null>(null)
  const [fotoPreviewUrl, setFotoPreviewUrl] = React.useState<string | null>(null)
  const [namaPelapor, setNamaPelapor] = React.useState("")
  const [nomorPelapor, setNomorPelapor] = React.useState("")

  const [kirimError, setKirimError] = React.useState<string | null>(null)
  const [kirimPending, setKirimPending] = React.useState(false)
  const [hasil, setHasil] = React.useState<HasilLaporanTampilan | null>(null)

  React.useEffect(() => {
    return () => {
      if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl)
    }
  }, [fotoPreviewUrl])

  const cari = React.useCallback(async (nomor: string) => {
    const id = ++pencarianTerbaru.current
    setCariError(null)
    setPratinjau(null)
    setCariPending(true)
    try {
      const hasil = await cariPelanggan(nomor)
      if (id === pencarianTerbaru.current) setPratinjau(hasil)
    } catch (err) {
      if (id === pencarianTerbaru.current) setCariError(err instanceof ApiError ? err.message : "Gagal mencari nomor pelanggan.")
    } finally {
      if (id === pencarianTerbaru.current) setCariPending(false)
    }
  }, [])

  // Auto-cari begitu nomor genap 11 digit — dipicu langsung dari event
  // handler (bukan useEffect yang memantau state): mengikuti pola yang
  // sudah dipakai cek-tagihan-form.tsx, dan menghindari setState sinkron di
  // dalam efek (react-hooks/set-state-in-effect).
  function onNomorChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11)
    setNomorLangganan(digits)
    if (digits.length === 11) {
      cari(digits)
    } else {
      pencarianTerbaru.current++ // batalkan pencarian yang sedang berjalan
      setPratinjau(null)
      setCariError(null)
      setCariPending(false)
    }
  }

  function pilihFoto(file: File, url: string) {
    setFotoFile(file)
    setFotoPreviewUrl((lama) => {
      if (lama) URL.revokeObjectURL(lama)
      return url
    })
  }

  function hapusFoto() {
    setFotoFile(null)
    setFotoPreviewUrl((lama) => {
      if (lama) URL.revokeObjectURL(lama)
      return null
    })
  }

  async function kirim() {
    if (!pratinjau) return
    if (!standInput || Number.isNaN(Number(standInput))) return setKirimError("Stand meter harus berupa angka.")
    if (!fotoFile || !fotoPreviewUrl) return setKirimError("Foto stand meter wajib dilampirkan sebagai bukti.")
    if (!namaPelapor.trim()) return setKirimError("Nama pelapor wajib diisi.")
    if (!nomorPelapor.trim()) return setKirimError("Nomor HP pelapor wajib diisi.")

    setKirimError(null)
    setKirimPending(true)
    try {
      const form = new FormData()
      form.set("nomorLangganan", pratinjau.nomorLangganan)
      form.set("standDilaporkan", standInput)
      form.set("foto", fotoFile)
      form.set("nomorPelapor", nomorPelapor.trim())
      form.set("namaPelapor", namaPelapor.trim())

      await laporMeter(form)
      setHasil({
        nomorLangganan: pratinjau.nomorLangganan,
        nama: pratinjau.nama,
        periodeLabel: formatPeriode(pratinjau.periodeBerjalan),
        stand: Number(standInput),
        fotoPreviewUrl,
      })
    } catch (err) {
      setKirimError(err instanceof ApiError ? err.message : "Terjadi kesalahan. Coba lagi.")
    } finally {
      setKirimPending(false)
    }
  }

  function reset() {
    setNomorLangganan("")
    setPratinjau(null)
    setStandInput("")
    hapusFoto()
    setNamaPelapor("")
    setNomorPelapor("")
    setKirimError(null)
    setHasil(null)
  }

  if (hasil) return <LaporMeterSukses hasil={hasil} onReset={reset} />

  const bisaLapor = !!pratinjau && !pratinjau.sudahLaporBulanIni

  return (
    <div className="space-y-5 px-5 py-5">
      <div className="space-y-1.5">
        <Label htmlFor="nomorLangganan">Nomor langganan</Label>
        <div className="flex gap-2">
          <Input
            id="nomorLangganan"
            value={nomorLangganan}
            onChange={(e) => onNomorChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && nomorLangganan.length === 11 && cari(nomorLangganan)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Contoh: 00401700010"
            maxLength={11}
            className="h-10 rounded-xl font-mono"
          />
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
            onClick={() => cari(nomorLangganan)}
            disabled={nomorLangganan.length !== 11 || cariPending}
            aria-label="Cari nomor pelanggan"
          >
            {cariPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {cariPending ? "Mencari nomor pelanggan…" : "11 digit, tertera di rekening Anda. Pencarian berjalan otomatis."}
        </p>

        {pratinjau && (
          <div className="mt-4 space-y-2.5 rounded-lg border border-green-200 bg-green-100 px-3 py-3 dark:border-green-800 dark:bg-green-900/30">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <p className="text-sm font-semibold">{pratinjau.nama}</p>
            </div>
            <div className="grid grid-cols-2 text-xs">
              <div>
                <p className="text-muted-foreground uppercase">Alamat</p>
                <p>{pratinjau.alamat}</p>
              </div>
              <div>
                <p className="text-muted-foreground uppercase">Gol. tarif</p>
                <p>{pratinjau.tarifGolongan?.kategori ?? "—"}</p>
              </div>
            </div>
          </div>
        )}

        {cariError && (
          <div className="mt-4 space-y-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-3 dark:border-red-900 dark:bg-red-900/20">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">{cariError}</p>
            </div>
          </div>
        )}

        {pratinjau?.sudahLaporBulanIni && (
          <div className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2.5">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Laporan periode {formatPeriode(pratinjau.periodeBerjalan)} sudah ada (status: {pratinjau.statusLaporanBulanIni}). Satu laporan per bulan.
            </p>
          </div>
        )}
      </div>

      {pratinjau && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="standDilaporkan">Angka stand meter (m³)</Label>
            <Input
              id="standDilaporkan"
              value={standInput}
              onChange={(e) => setStandInput(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="Contoh: 3955"
              className="h-10 rounded-xl font-mono"
            />
            <p className="text-xs text-muted-foreground">Isi sesuai angka hitam yang tertera di meter air, tanpa titik atau koma.</p>
          </div>

          <PemilihFoto
            previewUrl={fotoPreviewUrl}
            onPilih={pilihFoto}
            onHapus={hapusFoto}
            onError={setKirimError}
            label="Foto stand meter"
            deskripsi="Pastikan angka pada meter terlihat jelas dan tidak buram."
            disabled={kirimPending}
          />

          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Data pelapor</Label>
            <div className="space-y-1">
              <Input placeholder="Nama lengkap" value={namaPelapor} onChange={(e) => setNamaPelapor(e.target.value)} className="h-10 rounded-xl" />
              <p className="text-xs text-muted-foreground">Boleh berbeda dari nama pelanggan, mis. anggota keluarga.</p>
            </div>
            <div className="space-y-1">
              <Input
                placeholder="0812…"
                value={nomorPelapor}
                onChange={(e) => setNomorPelapor(e.target.value.replace(/\D/g, "").slice(0, 14))}
                inputMode="tel"
                className="h-10 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Nomor HP/WhatsApp aktif untuk dihubungi petugas bila diperlukan.</p>
            </div>
          </div>
        </>
      )}

      {kirimError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{kirimError}</AlertDescription>
        </Alert>
      )}

      {pratinjau && (
        <Button onClick={kirim} disabled={kirimPending || !bisaLapor} className="h-12 w-full rounded-xl font-semibold">
          {kirimPending ? <Spinner className="size-4" /> : <Upload />}
          {kirimPending ? "Mengirim…" : "Kirim laporan"}
        </Button>
      )}
    </div>
  )
}
