"use client"

// Master pelanggan STI — mengunggah `PEL{periode}-PW5.csv` sebagai data induk
// pelanggan.
//
// KENAPA INI BAGIAN DARI SIKLUS BULANAN, BUKAN SEKADAR ADMINISTRASI:
// analisis enam periode menemukan daftar kerja bulanan Aurora sesekali
// MENJATUHKAN sambungan yang masih aktif (156 baris di Maret, 34 di April)
// lalu mengembalikannya bulan berikutnya. Master pelanggan tidak pernah
// menjatuhkan mereka — ia yang menjaga populasi tetap utuh, dan itulah
// sebabnya Aurora menaruh langkah ini di dalam ritual closing.
//
// ALUR LAYAR INI SENGAJA DUA LANGKAH: unggah -> PRATINJAU (tidak menulis
// apa pun) -> baru "Terapkan". Berkas ini menyentuh 22 ribu baris sekaligus;
// melihat dampaknya lebih dulu bukan kemewahan.
import * as React from "react"
import { AlertTriangle, CheckCircle2, FileUp, Info, Loader2, Upload } from "lucide-react"
import { kirimForm, ApiError } from "../../lib/api-client"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"

/// Cermin ROLE_GROUPS.SENIOR_UP dari server/middleware/rbac.ts — hanya untuk
/// menyembunyikan tombol; penjagaan sesungguhnya ada di router.
const SENIOR_UP = new Set(["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER"])

interface Ringkas {
  periode: number | null
  totalBaris: number
  baru: number
  berubah: number
  sama: number
  statusBerbeda: number
  tidakAdaDiBerkas: number
}
interface Contoh {
  nomorLangganan: string
  jenis: "BARU" | "BERUBAH" | "STATUS"
  keterangan: string
}
interface Hasil {
  diterapkan: boolean
  statusIkutDiterapkan: boolean
  ringkas: Ringkas
  contoh: Contoh[]
  galat: string[]
  ditulis: { dibuat: number; diperbarui: number; statusDiubah: number }
}

const angka = (n: number) => n.toLocaleString("id-ID")

