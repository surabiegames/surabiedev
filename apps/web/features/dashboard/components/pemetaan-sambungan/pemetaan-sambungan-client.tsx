"use client"

// Pemetaan sambungan ke rute — menutup celah antara "sambungan sudah ada di
// database" dan "sambungan benar-benar dikunjungi petugas".
//
// Dua keadaan yang akibatnya SAMA tapi sebabnya beda:
//   TANPA RUTE            belum punya rute sama sekali (mis. PBPK yang
//                         kd_rute-nya palsu seperti "99999")
//   RUTE TANPA PENCATAT   rutenya ada tapi belum ditugaskan ke siapa pun
//
// Keduanya berakibat: tidak muncul di beban kerja siapa pun -> tidak
// dikunjungi -> tidak dicatat -> tidak tertagih. Sambungan yang "ada" tapi
// tak pernah ditagih adalah kebocoran pendapatan yang diam.
//
// BENTUK TABEL, BUKAN KARTU BERTINGKAT. Versi sebelumnya menumpuk kontrol
// dua baris per sambungan; dengan 25 baris layarnya jadi panjang dan mata
// harus mencari medan yang sama di tempat yang berbeda-beda. Tabel menaruh
// tiap medan di kolomnya sendiri, sehingga puluhan baris terbaca sekali
// pandang — dan yang lebih penting, bisa dikerjakan BORONGAN lewat ceklis.
//
// SATU SIMPAN, DUA PEKERJAAN. Satu baris memuat pemetaan rute DAN pencatatan
// awal. Memisahkannya membuat operator gampang mengerjakan yang satu lalu
// lupa yang lain, dan sambungan setengah-siap tidak akan pernah tertagih.
//
// Yang dibuat di sini adalah LaporanHarianPetugas, BUKAN pembacaan resmi. Ia
// tetap lewat verifikasi V1-V3 seperti setoran petugas mana pun — tidak ada
// pintu belakang yang melahirkan angka resmi tanpa diperiksa.

import * as React from "react"
import { CheckCircle2, Columns3, Download, Loader2, MapPin, TriangleAlert } from "lucide-react"
import { ambilSatu, kirimJson, ApiError } from "../../lib/api-client"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { NativeSelect } from "@workspace/ui/components/native-select"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@workspace/ui/components/popover"
import { LABEL_KONDISI_CATAT } from "../../lib/label"
import { usePeriodeKerja } from "../../lib/periode-kerja"

const SUPERVISOR_UP = new Set([
  "SUPER_ADMIN",
  "DIREKSI",
  "SENIOR_MANAGER",
  "MANAGER",
  "SUPERVISOR",
])

/// Kondisi yang masuk akal untuk pencatatan AWAL sambungan baru. Sengaja
/// bukan seluruh 22 nilai enum — daftar panjang justru menyulitkan memilih,
/// dan sisanya keadaan yang hanya muncul pada sambungan yang sudah berjalan.
const KONDISI_CATAT = ["NORMAL", "TIDAK_DIPAKAI", "RUMAH_KOSONG", "METER_RUSAK", "TTB", "MTA"] as const

interface Sambungan {
  id: string
  nomorLangganan: string
  nama: string
  alamat: string
  rt: string | null
  rw: string | null
  kelurahan: string | null
  ruteId: string | null
  noUrutRute: number | null
  kodeRute: string | null
  /// Sudah punya laporan pada periode kerja. Barisnya TETAP ditampilkan —
  /// rutenya masih boleh dikoreksi — tapi tidak lagi dihitung sebagai
  /// pekerjaan yang menunggu, dan menyimpannya ulang tidak membuat laporan
  /// kedua.
  sudahDicatat: boolean
}
interface OpsiRute {
  id: string
  kode: string
  pencatat: string | null
}
export interface DataPerluRute {
  tanpaRute: Sambungan[]
  ruteTanpaPencatat: Sambungan[]
  rute: OpsiRute[]
}

