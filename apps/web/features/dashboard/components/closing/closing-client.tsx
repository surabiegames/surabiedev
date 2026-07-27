"use client"

// Closing periode penagihan — layar tempat operator MENERBITKAN tagihan resmi
// satu periode sekaligus, lalu mengunci periodenya.
//
// KENAPA LAYAR INI DIBANGUN SEPERTI "PERIKSA DULU, BARU TOMBOL":
// menekan "Tutup periode" menerbitkan tagihan ke puluhan ribu warga dan tidak
// bisa dibatalkan diam-diam (membuka kembali ditolak begitu ada satu tagihan
// yang lunas). Jadi tombolnya sengaja tidak berdiri sendiri — ia baru muncul
// setelah pratinjau dimuat, dan seluruh hambatan ditampilkan lengkap dengan
// NOMOR LANGGANAN yang terdampak. "8 pelanggan dilewati" tanpa nomor tidak
// bisa ditindaklanjuti siapa pun; dengan nomor, operator bisa memutuskan
// menunda atau menutup sebagian secara sadar.
//
// Sumber kebenaran bentuk data: packages/server/modules/closing/closing.service.ts
// (PratinjauClosing, HambatanClosing, HasilClosing). Bentuknya disalin sebagai
// interface lokal mengikuti kebiasaan komponen dashboard lain — mengimpor tipe
// dari @workspace/server ke bundel client menyeret Prisma ke sisi browser.
import * as React from "react"
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  LockKeyhole,
  LockKeyholeOpen,
  Search,
} from "lucide-react"
import { ambilSatu, kirimJson, ApiError } from "../../lib/api-client"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
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

/// Cermin ROLE_GROUPS dari server/middleware/rbac.ts — file itu menyeret
/// session server sehingga tidak bisa diimpor ke client. Ini HANYA untuk
/// menyembunyikan tombol; penjagaan sesungguhnya tetap di router (requireRole).
/// Kalau grup di sana berubah, samakan di sini.
const SENIOR_UP = new Set(["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER"])
const ADMIN = new Set(["SUPER_ADMIN"])

interface Hambatan {
  kode: string
  pesan: string
  jumlah: number
  contoh: string[]
}

interface Pratinjau {
  periode: number
  status: "BERJALAN" | "TERKUNCI" | "BELUM_ADA"
  daftarCatat: { total: number; perStatus: Record<string, number> }
  verifikasi: { total: number; selesaiV3: number; belumSelesai: number }
  pembacaan: { total: number; sudahDitagih: number; akanDitagih: number }
  perkiraan: { jumlahSL: number; totalM3: number; totalTagihan: number }
  hambatan: Hambatan[]
  bisaDitutup: boolean
}

interface HasilClosing {
  periode: number
  tagihanDiterbitkan: number
  tagihanSudahAda: number
  jumlahSL: number
  totalM3: number
  totalTagihan: number
}

interface PratinjauBulanBaru {
  periodeSumber: number
  periodeBaru: number
  sumber: { total: number; perStatus: Record<string, number> }
  tujuan: { sudahAda: number; sudahBergerak: number }
  perkiraan: { akanDibuat: number; tanpaRute: number; tanpaPencatat: number }
  hambatan: Hambatan[]
  bisaDibuka: boolean
}

interface HasilBulanBaru {
  periodeSumber: number
  periodeBaru: number
  dibuat: number
  tanpaRute: number
  tanpaPencatat: number
}

/// Hambatan yang sifatnya MEMBERI TAHU, bukan memperingatkan. "19 sambungan
/// dicabut tidak ikut ke bulan baru" adalah hasil yang diharapkan — menandainya
/// kuning seperti masalah justru menyesatkan operator.
/// `DIPULIHKAN_DARI_MASTER` SENGAJA tidak masuk daftar ini. Ia memang berarti
/// sistem sudah membetulkan sendiri, tapi sekaligus menandakan daftar bulan
/// lalu tidak lengkap — operator perlu melihatnya, bukan melewatinya.
const HAMBATAN_INFORMATIF = new Set(["KELUAR_DICABUT", "PENCATAT_DARI_BULAN_LALU"])

