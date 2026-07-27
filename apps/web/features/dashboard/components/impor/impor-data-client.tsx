"use client"

// features/dashboard/components/impor/impor-data-client.tsx — IMPOR BERKAS
// SUMBER dengan pengiriman bertahap dan kemajuan yang terlihat.
//
// ALUR YANG DIJAGA: pilih berkas -> diurai & diperiksa di browser -> pengguna
// melihat ringkasannya (berapa baris, periode apa, apa yang ditolak) ->
// baru menekan Mulai. Tidak ada byte yang dikirim sebelum pengguna tahu apa
// yang akan dikirim.
//
// Pengiriman dipotong jadi batch. Tiap batch adalah permintaan tersendiri
// yang idempoten di server, sehingga: kemajuan bisa ditampilkan sungguhan
// (bukan spinner yang berputar tanpa arti), satu batch gagal tidak
// menghanguskan yang sudah masuk, dan tombol "Ulangi yang gagal" aman ditekan
// berkali-kali tanpa risiko data dobel.

import * as React from "react"
import {
  AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X, RotateCcw, Ban,
} from "lucide-react"
import { kirimJson, ApiError } from "../../lib/api-client"
import { usePeriodeKerja } from "../../lib/periode-kerja"
import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import { Badge } from "@workspace/ui/components/badge"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import {
  uraiCsv, petakanPencatatan, petakanPemutusan,
  type BarisPencatatan, type BarisPemutusan,
} from "./parser-csv"

/// 1.000 = batas yang diterima server (MAKS_BARIS_PER_BATCH). Angka ini
/// dipilih supaya satu batch selesai jauh di bawah timeout proxy mana pun
/// sekaligus cukup kecil agar bilah kemajuan terasa hidup.
const UKURAN_BATCH = 1000

type Jenis = "pencatatan" | "pemutusan"

const JENIS_INFO: Record<Jenis, { judul: string; berkas: string; jelas: string; endpoint: string }> = {
  pencatatan: {
    judul: "Pencatatan harian",
    berkas: "lapdatametertes.csv",
    jelas:
      "Setoran harian petugas. Masuk sebagai laporan PRA-VERIFIKASI — belum jadi angka resmi. Kenaikan jadi pembacaan resmi terjadi di verifikasi V3.",
    endpoint: "/impor/pencatatan",
  },
  pemutusan: {
    judul: "Pemutusan",
    berkas: "r-nomor.csv",
    jelas:
      "Catatan pemutusan sambungan (TSM / SPT). Mencatat FAKTA pemutusan; status pelanggan TIDAK diubah otomatis — itu keputusan yang perlu disetujui manusia.",
    endpoint: "/impor/pemutusan",
  },
}

interface Masalah {
  baris: number
  nomorLangganan: string
  status: "DUPLIKAT" | "DILEWATI" | "GAGAL"
  pesan?: string
}

interface HasilBatch {
  diproses: number
  tersimpan: number
  duplikat: number
  dilewati: number
  gagal: number
  masalah: Masalah[]
}

interface Terurai {
  namaBerkas: string
  ukuranByte: number
  jenis: Jenis
  baris: (BarisPencatatan | BarisPemutusan)[]
  ditolak: { baris: number; alasan: string }[]
  periode: number[]
}

const angka = (n: number) => n.toLocaleString("id-ID")

function formatDurasi(ms: number): string {
  const d = Math.round(ms / 1000)
  if (d < 60) return `${d} detik`
  return `${Math.floor(d / 60)} menit ${d % 60} detik`
}

