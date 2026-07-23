"use client"

// Halaman Pemetaan Rute — mengatur rute mana dikerjakan petugas mana, dan
// urutannya. PERMANEN: berlaku otomatis tiap periode (dibaca mobile lewat
// GET /laporan-harian/rute-saya) tanpa admin mengatur ulang tiap bulan.
// Tata letak per-petugas: pilih petugas (kiri) → atur daftar rutenya (kanan,
// seret untuk urutkan). Satu rute boleh dibagi ke beberapa petugas.
import * as React from "react"
import { ListOrdered, Loader2, MapPin, Plus, Search, Trash2, UserRound } from "lucide-react"
import { ambilSatu, kirimJson, ApiError } from "../../lib/api-client"
import { DaftarSeret } from "./daftar-seret"
import { TambahRuteDialog } from "./tambah-rute-dialog"
import { UrutanPelangganDialog } from "./urutan-pelanggan-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"

interface RingkasanPencatat {
  id: string
  namaLapangan: string
  namaLengkap: string | null
  isAktif: boolean
  user: { id: string; name: string | null } | null
  jumlahRute: number
  totalTarget: number
}

interface PenugasanBaris {
  id: string
  ruteId: string
  urutan: number
  target: number
  rute: { id: string; kode: string; seksiCater?: { kode: string | null; nama: string | null } | null }
}

