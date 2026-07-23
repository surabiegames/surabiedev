"use client"

// Dialog pemilih rute untuk ditugaskan ke seorang pencatat. Cari rute
// (GET /rute?q=), rute yang SUDAH ditugaskan ke pencatat ini disaring keluar
// (rute yang sama boleh dipegang pencatat LAIN — itu fitur berbagi). Klik =
// tugaskan (POST /penugasan-rute), lalu tutup.
import * as React from "react"
import { Loader2, Search } from "lucide-react"
import { ambilList, ApiError } from "../../lib/api-client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { ScrollArea } from "@workspace/ui/components/scroll-area"

interface RuteBaris {
  id: string
  kode: string
  seksiCater?: { nama: string | null } | null
}

export function TambahRuteDialog({
  namaPencatat,
  ruteTerpakai,
  onPilih,
  onTutup,
}: {
  namaPencatat: string
  /** ruteId yang sudah ditugaskan ke pencatat ini — disaring dari daftar. */
  ruteTerpakai: Set<string>
  onPilih: (ruteId: string) => Promise<void>
  onTutup: () => void
}) {
  const [cari, setCari] = React.useState("")
  const [hasil, setHasil] = React.useState<RuteBaris[]>([])
  const [memuat, setMemuat] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [mengirim, setMengirim] = React.useState<string | null>(null)

  React.useEffect(() => {
    let batal = false
    // setState di dalam callback timer (bukan badan effect sinkron) — sesuai
    // aturan lint react-hooks/set-state-in-effect.
    const t = setTimeout(() => {
      if (batal) return
      setMemuat(true)
      ambilList<RuteBaris>("/rute", { q: cari || undefined, pageSize: 50 })
        .then(({ rows }) => {
          if (!batal) setHasil(rows.filter((r) => !ruteTerpakai.has(r.id)))
        })
        .catch((e) => {
          if (!batal) setGalat(e instanceof ApiError ? e.message : "Gagal memuat rute.")
        })
        .finally(() => {
          if (!batal) setMemuat(false)
        })
    }, 250)
    return () => {
      batal = true
      clearTimeout(t)
    }
  }, [cari, ruteTerpakai])

  async function tugaskan(ruteId: string) {
    setMengirim(ruteId)
    setGalat(null)
    try {
      await onPilih(ruteId)
      onTutup()
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal menugaskan rute.")
      setMengirim(null)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah rute untuk {namaPencatat}</DialogTitle>
          <DialogDescription>Pilih rute yang akan ditugaskan. Rute boleh juga dipegang petugas lain.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari kode rute…" className="pl-8" autoFocus />
        </div>
        {galat && <p className="text-sm text-destructive">{galat}</p>}
        <ScrollArea className="h-72 rounded-md border">
          {memuat ? (
            <div className="flex h-72 items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : hasil.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Tidak ada rute yang cocok / semua sudah ditugaskan.</p>
          ) : (
            <ul className="divide-y">
              {hasil.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={mengirim !== null}
                    onClick={() => tugaskan(r.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50 disabled:opacity-50"
                  >
                    <span>
                      <span className="font-mono font-medium">{r.kode}</span>
                      {r.seksiCater?.nama && <span className="ml-2 text-muted-foreground">{r.seksiCater.nama}</span>}
                    </span>
                    {mengirim === r.id && <Loader2 className="size-4 animate-spin" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