export function MasterPelangganClient({ role }: { role: string }) {
  const bolehTerapkan = SENIOR_UP.has(role)

  const [berkas, setBerkas] = React.useState<File | null>(null)
  const [ikutStatus, setIkutStatus] = React.useState(false)
  const [sibuk, setSibuk] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [hasil, setHasil] = React.useState<Hasil | null>(null)

  async function jalankan(terapkan: boolean) {
    if (!berkas) return
    setSibuk(true)
    setGalat(null)
    try {
      const form = new FormData()
      form.append("berkas", berkas)
      const path = terapkan
        ? `/pelanggan/impor-master?terapkanStatus=${ikutStatus}`
        : "/pelanggan/impor-master/pratinjau"
      setHasil(await kirimForm<Hasil>(path, form))
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal memproses berkas master.")
    } finally {
      setSibuk(false)
    }
  }

  const r = hasil?.ringkas

  return (
    <div className="max-w-3xl space-y-4">
      {/* Peringatan posisi. Tanpa ini, halaman "unggah master" mudah
          disalahpahami sebagai ritual bulanan — padahal justru sebaliknya:
          keberadaannya sementara, dan tujuannya membuat dirinya sendiri
          tidak diperlukan lagi. */}
      <div className="rounded-xl border border-sky-500/40 bg-sky-500/5 p-4">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
          <div className="text-sm">
            <p className="font-medium">Ini alat transisi, bukan langkah bulanan.</p>
            <p className="mt-1 text-muted-foreground">
              Data induk pelanggan aplikasi ini sudah berdiri sendiri: siklus closing membaca dari database sendiri,
              bukan dari berkas mana pun. Gunakan halaman ini hanya saat <span className="font-medium">pindah dari
              sistem lama</span> atau untuk <span className="font-medium">membetulkan data yang telanjur terimpor
              salah</span>. Sambungan baru seharusnya masuk lewat Impor PBPK, dan perubahan data lewat halaman Data
              pelanggan.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-base font-semibold">Unggah berkas master</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Berkas dari STI dengan nama <span className="font-mono">PEL{"{periode}"}-PW5.csv</span> — pemisah titik koma,
          kolom <span className="font-mono">thbl;thblcatat;nolg;nama;almt;rt;rw;kd_goltarif;…;mutasikode;mutasinama</span>.
          Pratinjau <span className="font-medium text-foreground">tidak menulis apa pun</span>.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setBerkas(e.target.files?.[0] ?? null)
              setHasil(null)
            }}
            className="cursor-pointer"
          />
          <Button onClick={() => void jalankan(false)} disabled={!berkas || sibuk} className="shrink-0">
            {sibuk ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            {sibuk ? "Memeriksa…" : "Pratinjau"}
          </Button>
        </div>
        {galat && <p className="mt-3 text-sm text-destructive">{galat}</p>}
      </div>

      {hasil && r && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {hasil.diterapkan ? (
                <CheckCircle2 className="size-5 text-emerald-600" />
              ) : (
                <Info className="size-5 text-muted-foreground" />
              )}
              <h3 className="text-base font-semibold">
                {hasil.diterapkan ? "Master diterapkan" : "Pratinjau perubahan"}
                {r.periode !== null && ` — periode ${r.periode}`}
              </h3>
            </div>
            <Badge variant="secondary">{angka(r.totalBaris)} baris di berkas</Badge>
          </div>

          <div className="mt-4 grid gap-px overflow-hidden border border-border/70 bg-border/70 sm:grid-cols-2 xl:grid-cols-5">
            <Sel label="Pelanggan baru" nilai={angka(r.baru)} perhatian={r.baru > 0} />
            <Sel label="Datanya berubah" nilai={angka(r.berubah)} />
            <Sel label="Sudah sama" nilai={angka(r.sama)} />
            <Sel label="Status berbeda" nilai={angka(r.statusBerbeda)} perhatian={r.statusBerbeda > 0} />
            <Sel
              label="Tak ada di berkas"
              nilai={angka(r.tidakAdaDiBerkas)}
              keterangan="tidak dihapus"
            />
          </div>

          {hasil.diterapkan && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="bg-emerald-600 hover:bg-emerald-600">Dibuat {angka(hasil.ditulis.dibuat)}</Badge>
              <Badge className="bg-sky-600 hover:bg-sky-600">Diperbarui {angka(hasil.ditulis.diperbarui)}</Badge>
              <Badge variant={hasil.statusIkutDiterapkan ? "default" : "outline"}>
                Status diubah {angka(hasil.ditulis.statusDiubah)}
                {!hasil.statusIkutDiterapkan && " (tidak diikutkan)"}
              </Badge>
            </div>
          )}

          {hasil.galat.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600" />
                <p className="text-sm font-medium">{angka(hasil.galat.length)} baris bermasalah</p>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                {hasil.galat.slice(0, 10).map((g) => (
                  <li key={g} className="font-mono break-all">
                    {g}
                  </li>
                ))}
                {hasil.galat.length > 10 && <li>… (+{angka(hasil.galat.length - 10)} lagi)</li>}
              </ul>
            </div>
          )}

          {hasil.contoh.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium">Contoh perubahan</p>
              <ul className="mt-2 divide-y rounded-md border text-sm">
                {hasil.contoh.map((c) => (
                  <li key={`${c.jenis}-${c.nomorLangganan}`} className="flex items-center justify-between gap-3 px-3 py-1.5">
                    <span className="font-mono">
                      {c.nomorLangganan}
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {c.jenis}
                      </Badge>
                    </span>
                    <span className="text-right text-muted-foreground">{c.keterangan}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasil.diterapkan && (
            <div className="mt-5 border-t pt-4">
              {!bolehTerapkan ? (
                <p className="text-sm text-muted-foreground">
                  Menerapkan master memerlukan wewenang Senior Manager ke atas.
                </p>
              ) : (
                <div className="space-y-3">
                  <label
                    htmlFor="ikut-status"
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-background p-2.5"
                  >
                    <Checkbox
                      id="ikut-status"
                      checked={ikutStatus}
                      onCheckedChange={(v) => setIkutStatus(v === true)}
                    />
                    <span className="grid gap-0.5 leading-none">
                      <Label htmlFor="ikut-status" className="cursor-pointer text-sm">
                        Ikut mengubah status pelanggan ({angka(r.statusBerbeda)} baris)
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        Tutupan &amp; pembukaan kembali. Tidak dicentang secara bawaan karena status berkonsekuensi
                        langsung ke tagihan — biarkan mati bila belum diperiksa.
                      </span>
                    </span>
                  </label>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={sibuk}>
                        {sibuk ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        Terapkan ke data induk
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Terapkan master pelanggan?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-2 text-sm">
                            <p>
                              {angka(r.baru)} pelanggan dibuat, {angka(r.berubah)} diperbarui
                              {ikutStatus ? `, ${angka(r.statusBerbeda)} status diubah` : ", status TIDAK diubah"}.
                            </p>
                            <p className="text-muted-foreground">
                              {angka(r.tidakAdaDiBerkas)} pelanggan yang tidak ada di berkas{" "}
                              <span className="font-medium text-foreground">tidak akan dihapus</span> — berkas master
                              adalah potret satu periode, bukan perintah membuang sisanya.
                            </p>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void jalankan(true)}>Ya, terapkan</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Sel({
  label,
  nilai,
  keterangan,
  perhatian,
}: {
  label: string
  nilai: string
  keterangan?: string
  perhatian?: boolean
}) {
  return (
    <div className="bg-card p-4">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold ${perhatian ? "text-amber-600" : "text-foreground"}`}>{nilai}</p>
      {keterangan && <p className="mt-1 text-xs text-muted-foreground">{keterangan}</p>}
    </div>
  )
}