interface BarisPeriode {
  id: string
  periode: number
  status: "BERJALAN" | "TERKUNCI"
  tanggalJatuhTempo: string | null
  ditutupAt: string | null
  dibukaAt: string | null
  alasanBuka: string | null
  jumlahSL: number | null
  totalM3: number | null
  /// BigInt diserialisasi jadi string di batas API (lihat closing.router.ts).
  totalTagihan: string | null
  ditutupBy: { id: string; name: string | null } | null
  dibukaBy: { id: string; name: string | null } | null
}

const rupiah = (n: number | string | null) =>
  n === null ? "—" : `Rp ${Number(n).toLocaleString("id-ID")}`
const angka = (n: number | null) => (n === null ? "—" : n.toLocaleString("id-ID"))

/// 202605 -> "Mei 2026". Periode disimpan sebagai thbl (Int), bukan tanggal.
function labelPeriode(thbl: number): string {
  const th = Math.floor(thbl / 100)
  const bl = thbl % 100
  const nama = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ]
  return bl >= 1 && bl <= 12 ? `${nama[bl - 1]} ${th}` : String(thbl)
}

function periodeSekarang(): number {
  const d = new Date()
  return d.getFullYear() * 100 + (d.getMonth() + 1)
}

/// Bawaan jatuh tempo: akhir bulan berikutnya setelah periode. Ini SEKADAR
/// nilai awal kolom yang tetap harus dikonfirmasi operator — dasar resminya
/// belum ada di sumber data mana pun (lihat prisma/PEMETAAN-DATA.md), jadi
/// tanggalnya sengaja jadi keputusan manusia yang tercatat, bukan rumus.
function usulJatuhTempo(thbl: number): string {
  const th = Math.floor(thbl / 100)
  const bl = thbl % 100
  // Hari ke-0 bulan berikutnya = hari terakhir bulan ini (bl+1 dalam 1-based).
  const akhir = new Date(Date.UTC(th, bl + 1, 0))
  return akhir.toISOString().slice(0, 10)
}