/// Isian per baris, dipegang komponen INDUK (bukan tiap baris) supaya aksi
/// massal bisa menulis ke banyak baris sekaligus tanpa mengintip state anak.
interface Isian {
  ruteId: string
  urut: string
  standAwal: string
  standAkhir: string
  kondisi: string
}

const isianAwal = (s: Sambungan): Isian => ({
  ruteId: s.ruteId ?? "",
  urut: s.noUrutRute === null ? "" : String(s.noUrutRute),
  // Sambungan baru lazimnya mulai dari nol, tapi TIDAK dipaksakan: meter
  // bekas punya stand awalnya sendiri, dan mengunci nilainya di 0 justru
  // memaksa operator memalsukan angka.
  standAwal: "0",
  standAkhir: "0",
  kondisi: "NORMAL",
})

/// Kolom tabel didefinisikan SEKALI di sini, lalu dipakai header, badan, dan
/// penyaring tampilan. Tanpa sumber tunggal, menyembunyikan satu kolom
/// menuntut tiga tempat diubah serentak — dan yang terlewat menghasilkan
/// header bergeser dari isinya, cacat yang sulit dilihat sampai dipakai.
const KOLOM = [
  { id: "nomorLangganan", label: "No. langganan", lebar: 150, tetap: true },
  { id: "nama", label: "Nama", lebar: 200 },
  { id: "alamat", label: "Alamat", lebar: 280 },
  { id: "rt", label: "RT", lebar: 70 },
  { id: "rw", label: "RW", lebar: 70 },
  { id: "kelurahan", label: "Kelurahan", lebar: 170 },
  { id: "standAwal", label: "St awal", lebar: 110 },
  { id: "standAkhir", label: "St akhir", lebar: 110 },
  { id: "pakai", label: "m³", lebar: 80 },
  { id: "kondisi", label: "Ket. catat", lebar: 190 },
  { id: "rute", label: "Rute", lebar: 230 },
  { id: "urut", label: "No. urut", lebar: 100 },
  { id: "aksi", label: "Aksi", lebar: 110, tetap: true },
] as const

type IdKolom = (typeof KOLOM)[number]["id"]

/// Lebar kolom beku (ceklis + no. langganan) — dipakai header DAN badan
/// supaya `left` keduanya sama. Salah 1px di sini membuat kolom kedua
/// menindih yang pertama saat digulir mendatar.
const L_CEKLIS = 44
const X_NOMOR = L_CEKLIS

const angka = (n: number) => n.toLocaleString("id-ID")

