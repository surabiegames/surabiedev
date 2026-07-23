"use client"

// Dialog penataan urutan kunjungan pelanggan DALAM satu rute
// (Pelanggan.noUrutRute). Seret untuk mengurutkan, lalu Simpan →
// PATCH /rute/:id/urutan-pelanggan. Urutan ini yang dipakai aplikasi mobile
// sebagai urutan baca meter dalam rute.
import * as React from "react"
import { Loader2 } from "lucide-react"
import { ambilList, kirimJson, ApiError } from "../../lib/api-client"
import { DaftarSeret } from "./daftar-seret"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { ScrollArea } from "@workspace/ui/components/scroll-area"

interface PelangganBaris {
  id: string
  nomorLangganan: string
  nama: string
  noUrutRute: number | null
}

export function UrutanPelangganDialog({
  ruteId,
  kodeRute,
  onTutup,
}: {
  ruteId: string
  kodeRute: string
  onTutup: () => void
}) {
  const [items, setItems] = React.useState<PelangganBaris[]>([])
  const [memuat, setMemuat] = React.useState(true)
  const [menyimpan, setMenyimpan] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [berubah, setBerubah] = React.useState(false)

  React.useEffect(() => {
    // memuat awal = true (state awal); tidak diset sinkron di effect.
    let batal = false
    ambilList<PelangganBaris>("/pelanggan", { ruteId, pageSize: 1000 })
      .then(({ rows }) => {
        if (batal) return
        rows.sort((a, b) => (a.noUrutRute ?? Number.MAX_SAFE_INTEGER) - (b.noUrutRute ?? Number.MAX_SAFE_INTEGER) || a.nomorLangganan.localeCompare(b.nomorLangganan))
        setItems(rows)
      })
      .catch((e) => !batal && setGalat(e instanceof ApiError ? e.message : "Gagal memuat pelanggan."))
      .finally(() => !batal && setMemuat(false))
    return () => {
      batal = true
    }
  }, [ruteId])

  function urutkan(idBaru: string[]) {
    const peta = new Map(items.map((i) => [i.id, i]))
    setItems(idBaru.map((id) => peta.get(id)!).filter(Boolean))
    setBerubah(true)
  }

  async function simpan() {
    setMenyimpan(true)
    setGalat(null)
    try {
      await kirimJson(`/rute/${ruteId}/urutan-pelanggan`, "PATCH", { pelangganIds: items.map((i) => i.id) })
      onTutup()
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal menyimpan urutan.")
      setMenyimpan(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onTutup()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Urutan pelanggan · rute {kodeRute}</DialogTitle>
          <DialogDescription>Seret untuk menata urutan kunjungan. Berlaku untuk semua petugas yang memegang rute ini.</DialogDescription>
        </DialogHeader>
        {galat && <p className="text-sm text-destructive">{galat}</p>}
        {memuat ? (
          <div className="flex h-72 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="h-96 pr-3">
            <DaftarSeret
              items={items}
              onUrut={urutkan}
              tampil={(p) => (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{p.nomorLangganan}</span>
                  <span className="truncate">{p.nama}</span>
                </span>
              )}
            />
          </ScrollArea>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button onClick={simpan} disabled={!berubah || menyimpan || memuat}>
            {menyimpan && <Loader2 className="size-4 animate-spin" />}
            Simpan urutan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
