"use client"

// features/dashboard/components/verifikasi/tabel-verifikasi.tsx — tabel
// khusus layar verifikasi.
//
// KENAPA BUKAN DataGrid BERSAMA. Halaman ini butuh lima hal yang tidak
// dimiliki halaman lain: kotak centang + aksi massal, pewarnaan per ring,
// 5.000 baris sekaligus, kolom beku, dan navigasi papan ketik. Menambahkan
// semuanya ke DataGrid bersama berarti mempertaruhkan belasan halaman lain
// demi satu halaman.
//
// GULIR MENDATAR — sumber bug yang lama tak terlihat. Versi pertama memakai
// `w-full` pada <table>. Itu memerintahkan tabel MUAT ke lebar wadah, jadi
// 15 kolom saling menghimpit sampai tak terbaca dan gulir mendatar tidak
// pernah muncul — gejalanya persis "kolom bergeser / terpotong tepi
// halaman". Yang benar `w-max min-w-full`: tumbuh mengikuti isi, tapi tidak
// pernah lebih sempit dari wadahnya. Seluruh rantai induk juga wajib
// `min-w-0`, kalau tidak flexbox menolak menyusut dan luberannya dipotong
// diam-diam alih-alih memunculkan scrollbar.
//
// KOLOM BEKU. Ceklis dan nomor langganan dipatok kiri: menggulir ke kolom
// `%` tanpa ini membuat orang kehilangan jejak baris siapa yang dilihat.

import * as React from "react"
import { Check } from "lucide-react"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { LABEL_KONDISI_CATAT } from "../../lib/label"
import { GAYA_TAHAP, GAYA_BELUM_DIBACA, gayaAnomali, tahapDari, type Tahap } from "./warna-ring"

export interface BarisVerifikasi {
  id: string
  nomorLangganan?: string | null
  namaPelanggan?: string | null
  alamatPelanggan?: string | null
  periode?: number | null
  standAwal?: number | null
  standAkhir?: number | null
  standAkhirRevisi?: number | null
  pemakaian?: number | null
  pemakaianLalu?: number | null
  persentase?: number | null
  kondisi?: string | null
  tanggalCatat?: string | null
  verif1At?: string | null
  verif2At?: string | null
  verif3At?: string | null
  verifiedAt?: string | null
  isVerified?: boolean | null
  pencatat?: { id: string; namaLapangan: string } | null
  pelanggan?: {
    nomorLangganan?: string
    nama?: string
    alamat?: string | null
    rute?: { kode?: string } | null
  } | null
}

export type Kerapatan = "padat" | "normal"

const angka = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n.toLocaleString("id-ID")

const tanggal = (s: string | null | undefined) => {
  if (!s) return "—"
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
}

function Lencana({ kelas, anak }: { kelas: string; anak: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${kelas}`}>
      {anak}
    </span>
  )
}

/// Warna TIAP ring berbeda, bukan tiga titik sewarna. Itu yang membuat
/// "sudah sampai mana" terbaca dalam sekali pandang tanpa membaca teks:
/// V1 kuning, V2 biru, V3 hijau — sama persis dengan warna baris & lencana
/// tahapnya, jadi tidak ada kosakata warna kedua yang harus dihafal.
const WARNA_TITIK = {
  1: "bg-amber-500 dark:bg-amber-400",
  2: "bg-sky-500 dark:bg-sky-400",
  3: "bg-emerald-500 dark:bg-emerald-400",
} as const

function TitikRing({ tahap }: { tahap: Tahap }) {
  const lolos = (r: 1 | 2 | 3) =>
    tahap === "V3" || (tahap === "V2" && r <= 2) || (tahap === "V1" && r === 1)
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Tahap ${GAYA_TAHAP[tahap].label}`}>
      {([1, 2, 3] as const).map((r) => (
        <span
          key={r}
          aria-hidden
          title={`V${r}`}
          className={`size-2.5 rounded-full ${
            lolos(r)
              ? WARNA_TITIK[r]
              : tahap === "DITOLAK"
                ? "bg-rose-400 dark:bg-rose-500"
                : "ring-muted-foreground/30 bg-transparent ring-1 ring-inset"
          }`}
        />
      ))}
    </span>
  )
}

/// Lebar kolom beku — dipakai header DAN badan supaya `left` keduanya sama.
/// Ditulis sebagai konstanta karena salah 1px di sini membuat kolom kedua
/// menindih yang pertama saat digulir.
const L_CEKLIS = 40
const L_RING = 64
const L_NOMOR = 160
/// Offset kiri tiap kolom beku, dijumlahkan sekali di sini. Menghitungnya
/// ulang di tiap tempat adalah cara paling mudah membuat kolom saling
/// menindih saat digulir.
const X_RING = L_CEKLIS
const X_NOMOR = L_CEKLIS + L_RING