export function PemetaanSambunganClient({ role, dataAwal }: { role: string; dataAwal: DataPerluRute }) {
  const boleh = SUPERVISOR_UP.has(role)
  const [data, setData] = React.useState(dataAwal)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [tersimpan, setTersimpan] = React.useState<Set<string>>(new Set())
  const [terpilih, setTerpilih] = React.useState<Set<string>>(new Set())
  const [sibuk, setSibuk] = React.useState(false)
  const [kemajuan, setKemajuan] = React.useState<{ n: number; total: number } | null>(null)
  /// Kolom yang sedang ditampilkan. Kolom `tetap` tidak bisa disembunyikan —
  /// tanpa nomor langganan dan tombol aksi, tabelnya tidak bisa dipakai.
  const [tampil, setTampil] = React.useState<Set<IdKolom>>(new Set(KOLOM.map((k) => k.id)))

  const kolomTampil = KOLOM.filter((k) => tampil.has(k.id))

  /// Periode yang dikerjakan = periode TERBARU yang sudah punya data, bukan
  /// bulan kalender. Closing kerap tertinggal dari kalender, dan memakai
  /// bulan berjalan akan membuat pencatatan awal mendarat di periode yang
  /// belum dibuka.
  const { periodeKerja, siap: periodeSiap } = usePeriodeKerja()
  const periodeAktif = periodeKerja ?? 0



  /// Render awal dari server belum tahu periodenya, jadi daftarnya baru
  /// memuat sambungan tanpa rute. Begitu periode KERJA diketahui, muat ulang
  /// supaya SELURUH PBPK periode itu ikut tampil — termasuk yang rutenya
  /// sudah terisi dan mungkin perlu dikoreksi.
  ///
  /// Ditunda sampai periodenya datang dari server. Versi sebelumnya memakai
  /// penjaga "sekali jalan" yang menyala pada render PERTAMA — saat itu
  /// periodeAktif masih bulan kalender (mis. Juli), jadi ia memuat ulang
  /// untuk periode yang salah lalu memblokir dirinya sendiri. Akibatnya
  /// layar tetap menampilkan 25 baris, bukan 26.
  const sudahMuat = React.useRef(false)
  React.useEffect(() => {
    if (sudahMuat.current || !periodeSiap || periodeKerja === null) return
    sudahMuat.current = true
    void muatUlang()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodeSiap, periodeKerja])

  const baris = React.useMemo(
    () => [...data.tanpaRute, ...data.ruteTanpaPencatat],
    [data]
  )

  const [isian, setIsian] = React.useState<Record<string, Isian>>(() =>
    Object.fromEntries(
      [...dataAwal.tanpaRute, ...dataAwal.ruteTanpaPencatat].map((s) => [s.id, isianAwal(s)])
    )
  )

  async function muatUlang() {
    try {
      const d = await ambilSatu<DataPerluRute>("/pelanggan/perlu-rute", { periode: periodeAktif })
      setData(d)
      setIsian(Object.fromEntries([...d.tanpaRute, ...d.ruteTanpaPencatat].map((s) => [s.id, isianAwal(s)])))
      setTersimpan(new Set([...d.tanpaRute, ...d.ruteTanpaPencatat].filter((s) => s.sudahDicatat).map((s) => s.id)))
      setTerpilih(new Set())
      setGalat(null)
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal memuat daftar.")
    }
  }

  const tersisa = baris.filter((b) => !tersimpan.has(b.id))
  const semuaTerpilih = tersisa.length > 0 && tersisa.every((b) => terpilih.has(b.id))

  const ubah = (id: string, k: keyof Isian, v: string) =>
    setIsian((lama) => (lama[id] ? { ...lama, [id]: { ...lama[id]!, [k]: v } } : lama))

  /// Menulis satu medan ke SEMUA baris terpilih — inti dari aksi massal.
  const ubahTerpilih = (k: keyof Isian, v: string) =>
    setIsian((lama) => {
      const baru = { ...lama }
      for (const id of terpilih) if (baru[id]) baru[id] = { ...baru[id]!, [k]: v }
      return baru
    })

  /// Mengekspor tabel ke Excel. Yang diekspor mengikuti APA YANG TERLIHAT:
  /// kolom yang sedang ditampilkan, dan baris terpilih bila ada — kalau tidak
  /// ada yang diceklis, seluruh baris. Mengekspor kolom yang sengaja
  /// disembunyikan akan membuat berkasnya tidak cocok dengan yang dilihat
  /// orang saat menekan tombolnya.
  ///
  /// Nilai yang diambil adalah ISIAN SAAT INI, bukan data awal dari server —
  /// jadi rute dan stand yang baru diketik operator ikut terbawa meski belum
  /// disimpan. Itu yang membuat tombol ini berguna untuk ditinjau atasan
  /// sebelum penyimpanan dijalankan.
  async function eksporExcel() {
    setGalat(null)
    try {
      const XLSX = await import("xlsx")
      const kodeRute = new Map(data.rute.map((r) => [r.id, r.kode]))
      const petugas = new Map(data.rute.map((r) => [r.id, r.pencatat ?? ""]))
      const sumber = terpilih.size > 0 ? baris.filter((b) => terpilih.has(b.id)) : baris

      const nilai: Record<IdKolom, (b: Sambungan, f: Isian) => string | number> = {
        nomorLangganan: (b) => b.nomorLangganan,
        nama: (b) => b.nama,
        alamat: (b) => b.alamat,
        rt: (b) => b.rt ?? "",
        rw: (b) => b.rw ?? "",
        kelurahan: (b) => b.kelurahan ?? "",
        standAwal: (_b, f) => Number(f.standAwal || "0"),
        standAkhir: (_b, f) => Number(f.standAkhir || "0"),
        pakai: (_b, f) => Math.max(0, Number(f.standAkhir || "0") - Number(f.standAwal || "0")),
        kondisi: (_b, f) => LABEL_KONDISI_CATAT[f.kondisi] ?? f.kondisi,
        rute: (_b, f) => kodeRute.get(f.ruteId) ?? "",
        urut: (_b, f) => (f.urut === "" ? "" : Number(f.urut)),
        // Kolom Aksi tidak punya arti di luar layar; diganti kolom yang
        // benar-benar berguna di Excel: siapa petugasnya.
        aksi: (_b, f) => petugas.get(f.ruteId) ?? "",
      }
      const judul: Record<IdKolom, string> = Object.fromEntries(
        KOLOM.map((k) => [k.id, k.id === "aksi" ? "Petugas" : k.label])
      ) as Record<IdKolom, string>

      const isi = sumber.map((b) => {
        const f = isian[b.id]!
        return Object.fromEntries(kolomTampil.map((k) => [judul[k.id], nilai[k.id](b, f)]))
      })

      const ws = XLSX.utils.json_to_sheet(isi, { header: kolomTampil.map((k) => judul[k.id]) })
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Pemetaan")
      XLSX.writeFile(wb, `pemetaan-sambungan-${periodeAktif}-${sumber.length}baris.xlsx`)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal mengekspor.")
    }
  }

  /// Menyimpan satu sambungan: rute (bila dipilih) DAN pencatatan awal.
  /// Dua permintaan karena memang dua sumber daya berbeda; yang disatukan
  /// adalah PEKERJAANNYA, bukan permintaannya.
  async function simpanSatu(s: Sambungan): Promise<void> {
    const f = isian[s.id]
    if (!f) return
    if (f.ruteId) {
      await kirimJson(`/pelanggan/${s.id}`, "PATCH", {
        ruteId: f.ruteId,
        noUrutRute: f.urut.trim() === "" ? null : Number(f.urut),
      })
    }
    // Baris yang sudah punya laporan periode ini CUKUP diperbarui rutenya.
    // Mengirim laporan kedua akan ditolak server (unique nomor+periode) dan
    // membuat koreksi rute terlihat gagal padahal rutenya sudah tersimpan.
    if (s.sudahDicatat) return
    await kirimJson("/laporan-harian", "POST", {
      nomorLangganan: s.nomorLangganan,
      pelangganId: s.id,
      periode: periodeAktif,
      standAwal: Number(f.standAwal || "0"),
      standAkhir: Number(f.standAkhir || "0"),
      kondisi: f.kondisi,
    })
  }

  async function simpan(daftar: Sambungan[]) {
    setSibuk(true)
    setGalat(null)
    setKemajuan({ n: 0, total: daftar.length })
    const berhasil = new Set(tersimpan)
    const gagal: string[] = []
    for (const [i, s] of daftar.entries()) {
      try {
        await simpanSatu(s)
        berhasil.add(s.id)
      } catch (e) {
        gagal.push(`${s.nomorLangganan}: ${e instanceof ApiError ? e.message : "gagal"}`)
      }
      setKemajuan({ n: i + 1, total: daftar.length })
    }
    setTersimpan(berhasil)
    setTerpilih(new Set())
    setSibuk(false)
    setKemajuan(null)
    if (gagal.length > 0) setGalat(`${gagal.length} baris gagal — ${gagal.slice(0, 3).join(" · ")}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {tersisa.length === 0 ? (
            <CheckCircle2 className="size-6 text-emerald-600" aria-hidden />
          ) : (
            <TriangleAlert className="size-6 text-amber-500" aria-hidden />
          )}
          <div>
            <p className="text-base font-semibold">
              {tersisa.length === 0
                ? "Semua sambungan sudah terpetakan"
                : `${angka(tersisa.length)} sambungan perlu dipetakan`}
            </p>
            <p className="text-muted-foreground text-xs">
              {data.tanpaRute.length} tanpa rute · {data.ruteTanpaPencatat.length} rutenya tanpa
              pencatat · pencatatan awal masuk ke periode {periodeAktif}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void muatUlang()} disabled={sibuk}>
          Muat ulang
        </Button>
      </div>

      {galat && <p className="text-destructive text-sm">{galat}</p>}
      {!boleh && tersisa.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Menetapkan rute memerlukan wewenang Supervisor ke atas. Anda tetap bisa melihat daftarnya.
        </p>
      )}

      {/* ── Aksi massal: isi sekali, berlaku ke semua yang diceklis ───────── */}
      {terpilih.size > 0 && (
        <div className="border-border/70 bg-card flex flex-wrap items-center gap-2 border p-2">
          <Badge className="tabular-nums">{terpilih.size} dipilih</Badge>
          <span className="text-muted-foreground text-[11px]">terapkan ke semua terpilih:</span>

          <NativeSelect
            defaultValue=""
            onChange={(e) => e.target.value && ubahTerpilih("ruteId", e.target.value)}
            disabled={!boleh || sibuk}
            className="h-8 w-56"
            aria-label="Terapkan rute ke semua terpilih"
          >
            <option value="">— rute —</option>
            {data.rute.map((r) => (
              <option key={r.id} value={r.id}>
                {r.kode} {r.pencatat ? `· ${r.pencatat}` : "· BELUM ADA PETUGAS"}
              </option>
            ))}
          </NativeSelect>

          <NativeSelect
            defaultValue=""
            onChange={(e) => e.target.value && ubahTerpilih("kondisi", e.target.value)}
            disabled={!boleh || sibuk}
            className="h-8 w-48"
            aria-label="Terapkan keterangan catat ke semua terpilih"
          >
            <option value="">— ket. catat —</option>
            {KONDISI_CATAT.map((k) => (
              <option key={k} value={k}>{LABEL_KONDISI_CATAT[k] ?? k}</option>
            ))}
          </NativeSelect>

          <Button
            size="sm"
            variant="secondary"
            className="h-8"
            disabled={!boleh || sibuk}
            onClick={() => {
              ubahTerpilih("standAwal", "0")
              ubahTerpilih("standAkhir", "0")
            }}
          >
            Stand 0 → 0
          </Button>

          <Button
            size="sm"
            className="h-8"
            disabled={!boleh || sibuk}
            onClick={() => void simpan(tersisa.filter((b) => terpilih.has(b.id)))}
          >
            {sibuk ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <MapPin className="size-3.5" aria-hidden />
            )}
            Simpan {terpilih.size} baris
          </Button>

          {kemajuan && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {kemajuan.n} / {kemajuan.total}
            </span>
          )}
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setTerpilih(new Set())} disabled={sibuk}>
            Batal pilih
          </Button>
        </div>
      )}

      {/* ── Bilah alat: penyaring kolom + impor berkas ───────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Columns3 className="size-3.5" aria-hidden />
              Kolom ({kolomTampil.length}/{KOLOM.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <p className="text-muted-foreground mb-2 px-1 text-[11px]">
              Pilih kolom yang ditampilkan
            </p>
            <div className="flex flex-col gap-0.5">
              {KOLOM.map((k) => (
                <label
                  key={k.id}
                  className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm"
                >
                  <Checkbox
                    checked={tampil.has(k.id)}
                    // Kolom tetap tidak bisa dimatikan: tanpa nomor langganan
                    // dan tombol aksi, tabelnya berhenti bisa dipakai.
                    disabled={"tetap" in k && k.tetap}
                    onCheckedChange={(v) =>
                      setTampil((s) => {
                        const n = new Set(s)
                        if (v === true) n.add(k.id)
                        else n.delete(k.id)
                        return n
                      })
                    }
                  />
                  <span>{k.label}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="sm" className="h-8" onClick={() => void eksporExcel()}>
          <Download className="size-3.5" aria-hidden />
          Export Excel{terpilih.size > 0 ? ` (${terpilih.size} terpilih)` : ""}
        </Button>
        <span className="text-muted-foreground text-[11px]">
          mengikuti kolom yang tampil; baris terpilih saja bila ada yang diceklis
        </span>
      </div>

      {/* ── Tabel ─────────────────────────────────────────────────────────
          Tinggi dipatok supaya header BISA sticky: `position: sticky` butuh
          wadah yang benar-benar menggulir, dan wadah tanpa tinggi tidak
          pernah menggulir sehingga headernya tak pernah menempel. */}
      <div className="scrollbar-tipis border-border/70 max-h-[65vh] overflow-auto border">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="text-muted-foreground bg-muted/95 supports-[backdrop-filter]:bg-muted/85 [&>th]:border-border/70 [&>th]:border-b [&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-xs [&>th]:font-semibold [&>th]:whitespace-nowrap [&>th]:backdrop-blur">
              <th
                className="bg-muted/95 supports-[backdrop-filter]:bg-muted/85 sticky z-30 backdrop-blur"
                style={{ left: 0, width: L_CEKLIS, minWidth: L_CEKLIS }}
              >
                <Checkbox
                  checked={semuaTerpilih}
                  onCheckedChange={(v) =>
                    setTerpilih(v === true ? new Set(tersisa.map((b) => b.id)) : new Set())
                  }
                  disabled={!boleh || sibuk || tersisa.length === 0}
                  aria-label="Pilih semua"
                />
              </th>
              {kolomTampil.map((k) => {
                const beku = k.id === "nomorLangganan"
                return (
                  <th
                    key={k.id}
                    className={
                      beku
                        ? "bg-muted/95 supports-[backdrop-filter]:bg-muted/85 border-border/70 sticky z-30 border-r backdrop-blur"
                        : k.id === "pakai"
                          ? "text-right"
                          : undefined
                    }
                    style={beku ? { left: X_NOMOR, minWidth: k.lebar } : { minWidth: k.lebar }}
                  >
                    {k.label}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => {
              const f = isian[b.id]
              if (!f) return null
              const sudah = tersimpan.has(b.id)
              const pakai = Math.max(0, Number(f.standAkhir || "0") - Number(f.standAwal || "0"))
              // Baris selesai TIDAK dikunci: rutenya justru yang paling
              // mungkin perlu dikoreksi. Yang dimatikan hanya kolom
              // pencatatan, karena laporannya sudah terbit.
              const mati = !boleh || sibuk
              const matiCatat = mati || sudah
              // Sel beku butuh latar SENDIRI — tanpa ini isi kolom lain
              // terlihat menembus saat digulir mendatar.
              const latarBeku = `bg-card sticky z-10 ${sudah ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""}`

              const isi: Record<IdKolom, React.ReactNode> = {
                nomorLangganan: (
                  <>
                    {b.nomorLangganan}
                    {b.kodeRute && (
                      <Badge variant="outline" className="ml-2 text-[10px]">{b.kodeRute}</Badge>
                    )}
                  </>
                ),
                nama: b.nama,
                alamat: b.alamat,
                rt: b.rt ?? "—",
                rw: b.rw ?? "—",
                kelurahan: b.kelurahan ?? "—",
                standAwal: (
                  <Input
                    inputMode="numeric"
                    value={f.standAwal}
                    onChange={(e) => ubah(b.id, "standAwal", e.target.value.replace(/\D/g, ""))}
                    className="h-8 w-24"
                    disabled={matiCatat}
                    aria-label={`Stand awal ${b.nomorLangganan}`}
                  />
                ),
                standAkhir: (
                  <Input
                    inputMode="numeric"
                    value={f.standAkhir}
                    onChange={(e) => ubah(b.id, "standAkhir", e.target.value.replace(/\D/g, ""))}
                    className="h-8 w-24"
                    disabled={matiCatat}
                    aria-label={`Stand akhir ${b.nomorLangganan}`}
                  />
                ),
                pakai: pakai,
                kondisi: (
                  <NativeSelect
                    value={f.kondisi}
                    onChange={(e) => ubah(b.id, "kondisi", e.target.value)}
                    className="h-8 w-44"
                    disabled={matiCatat}
                    aria-label={`Keterangan catat ${b.nomorLangganan}`}
                  >
                    {KONDISI_CATAT.map((k) => (
                      <option key={k} value={k}>{LABEL_KONDISI_CATAT[k] ?? k}</option>
                    ))}
                  </NativeSelect>
                ),
                rute: (
                  <NativeSelect
                    value={f.ruteId}
                    onChange={(e) => ubah(b.id, "ruteId", e.target.value)}
                    className="h-8 w-52"
                    disabled={mati}
                    aria-label={`Rute ${b.nomorLangganan}`}
                  >
                    <option value="">— pilih rute —</option>
                    {data.rute.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.kode} {r.pencatat ? `· ${r.pencatat}` : "· BELUM ADA PETUGAS"}
                      </option>
                    ))}
                  </NativeSelect>
                ),
                urut: (
                  <Input
                    inputMode="numeric"
                    value={f.urut}
                    onChange={(e) => ubah(b.id, "urut", e.target.value.replace(/\D/g, ""))}
                    className="h-8 w-20"
                    disabled={mati}
                    aria-label={`Urutan kunjungan ${b.nomorLangganan}`}
                  />
                ),
                aksi: sudah ? (
                  <span className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5" aria-hidden /> Selesai
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      disabled={!boleh || sibuk}
                      onClick={() => void simpan([b])}
                      title="Simpan perubahan rute / urutan"
                    >
                      Koreksi rute
                    </Button>
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8"
                    disabled={!boleh || sibuk}
                    onClick={() => void simpan([b])}
                  >
                    Simpan
                  </Button>
                ),
              }

              return (
                <tr
                  key={b.id}
                  className={`[&>td]:border-border/40 [&>td]:border-b [&>td]:px-3 [&>td]:py-2 [&>td]:whitespace-nowrap ${
                    sudah ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "hover:bg-accent/40"
                  }`}
                >
                  <td className={latarBeku} style={{ left: 0, width: L_CEKLIS }}>
                    <Checkbox
                      checked={terpilih.has(b.id)}
                      disabled={mati}
                      onCheckedChange={() =>
                        setTerpilih((s) => {
                          const n = new Set(s)
                          if (n.has(b.id)) n.delete(b.id)
                          else n.add(b.id)
                          return n
                        })
                      }
                      aria-label={`Pilih ${b.nomorLangganan}`}
                    />
                  </td>
                  {kolomTampil.map((k) => {
                    if (k.id === "nomorLangganan") {
                      return (
                        <td key={k.id} className={`${latarBeku} border-border/70 border-r font-mono`} style={{ left: X_NOMOR }}>
                          {isi[k.id]}
                        </td>
                      )
                    }
                    const kelas =
                      k.id === "nama" ? "max-w-56 truncate"
                      : k.id === "alamat" ? "text-muted-foreground max-w-72 truncate"
                      : k.id === "kelurahan" ? "text-muted-foreground max-w-44 truncate"
                      : k.id === "rt" || k.id === "rw" ? "text-muted-foreground tabular-nums"
                      : k.id === "pakai" ? "text-muted-foreground text-right tabular-nums"
                      : undefined
                    const judul =
                      k.id === "nama" ? b.nama
                      : k.id === "alamat" ? b.alamat
                      : k.id === "kelurahan" ? (b.kelurahan ?? "")
                      : undefined
                    return (
                      <td key={k.id} className={kelas} title={judul}>
                        {isi[k.id]}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        {baris.length === 0 && (
          <p className="text-muted-foreground p-8 text-center text-sm">
            Tidak ada sambungan yang perlu dipetakan.
          </p>
        )}
      </div>
    </div>
  )
}