export function PemetaanRuteClient() {
  const [pencatat, setPencatat] = React.useState<RingkasanPencatat[]>([])
  const [memuatKiri, setMemuatKiri] = React.useState(true)
  const [cari, setCari] = React.useState("")
  const [terpilih, setTerpilih] = React.useState<string | null>(null)

  const [rute, setRute] = React.useState<PenugasanBaris[]>([])
  const [memuatKanan, setMemuatKanan] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)

  const [tambahBuka, setTambahBuka] = React.useState(false)
  const [urutPelanggan, setUrutPelanggan] = React.useState<{ ruteId: string; kode: string } | null>(null)

  // Loader tidak menyetel loading=true di sini (setState sinkron dalam effect
  // dilarang lint) — flag true diset di titik pemicu (mount default true,
  // klik petugas menyalakan panel kanan). setState hanya terjadi setelah await.
  const muatRingkasan = React.useCallback(async () => {
    try {
      const data = await ambilSatu<RingkasanPencatat[]>("/penugasan-rute/ringkasan")
      setPencatat(data)
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal memuat daftar petugas.")
    } finally {
      setMemuatKiri(false)
    }
  }, [])

  const muatRute = React.useCallback(async (pencatatId: string) => {
    try {
      const data = await ambilSatu<PenugasanBaris[]>("/penugasan-rute", { pencatatId })
      setRute(data)
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal memuat rute petugas.")
    } finally {
      setMemuatKanan(false)
    }
  }, [])

  React.useEffect(() => {
    let batal = false
    ambilSatu<RingkasanPencatat[]>("/penugasan-rute/ringkasan")
      .then((d) => !batal && setPencatat(d))
      .catch((e) => !batal && setGalat(e instanceof ApiError ? e.message : "Gagal memuat daftar petugas."))
      .finally(() => !batal && setMemuatKiri(false))
    return () => {
      batal = true
    }
  }, [])

  React.useEffect(() => {
    if (!terpilih) return
    let batal = false
    ambilSatu<PenugasanBaris[]>("/penugasan-rute", { pencatatId: terpilih })
      .then((d) => !batal && setRute(d))
      .catch((e) => !batal && setGalat(e instanceof ApiError ? e.message : "Gagal memuat rute petugas."))
      .finally(() => !batal && setMemuatKanan(false))
    return () => {
      batal = true
    }
  }, [terpilih])

  const pencatatTerpilih = pencatat.find((p) => p.id === terpilih) ?? null
  const terfilter = pencatat.filter((p) => {
    const q = cari.trim().toLowerCase()
    if (!q) return true
    return p.namaLapangan.toLowerCase().includes(q) || (p.namaLengkap ?? "").toLowerCase().includes(q)
  })

  async function urutkanRute(idBaru: string[]) {
    if (!terpilih) return
    const peta = new Map(rute.map((r) => [r.ruteId, r]))
    setRute(idBaru.map((id) => peta.get(id)!).filter(Boolean)) // optimistik
    try {
      await kirimJson("/penugasan-rute/urutan", "PATCH", { pencatatId: terpilih, ruteIds: idBaru })
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal menyimpan urutan.")
      void muatRute(terpilih) // rollback dari server
    }
  }

  async function lepas(penugasanId: string) {
    try {
      await kirimJson(`/penugasan-rute/${penugasanId}`, "DELETE", {})
      await Promise.all([terpilih ? muatRute(terpilih) : Promise.resolve(), muatRingkasan()])
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal melepas rute.")
    }
  }

  async function tugaskan(ruteId: string) {
    if (!terpilih) return
    await kirimJson("/penugasan-rute", "POST", { pencatatId: terpilih, ruteId })
    await Promise.all([muatRute(terpilih), muatRingkasan()])
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Panel kiri: daftar petugas */}
      <div className="rounded-xl border bg-card">
        <div className="border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari petugas…" className="pl-8" />
          </div>
        </div>
        <ScrollArea className="h-140">
          {memuatKiri ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <ul className="divide-y">
              {terfilter.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setGalat(null)
                      setMemuatKanan(true)
                      setTerpilih(p.id)
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50",
                      terpilih === p.id && "bg-muted",
                    )}
                  >
                    <UserRound className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.namaLengkap ?? p.namaLapangan}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p.user?.name ? "akun aktif" : "belum ada akun"}
                        {!p.isAktif && " · non-aktif"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant={p.jumlahRute > 0 ? "secondary" : "outline"}>{p.jumlahRute} rute</Badge>
                      {p.totalTarget > 0 && <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{p.totalTarget} SL</div>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>

      {/* Panel kanan: rute petugas terpilih */}
      <div className="rounded-xl border bg-card p-4">
        {!pencatatTerpilih ? (
          <div className="flex h-135 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <MapPin className="size-8" />
            <p className="text-sm">Pilih petugas di kiri untuk mengatur rutenya.</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{pencatatTerpilih.namaLengkap ?? pencatatTerpilih.namaLapangan}</h3>
                <p className="text-sm text-muted-foreground">
                  {rute.length} rute · {rute.reduce((n, r) => n + r.target, 0)} sambungan langganan
                </p>
              </div>
              <Button size="sm" onClick={() => setTambahBuka(true)}>
                <Plus className="size-4" /> Tambah rute
              </Button>
            </div>
            {galat && <p className="mb-2 text-sm text-destructive">{galat}</p>}
            {memuatKanan ? (
              <div className="flex h-80 items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : rute.length === 0 ? (
              <div className="flex h-80 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <p className="text-sm">Petugas ini belum memegang rute. Klik “Tambah rute”.</p>
              </div>
            ) : (
              <ScrollArea className="h-120 pr-3">
                <DaftarSeret
                  // id = ruteId supaya onUrut mengembalikan ruteIds (untuk
                  // PATCH /urutan); id penugasan asli disimpan terpisah
                  // (penugasanId) untuk aksi hapus DELETE /penugasan-rute/:id.
                  items={rute.map((r) => ({ ...r, id: r.ruteId, penugasanId: r.id }))}
                  onUrut={urutkanRute}
                  tampil={(r) => (
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-sm font-medium">{r.rute.kode}</span>
                      {r.rute.seksiCater?.nama && <span className="truncate text-xs text-muted-foreground">{r.rute.seksiCater.nama}</span>}
                      <Badge variant="outline" className="ml-1 shrink-0 tabular-nums">
                        {r.target} SL
                      </Badge>
                    </div>
                  )}
                  aksi={(r) => (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7" title="Atur urutan pelanggan" onClick={() => setUrutPelanggan({ ruteId: r.ruteId, kode: r.rute.kode })}>
                        <ListOrdered className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" title="Lepas rute" onClick={() => lepas(r.penugasanId)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                />
              </ScrollArea>
            )}
          </>
        )}
      </div>

      {tambahBuka && pencatatTerpilih && (
        <TambahRuteDialog
          namaPencatat={pencatatTerpilih.namaLengkap ?? pencatatTerpilih.namaLapangan}
          ruteTerpakai={new Set(rute.map((r) => r.ruteId))}
          onPilih={tugaskan}
          onTutup={() => setTambahBuka(false)}
        />
      )}
      {urutPelanggan && <UrutanPelangganDialog ruteId={urutPelanggan.ruteId} kodeRute={urutPelanggan.kode} onTutup={() => setUrutPelanggan(null)} />}
    </div>
  )
}
