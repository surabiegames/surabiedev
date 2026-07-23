"use client"

// Daftar dapat-diurutkan lewat seret (HTML5 drag native — tanpa pustaka dnd).
// Dipakai di halaman Pemetaan Rute untuk menata urutan rute per petugas dan
// urutan pelanggan dalam rute. Seret baris ke posisi baru → onUrut menerima
// daftar id dalam urutan baru (pemanggil yang menyimpan ke server).
import * as React from "react"
import { GripVertical } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

export function DaftarSeret<T extends { id: string }>({
  items,
  onUrut,
  tampil,
  aksi,
  className,
}: {
  items: T[]
  onUrut: (urutBaruIds: string[]) => void
  tampil: (item: T, indeks: number) => React.ReactNode
  aksi?: (item: T) => React.ReactNode
  className?: string
}) {
  const [drag, setDrag] = React.useState<number | null>(null)
  const [over, setOver] = React.useState<number | null>(null)

  function selesai() {
    if (drag !== null && over !== null && drag !== over) {
      const baru = [...items]
      const [dipindah] = baru.splice(drag, 1)
      if (dipindah !== undefined) {
        baru.splice(over, 0, dipindah)
        onUrut(baru.map((i) => i.id))
      }
    }
    setDrag(null)
    setOver(null)
  }

  return (
    <ul className={cn("space-y-1.5", className)}>
      {items.map((item, i) => (
        <li
          key={item.id}
          draggable
          onDragStart={() => setDrag(i)}
          onDragOver={(e) => {
            e.preventDefault()
            if (over !== i) setOver(i)
          }}
          onDragEnd={selesai}
          onDrop={selesai}
          className={cn(
            "flex items-center gap-2 rounded-md border bg-card px-2.5 py-2 text-sm transition-colors",
            drag === i && "opacity-40",
            over === i && drag !== null && drag !== i && "border-primary",
          )}
        >
          <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">{tampil(item, i)}</div>
          {aksi?.(item)}
          <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
        </li>
      ))}
    </ul>
  )
}