export function ImporDataClient() {
  /// Periode kerja dipakai untuk MEMPERINGATKAN, bukan menimpa: periode
  /// impor tetap dibaca dari berkasnya sendiri (kolom Periode/thbl), karena
  /// berkas itulah yang tahu bulan apa yang dicatat. Yang berguna adalah
  /// memberi tahu operator kalau keduanya tidak cocok — mengunggah berkas
  /// Februari saat sistem mengerjakan Januari nyaris selalu keliru.
  const { periodeKerja } = usePeriodeKerja()
  const [jenis, setJenis] = React.useState<Jenis>("pencatatan")
  const [terurai, setTerurai] = React.useState<Terurai | null>(null)
  const [galatUrai, setGalatUrai] = React.useState<string | null>(null)

  const [berjalan, setBerjalan] = React.useState(false)
  const [selesai, setSelesai] = React.useState(false)
  const [terkirim, setTerkirim] = React.useState(0)
  const [total, setTotal] = React.useState(0)
  const [mulaiPada, setMulaiPada] = React.useState<number | null>(null)
  const [berlalu, setBerlalu] = React.useState(0)
  const [galatKirim, setGalatKirim] = React.useState<string | null>(null)

  const [ringkas, setRingkas] = React.useState<HasilBatch>({
    diproses: 0, tersimpan: 0, duplikat: 0, dilewati: 0, gagal: 0, masalah: [],
  })
  /// Batch yang permintaannya gagal seluruhnya (jaringan/timeout) — beda dari
  /// baris yang ditolak server. Inilah yang bisa diulang.
  const [batchGagal, setBatchGagal] = React.useState<number[]>([])

  const batalRef = React.useRef(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Jam berjalan — memberi tahu pengguna prosesnya hidup, bukan menggantung.
  React.useEffect(() => {
    if (!berjalan || mulaiPada === null) return
    const t = setInterval(() => setBerlalu(Date.now() - mulaiPada), 500)
    return () => clearInterval(t)
  }, [berjalan, mulaiPada])

  function reset() {
    setTerurai(null); setGalatUrai(null); setSelesai(false); setGalatKirim(null)
    setTerkirim(0); setTotal(0); setMulaiPada(null); setBerlalu(0); setBatchGagal([])
    setRingkas({ diproses: 0, tersimpan: 0, duplikat: 0, dilewati: 0, gagal: 0, masalah: [] })
    if (inputRef.current) inputRef.current.value = ""
  }

  async function pilihBerkas(file: File) {
    reset()
    try {
      const tabel = uraiCsv(await file.text())
      const hasil = jenis === "pencatatan" ? petakanPencatatan(tabel) : petakanPemutusan(tabel)
      setTerurai({
        namaBerkas: file.name,
        ukuranByte: file.size,
        jenis,
        baris: hasil.baris,
        ditolak: hasil.ditolak,
        periode: hasil.periode,
      })
    } catch (e) {
      setGalatUrai(e instanceof Error ? e.message : "Berkas tidak bisa dibaca.")
    }
  }

  /// Mengirim satu potongan. Dipisah supaya "ulangi yang gagal" memakai
  /// jalur yang PERSIS SAMA dengan pengiriman pertama — bukan salinan yang
  /// bisa menyimpang diam-diam.
  async function kirimPotongan(potongan: Terurai["baris"], periodeBatch: number) {
    const info = JENIS_INFO[jenis]
    const muatan =
      jenis === "pencatatan"
        ? { periode: periodeBatch, baris: potongan }
        : { baris: potongan }
    return kirimJson<HasilBatch>(info.endpoint, "POST", muatan)
  }

  function serapHasil(h: HasilBatch) {
    setRingkas((r) => ({
      diproses: r.diproses + h.diproses,
      tersimpan: r.tersimpan + h.tersimpan,
      duplikat: r.duplikat + h.duplikat,
      dilewati: r.dilewati + h.dilewati,
      gagal: r.gagal + h.gagal,
      // Daftar masalah dibatasi 500 di layar — melebihi itu tidak menolong
      // siapa pun dan membuat tabel berhenti bernapas.
      masalah: r.masalah.length >= 500 ? r.masalah : [...r.masalah, ...h.masalah].slice(0, 500),
    }))
  }

  async function jalankan(indeksBatch?: number[]) {
    if (!terurai) return
    batalRef.current = false
    setBerjalan(true); setSelesai(false); setGalatKirim(null)
    setMulaiPada(Date.now()); setBerlalu(0)

    const potongan: Terurai["baris"][] = []
    for (let i = 0; i < terurai.baris.length; i += UKURAN_BATCH) {
      potongan.push(terurai.baris.slice(i, i + UKURAN_BATCH))
    }
    const dijalankan = indeksBatch ?? potongan.map((_, i) => i)

    if (!indeksBatch) {
      setTotal(terurai.baris.length); setTerkirim(0)
      setRingkas({ diproses: 0, tersimpan: 0, duplikat: 0, dilewati: 0, gagal: 0, masalah: [] })
    }
    const gagalBaru: number[] = []

    for (const i of dijalankan) {
      if (batalRef.current) break
      const isi = potongan[i]
      if (!isi || isi.length === 0) continue
      const periodeBatch = (isi[0] as BarisPencatatan).periode
      try {
        const h = await kirimPotongan(isi, periodeBatch)
        serapHasil(h)
      } catch (e) {
        gagalBaru.push(i)
        // Penolakan yang sifatnya menyeluruh (mis. periode sudah terkunci)
        // TIDAK ada gunanya diulang untuk batch berikutnya — hentikan dan
        // tampilkan alasannya apa adanya.
        if (e instanceof ApiError && e.status === 400) {
          setGalatKirim(e.message)
          setTerkirim((t) => t + isi.length)
          break
        }
        setGalatKirim(e instanceof Error ? e.message : "Gagal mengirim batch.")
      }
      setTerkirim((t) => t + isi.length)
    }

    setBatchGagal(gagalBaru)
    setBerjalan(false)
    setSelesai(true)
  }

  const persen = total === 0 ? 0 : Math.min(100, Math.round((terkirim / total) * 100))
  const info = JENIS_INFO[jenis]
  const jumlahBatch = terurai ? Math.ceil(terurai.baris.length / UKURAN_BATCH) : 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Impor berkas sumber</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Berkas dibaca dan diperiksa di peramban dulu, lalu dikirim bertahap. Aman diulang: setiap
          baris dikunci pada nomor langganan + periode, jadi pengiriman ganda tercatat sebagai
          duplikat, bukan data dobel.
        </p>
      </div>

      <Tabs value={jenis} onValueChange={(v) => { setJenis(v as Jenis); reset() }}>
        <TabsList>
          {(Object.keys(JENIS_INFO) as Jenis[]).map((j) => (
            <TabsTrigger key={j} value={j} disabled={berjalan}>
              {JENIS_INFO[j].judul}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" aria-hidden />
            {info.judul}
            <Badge variant="outline" className="font-mono text-xs">{info.berkas}</Badge>
          </CardTitle>
          <CardDescription>{info.jelas}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (berjalan) return
              const f = e.dataTransfer.files[0]
              if (f) void pilihBerkas(f)
            }}
            className="border-muted-foreground/25 hover:border-muted-foreground/50 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors"
          >
            <Upload className="text-muted-foreground size-8" aria-hidden />
            <p className="text-sm">Seret berkas ke sini, atau</p>
            <Button variant="secondary" disabled={berjalan} onClick={() => inputRef.current?.click()}>
              Pilih berkas CSV
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void pilihBerkas(f) }}
            />
          </div>

          {galatUrai && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" aria-hidden />
              <AlertTitle>Berkas tidak dikenali</AlertTitle>
              <AlertDescription>{galatUrai}</AlertDescription>
            </Alert>
          )}

          {terurai && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Ringkasan label="Berkas" nilai={terurai.namaBerkas} kecil />
                <Ringkasan label="Baris siap kirim" nilai={angka(terurai.baris.length)} />
                <Ringkasan
                  label="Periode"
                  nilai={terurai.periode.length === 0 ? "—" : terurai.periode.join(", ")}
                />
                <Ringkasan label="Jumlah batch" nilai={`${jumlahBatch} × ${angka(UKURAN_BATCH)}`} />
              </div>

              {periodeKerja !== null &&
                terurai.periode.length === 1 &&
                terurai.periode[0] !== periodeKerja && (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" aria-hidden />
                    <AlertTitle>Periode berkas berbeda dari periode kerja</AlertTitle>
                    <AlertDescription>
                      Berkas ini berisi periode <strong>{terurai.periode[0]}</strong>, sedangkan sistem
                      sedang mengerjakan <strong>{periodeKerja}</strong>. Impor tetap bisa dijalankan,
                      tapi pastikan ini memang disengaja — berkas yang salah periode akan mendarat di
                      bulan yang tidak sedang dikerjakan siapa pun.
                    </AlertDescription>
                  </Alert>
                )}

              {terurai.periode.length > 1 && (
                <Alert>
                  <AlertTriangle className="size-4" aria-hidden />
                  <AlertTitle>Berkas memuat lebih dari satu periode</AlertTitle>
                  <AlertDescription>
                    Ditemukan periode {terurai.periode.join(", ")}. Impor tetap bisa dijalankan, tapi
                    pastikan ini memang disengaja — satu setoran lazimnya satu periode.
                  </AlertDescription>
                </Alert>
              )}

              {terurai.ditolak.length > 0 && (
                <Alert>
                  <AlertTriangle className="size-4" aria-hidden />
                  <AlertTitle>{angka(terurai.ditolak.length)} baris tidak bisa dibaca</AlertTitle>
                  <AlertDescription>
                    Baris ini TIDAK akan dikirim. Contoh: {terurai.ditolak.slice(0, 3).map((d) => `baris ${d.baris} (${d.alasan})`).join("; ")}
                    {terurai.ditolak.length > 3 && ` … dan ${angka(terurai.ditolak.length - 3)} lainnya`}.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void jalankan()} disabled={berjalan || terurai.baris.length === 0}>
                  {berjalan ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
                  {berjalan ? "Mengirim…" : `Mulai impor ${angka(terurai.baris.length)} baris`}
                </Button>
                {berjalan && (
                  <Button variant="outline" onClick={() => { batalRef.current = true }}>
                    <Ban className="size-4" aria-hidden /> Hentikan
                  </Button>
                )}
                {!berjalan && batchGagal.length > 0 && (
                  <Button variant="secondary" onClick={() => void jalankan(batchGagal)}>
                    <RotateCcw className="size-4" aria-hidden /> Ulangi {batchGagal.length} batch yang gagal
                  </Button>
                )}
                {!berjalan && (
                  <Button variant="ghost" onClick={reset}>
                    <X className="size-4" aria-hidden /> Bersihkan
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(berjalan || selesai) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {berjalan ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <CheckCircle2 className="size-5" aria-hidden />}
              {berjalan ? "Sedang mengirim" : "Impor selesai"}
            </CardTitle>
            <CardDescription>
              {angka(terkirim)} dari {angka(total)} baris • {formatDurasi(berlalu)}
              {berjalan && terkirim > 0 && total > terkirim
                ? ` • perkiraan sisa ${formatDurasi((berlalu / terkirim) * (total - terkirim))}`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Progress value={persen} />
              <p className="text-muted-foreground text-right text-xs tabular-nums">{persen}%</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <Ringkasan label="Tersimpan" nilai={angka(ringkas.tersimpan)} nada="hijau" />
              <Ringkasan label="Duplikat" nilai={angka(ringkas.duplikat)} nada="amber" />
              <Ringkasan label="Dilewati" nilai={angka(ringkas.dilewati)} nada="amber" />
              <Ringkasan label="Gagal" nilai={angka(ringkas.gagal)} nada={ringkas.gagal > 0 ? "merah" : undefined} />
            </div>

            {galatKirim && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" aria-hidden />
                <AlertTitle>Pengiriman dihentikan</AlertTitle>
                <AlertDescription>{galatKirim}</AlertDescription>
              </Alert>
            )}

            {ringkas.masalah.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">
                  Baris yang perlu ditinjau ({angka(ringkas.masalah.length)}
                  {ringkas.masalah.length >= 500 ? "+, ditampilkan 500 pertama" : ""})
                </p>
                <div className="max-h-96 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0">
                      <TableRow>
                        <TableHead className="w-24">Baris</TableHead>
                        <TableHead className="w-40">No. langganan</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead>Keterangan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ringkas.masalah.map((m, i) => (
                        <TableRow key={`${m.baris}-${i}`}>
                          <TableCell className="tabular-nums">{m.baris}</TableCell>
                          <TableCell className="font-mono text-xs">{m.nomorLangganan}</TableCell>
                          <TableCell>
                            <Badge variant={m.status === "GAGAL" ? "destructive" : "secondary"}>{m.status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{m.pesan ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Ringkasan({
  label, nilai, nada, kecil,
}: {
  label: string
  nilai: string
  nada?: "hijau" | "amber" | "merah"
  kecil?: boolean
}) {
  const warna =
    nada === "hijau" ? "text-emerald-600 dark:text-emerald-400"
      : nada === "amber" ? "text-amber-600 dark:text-amber-400"
        : nada === "merah" ? "text-red-600 dark:text-red-400"
          : ""
  return (
    <div className="bg-muted/40 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`mt-0.5 font-semibold tabular-nums ${kecil ? "truncate text-sm" : "text-lg"} ${warna}`}>
        {nilai}
      </p>
    </div>
  )
}