export function TabelVerifikasi({
  rows,
  terpilih,
  onToggle,
  onToggleSemua,
  idTerpilih,
  onKlikBaris,
  onKlikKanan,
  ambangAnomali,
  modeBelumDibaca = false,
  memuat,
  kerapatan = "normal",
}: {
  rows: BarisVerifikasi[]
  terpilih: Set<string>
  onToggle: (id: string, rentangDariShift: boolean, indeks: number) => void
  onToggleSemua: (pilih: boolean) => void
  idTerpilih: string | null
  onKlikBaris: (row: BarisVerifikasi) => void
  onKlikKanan: (row: BarisVerifikasi, posisi: { x: number; y: number }) => void
  ambangAnomali: number
  modeBelumDibaca?: boolean
  memuat: boolean
  kerapatan?: Kerapatan
}) {
  const semuaTerpilih = rows.length > 0 && rows.every((r) => terpilih.has(r.id))
  const sebagianTerpilih = !semuaTerpilih && rows.some((r) => terpilih.has(r.id))
  const wadahRef = React.useRef<HTMLDivElement>(null)

  // `[&_td]` (keturunan), BUKAN `[&>td]` (anak langsung). Kelas ini dipasang
  // di <table>, sedangkan <td> adalah anak <tr> — dengan `>` aturannya tidak
  // pernah kena satu sel pun, dan tombol Padat/Normal jadi terlihat rusak
  // padahal state-nya berubah dengan benar.
  const pad = kerapatan === "padat" ? "[&_td]:py-1 [&_th]:py-1.5" : "[&_td]:py-2.5 [&_th]:py-3"
  const tinggiBaris = kerapatan === "padat" ? "0 32px" : "0 44px"

  // Baris aktif selalu ditarik ke dalam pandangan — tanpa ini navigasi
  // panah "hilang" begitu melewati tepi bawah layar.
  React.useEffect(() => {
    if (!idTerpilih || !wadahRef.current) return
    const el = wadahRef.current.querySelector<HTMLElement>(`[data-id="${idTerpilih}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [idTerpilih])

  const thBeku = "bg-muted/95 supports-[backdrop-filter]:bg-muted/85 sticky z-30 backdrop-blur"

  return (
    <div
      ref={wadahRef}
      // min-w-0 di sini WAJIB: tanpa itu induk flex menolak menyusut dan
      // luberan tabel dipotong, bukan digulir.
      className="scrollbar-tipis border-border/70 relative h-full min-w-0 overflow-auto border"
    >
      {/* w-max min-w-full = tumbuh mengikuti isi, minimal selebar wadah. */}
      <table className={`w-max min-w-full border-collapse text-sm ${pad}`}>
        <thead className="sticky top-0 z-20">
          <tr className="text-muted-foreground bg-muted/95 supports-[backdrop-filter]:bg-muted/85 [&>th]:border-border/70 [&>th]:border-b [&>th]:px-3 [&>th]:text-left [&>th]:text-xs [&>th]:font-semibold [&>th]:whitespace-nowrap [&>th]:backdrop-blur">
            <th className={thBeku} style={{ left: 0, width: L_CEKLIS, minWidth: L_CEKLIS }}>
              <Checkbox
                checked={semuaTerpilih ? true : sebagianTerpilih ? "indeterminate" : false}
                onCheckedChange={(v) => onToggleSemua(v === true)}
                aria-label="Pilih semua baris yang tampil"
              />
            </th>
            <th className={thBeku} style={{ left: X_RING, width: L_RING, minWidth: L_RING }}>
              Ring
            </th>
            <th
              className={`${thBeku} border-border/70 border-r`}
              style={{ left: X_NOMOR, width: L_NOMOR, minWidth: L_NOMOR }}
            >
              No. langganan
            </th>
            <th style={{ minWidth: 240 }}>Nama</th>
            <th style={{ minWidth: 340 }}>Alamat</th>
            {!modeBelumDibaca && (
              <>
                <th className="text-right" style={{ minWidth: 112 }}>St awal</th>
                <th className="text-right" style={{ minWidth: 112 }}>St akhir</th>
                <th className="text-right" style={{ minWidth: 84 }}>m³</th>
                <th className="text-right" style={{ minWidth: 96 }}>m³ lalu</th>
                <th className="text-right" style={{ minWidth: 88 }}>%</th>
                <th style={{ minWidth: 168 }}>Kondisi</th>
                <th style={{ minWidth: 104 }}>Catat</th>
              </>
            )}
            <th style={{ minWidth: 112 }}>Rute</th>
            <th style={{ minWidth: 148 }}>Petugas</th>
            <th style={{ minWidth: 152 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const tahap = tahapDari(row)
            const gaya = modeBelumDibaca ? GAYA_BELUM_DIBACA : GAYA_TAHAP[tahap]
            const anomali = modeBelumDibaca ? null : gayaAnomali(row.persentase ?? null, ambangAnomali)
            const dipilih = terpilih.has(row.id)
            const aktif = idTerpilih === row.id
            const nomor = row.nomorLangganan ?? row.pelanggan?.nomorLangganan ?? "—"
            const nama = row.pelanggan?.nama ?? row.namaPelanggan ?? "—"
            const alamat = row.pelanggan?.alamat ?? row.alamatPelanggan ?? "—"

            // Sel beku butuh latar SENDIRI — tanpa ini isi kolom lain
            // terlihat menembus saat digulir. `bg-card` jadi dasar, warna
            // tahap menumpang di atasnya persis seperti pada barisnya.
            const latarBeku = [
              "bg-card sticky z-10",
              gaya.baris,
              dipilih ? "bg-primary/10 dark:bg-primary/20" : "",
            ].join(" ")

            return (
              <tr
                key={row.id}
                data-id={row.id}
                onClick={() => onKlikBaris(row)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  onKlikKanan(row, { x: e.clientX, y: e.clientY })
                }}
                style={{ contentVisibility: "auto", containIntrinsicSize: tinggiBaris }}
                className={[
                  "cursor-pointer",
                  gaya.baris,
                  aktif ? "ring-primary/50 ring-1 ring-inset" : "",
                  dipilih ? "bg-primary/10 dark:bg-primary/20" : "",
                  "hover:bg-accent/60 dark:hover:bg-accent/30",
                  "[&>td]:border-border/40 [&>td]:border-b [&>td]:px-3 [&>td]:whitespace-nowrap",
                ].join(" ")}
              >
                <td
                  className={latarBeku}
                  style={{ left: 0, width: L_CEKLIS }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={dipilih}
                    onCheckedChange={() => onToggle(row.id, false, i)}
                    onClick={(e) => {
                      if ((e as React.MouseEvent).shiftKey) onToggle(row.id, true, i)
                    }}
                    aria-label={`Pilih ${nomor}`}
                  />
                </td>
                <td className={latarBeku} style={{ left: X_RING }}>
                  <TitikRing tahap={modeBelumDibaca ? "MENUNGGU" : tahap} />
                </td>
                <td className={`${latarBeku} border-border/70 border-r font-mono`} style={{ left: X_NOMOR }}>
                  {nomor}
                </td>
                <td className="max-w-72 truncate" title={nama}>{nama}</td>
                <td className="text-muted-foreground max-w-96 truncate" title={alamat}>{alamat}</td>
                {!modeBelumDibaca && (
                  <>
                    <td className="text-right tabular-nums">{angka(row.standAwal)}</td>
                    <td className="text-right tabular-nums">
                      {angka(row.standAkhirRevisi ?? row.standAkhir)}
                      {row.standAkhirRevisi != null && row.standAkhirRevisi !== row.standAkhir && (
                        <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400" title="Dikoreksi di V1">*</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{angka(row.pemakaian)}</td>
                    <td className="text-muted-foreground text-right tabular-nums">{angka(row.pemakaianLalu)}</td>
                    <td className="text-right tabular-nums">
                      {row.persentase === null || row.persentase === undefined ? (
                        "—"
                      ) : anomali ? (
                        <Lencana kelas={anomali} anak={`${row.persentase}%`} />
                      ) : (
                        `${row.persentase}%`
                      )}
                    </td>
                    <td className="text-muted-foreground max-w-36 truncate">
                      {row.kondisi ? (LABEL_KONDISI_CATAT[row.kondisi] ?? row.kondisi) : "—"}
                    </td>
                    <td className="text-muted-foreground tabular-nums">{tanggal(row.tanggalCatat)}</td>
                  </>
                )}
                <td className="text-muted-foreground font-mono">{row.pelanggan?.rute?.kode ?? "—"}</td>
                <td className="text-muted-foreground max-w-28 truncate">{row.pencatat?.namaLapangan ?? "—"}</td>
                <td><Lencana kelas={gaya.lencana} anak={<>{tahap === "V3" && !modeBelumDibaca && <Check className="size-3" aria-hidden />}{gaya.label}</>} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {rows.length === 0 && !memuat && (
        <p className="text-muted-foreground p-8 text-center text-sm">
          {modeBelumDibaca
            ? "Semua sambungan di daftar catat sudah punya setoran — tidak ada yang tertinggal."
            : "Tidak ada laporan yang cocok dengan saringan ini."}
        </p>
      )}
      {memuat && <p className="text-muted-foreground p-8 text-center text-sm">Memuat…</p>}
    </div>
  )
}