export function ClosingClient({ role, riwayatAwal }: { role: string; riwayatAwal: BarisPeriode[] }) {
  const bolehTutup = SENIOR_UP.has(role)
  const bolehBuka = ADMIN.has(role)

  const [periodeInput, setPeriodeInput] = React.useState(String(periodeSekarang()))
  const [pratinjau, setPratinjau] = React.useState<Pratinjau | null>(null)
  const [memuat, setMemuat] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)

  const [jatuhTempo, setJatuhTempo] = React.useState("")
  const [alasanBuka, setAlasanBuka] = React.useState("")
  const [memproses, setMemproses] = React.useState(false)
  const [hasil, setHasil] = React.useState<HasilClosing | null>(null)
  const [bulanBaru, setBulanBaru] = React.useState<PratinjauBulanBaru | null>(null)
  const [hasilBulanBaru, setHasilBulanBaru] = React.useState<HasilBulanBaru | null>(null)

  // Data awal datang dari server component (queries.ts) — tidak ada effect
  // yang menembak API saat mount. Refresh hanya dilakukan SETELAH periode
  // ditutup/dibuka, yaitu satu-satunya saat daftar ini benar-benar berubah.
  const [riwayat, setRiwayat] = React.useState<BarisPeriode[]>(riwayatAwal)

  const muatRiwayat = React.useCallback(async () => {
    try {
      setRiwayat(await ambilSatu<BarisPeriode[]>("/closing"))
    } catch {
      // Riwayat bersifat pelengkap — kegagalan refresh tidak boleh
      // mengosongkan daftar yang sudah tampil.
    }
  }, [])

  const muatPratinjau = React.useCallback(async (thbl: number) => {
    setMemuat(true)
    setGalat(null)
    setHasil(null)
    setHasilBulanBaru(null)
    try {
      // Keduanya dimuat bersamaan: closing dan buka-bulan-baru adalah satu
      // siklus, dan operator perlu melihat keduanya sebelum memutuskan.
      const [p, bb] = await Promise.all([
        ambilSatu<Pratinjau>(`/closing/${thbl}`),
        ambilSatu<PratinjauBulanBaru>(`/closing/${thbl}/bulan-baru`),
      ])
      setPratinjau(p)
      setBulanBaru(bb)
      setJatuhTempo(usulJatuhTempo(thbl))
    } catch (e) {
      setPratinjau(null)
      setBulanBaru(null)
      setGalat(e instanceof ApiError ? e.message : "Gagal memuat pratinjau periode.")
    } finally {
      setMemuat(false)
    }
  }, [])

  const periodeValid = /^\d{6}$/.test(periodeInput) && Number(periodeInput) % 100 >= 1 && Number(periodeInput) % 100 <= 12

  async function tutup() {
    if (!pratinjau || !jatuhTempo) return
    setMemproses(true)
    setGalat(null)
    try {
      const r = await kirimJson<HasilClosing>(`/closing/${pratinjau.periode}/tutup`, "POST", {
        tanggalJatuhTempo: new Date(`${jatuhTempo}T00:00:00.000Z`).toISOString(),
      })
      setHasil(r)
      await Promise.all([muatPratinjau(pratinjau.periode), muatRiwayat()])
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal menutup periode.")
    } finally {
      setMemproses(false)
    }
  }

  async function terbitkanBulanBaru() {
    if (!bulanBaru) return
    setMemproses(true)
    setGalat(null)
    try {
      setHasilBulanBaru(
        await kirimJson<HasilBulanBaru>(`/closing/${bulanBaru.periodeSumber}/bulan-baru`, "POST", {})
      )
      await muatPratinjau(bulanBaru.periodeSumber)
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal membuka bulan baru.")
    } finally {
      setMemproses(false)
    }
  }

  async function buka() {
    if (!pratinjau || alasanBuka.trim().length < 10) return
    setMemproses(true)
    setGalat(null)
    try {
      await kirimJson(`/closing/${pratinjau.periode}/buka`, "POST", { alasan: alasanBuka.trim() })
      setAlasanBuka("")
      await Promise.all([muatPratinjau(pratinjau.periode), muatRiwayat()])
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal membuka periode.")
    } finally {
      setMemproses(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Pemilih periode ── */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-base font-semibold">Periksa periode</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Masukkan periode dalam bentuk <span className="font-mono">TTTTBB</span> (mis.{" "}
          <span className="font-mono">202606</span> untuk Juni 2026). Pratinjau tidak menulis apa pun — ia menjawab
          &ldquo;kalau ditutup sekarang, apa yang terjadi&rdquo;.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="periode">Periode</Label>
            <Input
              id="periode"
              inputMode="numeric"
              value={periodeInput}
              onChange={(e) => setPeriodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-36 font-mono"
              placeholder="202606"
            />
          </div>
          <Button
            onClick={() => void muatPratinjau(Number(periodeInput))}
            disabled={!periodeValid || memuat}
          >
            {memuat ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {memuat ? "Memuat…" : "Pratinjau"}
          </Button>
          {!periodeValid && periodeInput.length > 0 && (
            <p className="text-xs text-amber-600">Format periode harus TTTTBB dengan bulan 01–12.</p>
          )}
        </div>
        {galat && <p className="mt-3 text-sm text-destructive">{galat}</p>}
      </div>

      {/* ── Hasil closing (setelah tombol ditekan) ── */}
      {hasil && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" />
            <h3 className="text-base font-semibold">
              Periode {labelPeriode(hasil.periode)} ditutup
            </h3>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge className="bg-emerald-600 hover:bg-emerald-600">
              Tagihan baru {angka(hasil.tagihanDiterbitkan)}
            </Badge>
            {hasil.tagihanSudahAda > 0 && (
              <Badge variant="outline">Sudah ada sebelumnya {angka(hasil.tagihanSudahAda)}</Badge>
            )}
            <Badge variant="secondary">Total {angka(hasil.jumlahSL)} SL</Badge>
            <Badge variant="secondary">{angka(hasil.totalM3)} m³</Badge>
            <Badge variant="secondary">{rupiah(hasil.totalTagihan)}</Badge>
          </div>
        </div>
      )}

      {/* ── Pratinjau ── */}
      {pratinjau && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {pratinjau.status === "TERKUNCI" ? (
                <LockKeyhole className="size-5 text-muted-foreground" />
              ) : (
                <LockKeyholeOpen className="size-5 text-primary" />
              )}
              <h3 className="text-base font-semibold">{labelPeriode(pratinjau.periode)}</h3>
            </div>
            <div className="flex items-center gap-2">
              {/* Unduhan DRD hanya muncul untuk periode terkunci — itu juga
                  yang dijaga server. Memakai <a download>, bukan fetch:
                  responsnya berkas CSV 8 MB, biar browser yang menanganinya. */}
              {pratinjau.status === "TERKUNCI" && (
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/v1/closing/${pratinjau.periode}/drd.csv`} download>
                    <Download className="size-3.5" />
                    Unduh DRD
                  </a>
                </Button>
              )}
              <Badge variant={pratinjau.status === "TERKUNCI" ? "secondary" : "outline"}>
                {pratinjau.status === "BELUM_ADA" ? "Belum pernah ditutup" : pratinjau.status}
              </Badge>
            </div>
          </div>

          {/* Grid "menyatu" — grammar yang sama dengan StatCard di Ringkasan. */}
          <div className="mt-4 grid gap-px overflow-hidden border border-border/70 bg-border/70 sm:grid-cols-2 xl:grid-cols-4">
            <Sel
              label="Daftar catat"
              nilai={angka(pratinjau.daftarCatat.total)}
              keterangan={Object.entries(pratinjau.daftarCatat.perStatus)
                .map(([k, v]) => `${k} ${v}`)
                .join(" · ")}
            />
            <Sel
              label="Verifikasi tuntas V3"
              nilai={`${angka(pratinjau.verifikasi.selesaiV3)}/${angka(pratinjau.verifikasi.total)}`}
              keterangan={`${angka(pratinjau.verifikasi.belumSelesai)} belum tuntas`}
              perhatian={pratinjau.verifikasi.belumSelesai > 0}
            />
            <Sel
              label="Pembacaan meter"
              nilai={angka(pratinjau.pembacaan.total)}
              keterangan={`${angka(pratinjau.pembacaan.sudahDitagih)} sudah ditagih · ${angka(pratinjau.pembacaan.akanDitagih)} akan ditagih`}
            />
            <Sel
              label="Perkiraan terbit"
              nilai={rupiah(pratinjau.perkiraan.totalTagihan)}
              keterangan={`${angka(pratinjau.perkiraan.jumlahSL)} SL · ${angka(pratinjau.perkiraan.totalM3)} m³`}
            />
          </div>

          <DaftarHambatan judul="Perlu dibaca sebelum menutup" items={pratinjau.hambatan} />

          {/* ── Aksi ── */}
          <div className="mt-5 border-t pt-4">
            {pratinjau.status === "TERKUNCI" ? (
              bolehBuka ? (
                <div className="max-w-xl space-y-2">
                  <Label htmlFor="alasan">Alasan membuka kembali (wajib, minimal 10 karakter)</Label>
                  <Textarea
                    id="alasan"
                    value={alasanBuka}
                    onChange={(e) => setAlasanBuka(e.target.value)}
                    placeholder="Mis. koreksi stand meter rute 04 setelah pengaduan warga nomor…"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ditolak bila periode ini sudah punya tagihan LUNAS — koreksinya harus lewat penyesuaian tagihan,
                    bukan membuka periode.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => void buka()}
                    disabled={alasanBuka.trim().length < 10 || memproses}
                  >
                    {memproses ? <Loader2 className="size-4 animate-spin" /> : <LockKeyholeOpen className="size-4" />}
                    Buka kembali periode
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Periode terkunci. Hanya Super Admin yang dapat membukanya kembali.
                </p>
              )
            ) : bolehTutup ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="jatuh-tempo" className="flex items-center gap-1.5">
                    <CalendarClock className="size-3.5" />
                    Tanggal jatuh tempo
                  </Label>
                  <Input
                    id="jatuh-tempo"
                    type="date"
                    value={jatuhTempo}
                    onChange={(e) => setJatuhTempo(e.target.value)}
                    className="w-48"
                  />
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={!jatuhTempo || memproses}>
                      {memproses ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
                      Tutup periode &amp; terbitkan tagihan
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Terbitkan tagihan {labelPeriode(pratinjau.periode)}?
                      </AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-2 text-sm">
                          <p>
                            {angka(pratinjau.perkiraan.jumlahSL)} tagihan akan diterbitkan senilai{" "}
                            <span className="font-medium text-foreground">
                              {rupiah(pratinjau.perkiraan.totalTagihan)}
                            </span>
                            , jatuh tempo {jatuhTempo}. Periode lalu dikunci.
                          </p>
                          {pratinjau.hambatan.length > 0 && (
                            <p className="text-amber-600">
                              Masih ada {pratinjau.hambatan.length} hambatan di atas — pelanggan yang terdampak TIDAK
                              akan ditagih pada closing ini.
                            </p>
                          )}
                          <p className="text-muted-foreground">
                            Tagihan yang sudah ada tidak akan ditimpa. Membuka kembali periode ditolak begitu ada satu
                            tagihan yang lunas.
                          </p>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void tutup()}>Ya, tutup periode</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Anda dapat memeriksa pratinjau, tetapi menutup periode memerlukan wewenang Senior Manager ke atas.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Buka bulan baru ── */}
      {bulanBaru && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarPlus className="size-5 text-primary" />
              <h3 className="text-base font-semibold">
                Buka bulan baru — {labelPeriode(bulanBaru.periodeBaru)}
              </h3>
            </div>
            {bulanBaru.tujuan.sudahAda > 0 && (
              <Badge variant="outline">
                Sudah ada {angka(bulanBaru.tujuan.sudahAda)} baris
                {bulanBaru.tujuan.sudahBergerak > 0 && ` · ${angka(bulanBaru.tujuan.sudahBergerak)} sudah dikerjakan`}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Menerbitkan daftar catat {labelPeriode(bulanBaru.periodeBaru)} dari daftar{" "}
            {labelPeriode(bulanBaru.periodeSumber)}, dengan mengeluarkan sambungan yang dicabut pada periode itu.
            Rute &amp; petugasnya di-<em>snapshot</em> dari penugasan yang berlaku sekarang — jadi perbarui zonasi
            dulu bila ada perubahan.
          </p>

          {hasilBulanBaru && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <span className="text-sm font-medium">
                Daftar catat {labelPeriode(hasilBulanBaru.periodeBaru)} diterbitkan:{" "}
                {angka(hasilBulanBaru.dibuat)} sambungan
              </span>
            </div>
          )}

          <div className="mt-4 grid gap-px overflow-hidden border border-border/70 bg-border/70 sm:grid-cols-3">
            <Sel
              label={`Daftar ${bulanBaru.periodeSumber}`}
              nilai={angka(bulanBaru.sumber.total)}
              keterangan={Object.entries(bulanBaru.sumber.perStatus)
                .map(([k, v]) => `${k} ${v}`)
                .join(" · ")}
            />
            <Sel
              label={`Akan dibuat untuk ${bulanBaru.periodeBaru}`}
              nilai={angka(bulanBaru.perkiraan.akanDibuat)}
              keterangan="Sambungan yang wajib dicatat bulan depan"
            />
            {/* `tanpaPencatat` SUPERSET dari `tanpaRute` — sambungan tanpa
                rute pasti juga tanpa pencatat. Jangan dijumlahkan. */}
            <Sel
              label="Belum ada petugasnya"
              nilai={angka(bulanBaru.perkiraan.tanpaPencatat)}
              keterangan={`termasuk ${angka(bulanBaru.perkiraan.tanpaRute)} yang belum punya rute sama sekali`}
              perhatian={bulanBaru.perkiraan.tanpaPencatat > 0}
            />
          </div>

          <DaftarHambatan judul="Rincian" items={bulanBaru.hambatan} />

          <div className="mt-5 border-t pt-4">
            {!bolehTutup ? (
              <p className="text-sm text-muted-foreground">
                Menerbitkan daftar bulan baru memerlukan wewenang Senior Manager ke atas.
              </p>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={!bulanBaru.bisaDibuka || memproses}>
                    {memproses ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
                    Terbitkan daftar catat {bulanBaru.periodeBaru}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Terbitkan daftar catat {labelPeriode(bulanBaru.periodeBaru)}?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2 text-sm">
                        <p>
                          {angka(bulanBaru.perkiraan.akanDibuat)} sambungan akan masuk daftar kerja bulan itu. Ini
                          menentukan beban kunjungan seluruh pencatat.
                        </p>
                        {bulanBaru.tujuan.sudahAda > 0 && (
                          <p className="text-amber-600">
                            Daftar {bulanBaru.periodeBaru} sudah berisi {angka(bulanBaru.tujuan.sudahAda)} baris dan
                            akan diterbitkan ulang. Aman karena belum ada satu pun yang dikerjakan.
                          </p>
                        )}
                        <p className="text-muted-foreground">Aman diulang selama daftarnya belum dipakai bekerja.</p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void terbitkanBulanBaru()}>
                      Ya, terbitkan
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      )}

      {/* ── Riwayat periode ── */}
      {riwayat.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-base font-semibold">Riwayat periode</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground uppercase">
                  <th className="py-2 pr-3 font-medium">Periode</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 text-right font-medium">SL</th>
                  <th className="py-2 pr-3 text-right font-medium">m³</th>
                  <th className="py-2 pr-3 text-right font-medium">Total</th>
                  <th className="py-2 pr-3 font-medium">Jatuh tempo</th>
                  <th className="py-2 font-medium">Ditutup oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {riwayat.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        className="font-mono underline-offset-2 hover:underline"
                        onClick={() => {
                          setPeriodeInput(String(r.periode))
                          void muatPratinjau(r.periode)
                        }}
                      >
                        {r.periode}
                      </button>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant={r.status === "TERKUNCI" ? "secondary" : "outline"}>{r.status}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{angka(r.jumlahSL)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{angka(r.totalM3)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{rupiah(r.totalTagihan)}</td>
                    <td className="py-2 pr-3">{r.tanggalJatuhTempo?.slice(0, 10) ?? "—"}</td>
                    <td className="py-2">
                      {r.ditutupBy?.name ?? "—"}
                      {r.dibukaAt && (
                        <span className="ml-2 text-xs text-amber-600">pernah dibuka kembali</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/// Daftar hambatan yang dipakai bersama oleh panel closing dan panel bulan
/// baru. Hambatan informatif (mis. "19 dicabut tidak ikut") ditampilkan netral,
/// bukan kuning — supaya yang kuning benar-benar berarti perlu tindakan.
function DaftarHambatan({ judul, items }: { judul: string; items: Hambatan[] }) {
  if (items.length === 0) return null
  const adaPeringatan = items.some((h) => !HAMBATAN_INFORMATIF.has(h.kode))
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        {adaPeringatan ? (
          <AlertTriangle className="size-4 text-amber-600" />
        ) : (
          <Info className="size-4 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">{judul}</p>
      </div>
      <ul className="mt-2 space-y-2">
        {items.map((h) => {
          const informatif = HAMBATAN_INFORMATIF.has(h.kode)
          return (
            <li
              key={h.kode}
              className={
                informatif
                  ? "rounded-lg border bg-muted/30 p-3"
                  : "rounded-lg border border-amber-500/40 bg-amber-500/5 p-3"
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    informatif
                      ? "font-mono text-[10px] text-muted-foreground"
                      : "border-amber-500 font-mono text-[10px] text-amber-700"
                  }
                >
                  {h.kode}
                </Badge>
                {h.jumlah > 0 && <span className="text-sm font-medium">{angka(h.jumlah)} pelanggan</span>}
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{h.pesan}</p>
              {h.contoh.length > 0 && (
                <p className="mt-1.5 font-mono text-xs break-all text-muted-foreground">
                  {h.contoh.join(", ")}
                  {h.jumlah > h.contoh.length && ` … (+${h.jumlah - h.contoh.length} lagi)`}
                </p>
              )}
            </li>
          )
        })}
      </ul>
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
