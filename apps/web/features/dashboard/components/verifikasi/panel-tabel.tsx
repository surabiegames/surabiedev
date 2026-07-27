"use client"

// features/dashboard/components/verifikasi/panel-tabel.tsx — perekat layar
// verifikasi: saringan, dua tab sumber (laporan / belum dibaca), tabel
// berwarna, pemilihan, dan aksi massal.
//
// PEMILIHAN DIPEGANG DI SINI, bukan di tabel. Alasannya: aksi massal, ekspor,
// dan pintasan papan ketik semuanya membicarakan himpunan yang sama, dan
// menaruhnya di tabel akan memaksa ketiganya mengintip ke dalam anak
// komponen.

import * as React from "react"
import { ClipboardList, EyeOff, Rows3, Rows4 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { ambilList, kirimJson, ApiError } from "../../lib/api-client"
import { ToolbarVerifikasi, FILTER_AWAL, type FilterVerifikasi } from "./toolbar-verifikasi"
import { TabelVerifikasi, type BarisVerifikasi, type Kerapatan } from "./tabel-verifikasi"
import { AksiMassal, type Ring } from "./aksi-massal"
import { usePeriodeKerja } from "../../lib/periode-kerja"

/// Batas per permintaan verifikasi massal — sama dengan yang diterima server.
const BATCH_VERIF = 500

interface HasilMassal {
  diproses: number
  berhasil: number
  dilewati: number
  gagal: number
  masalah: { nomorLangganan: string; pesan?: string }[]
}

export function PanelTabel({
  periodes,
  pencatats,
  ambangAnomali,
  bolehRing,
  idTerpilih,
  onKlikBaris,
  onKlikKanan,
  refreshKey,
  onBerubah,
  onPeriodeBerubah,
  sisaKerja,
}: {
  periodes: number[]
  pencatats: { id: string; namaLapangan: string }[]
  ambangAnomali: number
  bolehRing: (r: Ring) => boolean
  idTerpilih: string | null
  onKlikBaris: (row: BarisVerifikasi) => void
  onKlikKanan: (row: BarisVerifikasi, posisi: { x: number; y: number }) => void
  refreshKey: number
  onBerubah: () => void
  /// Diberi tahu setiap kali periode yang dipilih berubah.
  ///
  /// KENAPA DIANGKAT KE INDUK. Kartu ringkasan (total, menunggu, resmi,
  /// anomali) dirender induk dan mengambil datanya sendiri. Tanpa kaitan ini
  /// keduanya memakai periode yang BERBEDA: tabel menampilkan Februari
  /// sementara kartu di atasnya masih menghitung Januari — dan tidak ada
  /// satu pun tanda bahwa keduanya bicara soal bulan yang berlainan.
  onPeriodeBerubah: (periode: number | null) => void
  /// Jumlah laporan periode ini yang belum lolos V3.
  sisaKerja: number | null
}) {
  const [tab, setTab] = React.useState<"laporan" | "belum">("laporan")
  const [kerapatan, setKerapatan] = React.useState<Kerapatan>("normal")
  const [filter, setFilter] = React.useState<FilterVerifikasi>(FILTER_AWAL)
  const [rows, setRows] = React.useState<BarisVerifikasi[]>([])
  const [total, setTotal] = React.useState(0)
  const [memuat, setMemuat] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)

  const [terpilih, setTerpilih] = React.useState<Set<string>>(new Set())
  const [sedangJalan, setSedangJalan] = React.useState(false)
  const [kemajuan, setKemajuan] = React.useState<{ selesai: number; total: number } | null>(null)
  const [hasil, setHasil] = React.useState<HasilMassal | null>(null)
  const jangkarRef = React.useRef<number | null>(null)

  // Periode bawaan = PERIODE KERJA dari satu sumber (lihat
  // lib/periode-kerja.ts), bukan "periode terbaru yang punya laporan".
  // Bedanya terasa tepat setelah buka bulan baru: daftar kerja bulan depan
  // sudah terbit tapi belum ada satu pun laporan, dan turunan lama akan
  // menahan layar di bulan lalu — petugas punya pekerjaan, aplikasi belum
  // mengakuinya.
  /// Daftar periode untuk dropdown diambil dari PERIODE KERJA, bukan dari
  /// "periode yang punya laporan".
  ///
  /// Bedanya menentukan: tepat setelah buka bulan baru, daftar kerja bulan
  /// depan sudah terbit (22.575 baris BELUM_DICATAT) tapi belum ada satu pun
  /// laporan. Dengan sumber lama, bulan itu TIDAK MUNCUL di dropdown sama
  /// sekali — operator tidak bisa memilihnya, dan aplikasi terasa berhenti
  /// di bulan lalu padahal pekerjaannya sudah menunggu.
  const { periodeKerja, daftar: daftarPeriode } = usePeriodeKerja()
  const periodePilihan = daftarPeriode.length > 0 ? daftarPeriode.map((d) => d.periode) : periodes
  React.useEffect(() => {
    if (filter.periode === null && periodeKerja !== null) {
      setFilter((f) => ({ ...f, periode: periodeKerja }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodeKerja])

  React.useEffect(() => {
    onPeriodeBerubah(filter.periode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.periode])

  React.useEffect(() => {
    let batal = false
    setMemuat(true)
    setGalat(null)
    const params: Record<string, string | number | undefined> = {
      pageSize: filter.pageSize,
      periode: filter.periode ?? undefined,
      pencatatId: filter.pencatatId || undefined,
      q: filter.q || undefined,
    }
    if (tab === "laporan") {
      // Muatan ringkas: tabel cuma butuh 18 kolom, bukan 50 field + 7 relasi.
      // Panel detail mengambil baris penuh sendiri saat baris dipilih.
      params.ringkas = "true"
      params.statusVerif = filter.statusVerif || undefined
      params.tanggalDari = filter.tanggalDari || undefined
      params.tanggalSampai = filter.tanggalSampai || undefined
      params.hanyaAnomali = filter.hanyaAnomali ? "true" : undefined
    }
    const jalur = tab === "laporan" ? "/laporan-harian" : "/laporan-harian/belum-dibaca"

    ambilList<BarisVerifikasi>(jalur, params)
      .then(({ rows: r, total: t }) => {
        if (batal) return
        // Tab "belum dibaca" mengembalikan baris DaftarCatat; identitasnya
        // ada di relasi `pelanggan`. Dipetakan di sini supaya tabelnya
        // tidak perlu tahu dua bentuk data.
        setRows(r)
        setTotal(t)
        setTerpilih(new Set())
      })
      .catch((e) => {
        if (!batal) setGalat(e instanceof ApiError ? e.message : "Gagal memuat data.")
      })
      .finally(() => { if (!batal) setMemuat(false) })
    return () => { batal = true }
  }, [tab, filter, refreshKey])

  // Papan ketik: Ctrl+A pilih semua, panah pindah baris aktif, Space
  // menandai. Ditangani di sini (bukan di tabel) karena baris aktif dan
  // himpunan terpilih dua-duanya milik komponen ini.
  //
  // Navigasi panah inilah yang membuat 22 ribu baris bisa dikerjakan:
  // verifikator memeriksa ratusan baris tanpa menyentuh tetikus, dan panel
  // detail mengikuti baris aktif dengan sendirinya.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault()
        setTerpilih(new Set(rows.map((r) => r.id)))
        return
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== " ") return
      if (rows.length === 0) return
      e.preventDefault()

      const kini = rows.findIndex((r) => r.id === idTerpilih)
      if (e.key === " ") {
        const baris = rows[kini < 0 ? 0 : kini]
        if (baris) toggle(baris.id, false, kini < 0 ? 0 : kini)
        return
      }
      const arah = e.key === "ArrowDown" ? 1 : -1
      const berikut = kini < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, kini + arah))
      const baris = rows[berikut]
      if (baris) onKlikBaris(baris)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, idTerpilih])

  function toggle(id: string, rentang: boolean, indeks: number) {
    setTerpilih((lama) => {
      const baru = new Set(lama)
      if (rentang && jangkarRef.current !== null) {
        const [a, b] = [jangkarRef.current, indeks].sort((x, y) => x - y) as [number, number]
        for (let i = a; i <= b; i++) { const r = rows[i]; if (r) baru.add(r.id) }
        return baru
      }
      if (baru.has(id)) baru.delete(id)
      else baru.add(id)
      jangkarRef.current = indeks
      return baru
    })
  }

  async function jalankanMassal(ring: Ring, sertakanAnomali: boolean) {
    const ids = [...terpilih]
    setSedangJalan(true)
    setHasil(null)
    setKemajuan({ selesai: 0, total: ids.length })
    const gabung: HasilMassal = { diproses: 0, berhasil: 0, dilewati: 0, gagal: 0, masalah: [] }
    try {
      for (let i = 0; i < ids.length; i += BATCH_VERIF) {
        const potong = ids.slice(i, i + BATCH_VERIF)
        const h = await kirimJson<HasilMassal>("/laporan-harian/verif-massal", "POST", {
          ring, ids: potong, sertakanAnomali,
        })
        gabung.diproses += h.diproses; gabung.berhasil += h.berhasil
        gabung.dilewati += h.dilewati; gabung.gagal += h.gagal
        gabung.masalah.push(...h.masalah.slice(0, 20))
        setKemajuan({ selesai: Math.min(i + BATCH_VERIF, ids.length), total: ids.length })
      }
      setHasil(gabung)
      setTerpilih(new Set())
      onBerubah()
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Verifikasi massal gagal.")
    } finally {
      setSedangJalan(false)
      setKemajuan(null)
    }
  }

  /// Ekspor baris terpilih ke CSV — dibuat di peramban, tanpa perjalanan
  /// bolak-balik ke server: datanya sudah ada di layar.
  function ekspor() {
    const pilih = rows.filter((r) => terpilih.has(r.id))
    const kolom = [
      "No. langganan", "Nama", "Alamat", "St awal", "St akhir", "m3", "m3 lalu", "%",
      "Kondisi", "Petugas", "Status",
    ]
    const isi = pilih.map((r) => [
      r.nomorLangganan ?? r.pelanggan?.nomorLangganan ?? "",
      r.pelanggan?.nama ?? r.namaPelanggan ?? "",
      r.pelanggan?.alamat ?? r.alamatPelanggan ?? "",
      r.standAwal ?? "", r.standAkhirRevisi ?? r.standAkhir ?? "",
      r.pemakaian ?? "", r.pemakaianLalu ?? "", r.persentase ?? "",
      r.kondisi ?? "", r.pencatat?.namaLapangan ?? "",
      r.verif3At ? "V3" : r.verif2At ? "V2" : r.verif1At ? "V1" : "MENUNGGU",
    ])
    const csv = [kolom, ...isi]
      .map((baris) => baris.map((s) => `"${String(s).replace(/"/g, '""')}"`).join(";"))
      .join("\n")
    // BOM: tanpa ini Excel Indonesia membaca UTF-8 sebagai ANSI dan nama
    // beraksen jadi rusak.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `verifikasi-${filter.periode ?? "semua"}-${pilih.length}baris.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-1">
        {([
          ["laporan", "Laporan masuk", ClipboardList],
          ["belum", "Belum dibaca", EyeOff],
        ] as const).map(([id, label, Ikon]) => (
          <Button
            key={id}
            size="sm"
            variant={tab === id ? "secondary" : "ghost"}
            className="h-8 text-xs"
            onClick={() => { setTab(id); setTerpilih(new Set()) }}
          >
            <Ikon className="size-3.5" aria-hidden /> {label}
          </Button>
        ))}
        {tab === "belum" && (
          <span className="text-muted-foreground ml-2 text-[11px]">
            Sambungan di daftar catat yang belum ada setorannya — bahan menagih pekerjaan ke petugas.
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Sisa pekerjaan selalu terlihat: pertanyaan "masih berapa lagi"
              tidak boleh menuntut orang membuka layar lain. */}
          {tab === "laporan" && sisaKerja !== null && (
            <span className="text-muted-foreground text-[11px] tabular-nums">
              sisa <strong className="text-foreground">{sisaKerja.toLocaleString("id-ID")}</strong> belum V3
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => setKerapatan((k) => (k === "padat" ? "normal" : "padat"))}
            title={kerapatan === "padat" ? "Kerapatan normal" : "Kerapatan padat"}
          >
            {kerapatan === "padat" ? <Rows3 className="size-3.5" aria-hidden /> : <Rows4 className="size-3.5" aria-hidden />}
            {kerapatan === "padat" ? "Padat" : "Normal"}
          </Button>
        </div>
      </div>

      <div className="shrink-0">
        <ToolbarVerifikasi
          filter={filter}
          onGanti={setFilter}
          periodes={periodePilihan}
          pencatats={pencatats}
          jumlahTampil={rows.length}
          jumlahTotal={total}
          memuat={memuat}
        />
      </div>

      {galat && (
        <Alert variant="destructive" className="shrink-0">
          <AlertDescription className="text-xs">{galat}</AlertDescription>
        </Alert>
      )}

      {hasil && (
        <Alert className="shrink-0">
          <AlertDescription className="text-xs">
            Selesai: <strong>{hasil.berhasil.toLocaleString("id-ID")} berhasil</strong>
            {hasil.dilewati > 0 && ` · ${hasil.dilewati.toLocaleString("id-ID")} dilewati`}
            {hasil.gagal > 0 && ` · ${hasil.gagal.toLocaleString("id-ID")} gagal`}
            {hasil.masalah.length > 0 && (
              <span className="text-muted-foreground block">
                Contoh: {hasil.masalah.slice(0, 3).map((m) => `${m.nomorLangganan} — ${m.pesan}`).join(" · ")}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Periode yang daftar kerjanya sudah terbit tapi belum ada setoran
          sama sekali. Tanpa pesan ini layar hanya menampilkan tabel kosong,
          dan itu terbaca seperti aplikasi berhenti — padahal pekerjaannya
          justru sedang menunggu di tab sebelah. */}
      {tab === "laporan" && !memuat && rows.length === 0 && filter.periode !== null && (
        <Alert className="shrink-0">
          <AlertDescription className="text-xs">
            Belum ada setoran pencatatan untuk periode {filter.periode}. Daftar kerjanya sudah
            terbit — lihat tab <strong>Belum dibaca</strong> untuk sambungan yang menunggu
            dikunjungi, atau unggah setoran petugas lewat <strong>Impor berkas sumber</strong>.
          </AlertDescription>
        </Alert>
      )}

      <div className="min-h-0 flex-1">
        <TabelVerifikasi
          rows={rows}
          terpilih={terpilih}
          onToggle={toggle}
          onToggleSemua={(pilih) => setTerpilih(pilih ? new Set(rows.map((r) => r.id)) : new Set())}
          idTerpilih={idTerpilih}
          onKlikBaris={onKlikBaris}
          onKlikKanan={onKlikKanan}
          ambangAnomali={ambangAnomali}
          modeBelumDibaca={tab === "belum"}
          memuat={memuat}
          kerapatan={kerapatan}
        />
      </div>

      {tab === "laporan" && (
        <div className="shrink-0">
          <AksiMassal
            jumlah={terpilih.size}
            bolehRing={bolehRing}
            onJalankan={(r, a) => void jalankanMassal(r, a)}
            onBersihkan={() => setTerpilih(new Set())}
            onEkspor={ekspor}
            sedangJalan={sedangJalan}
            kemajuan={kemajuan}
          />
        </div>
      )}
    </div>
  )
}
