// app/(dashboard)/dashboard/loading.tsx — fallback Suspense untuk SEMUA rute
// /dashboard/*. Muncul di slot konten (di dalam sidebar + header yang tetap)
// selama server component halaman berjalan — mis. ringkasan yang meng-query
// DB, atau await auth() sebelum grid client termuat. Berpasangan dengan
// ProgressNavigasi: bilah tipis = isyarat global, skeleton ini = kerangka isi
// agar halaman lama tak "membeku" saat berpindah.
//
// Bentuknya sengaja meniru grammar halaman tabel (HalamanDasbor + DataGrid):
// kepala editorial + kartu bertoolbar berisi baris — 80% halaman dashboard
// memang tabel, dan netral untuk sisanya. Mengisi tinggi (h-full) mengikuti
// rantai tinggi terkunci dari layout.
import { Skeleton } from "@workspace/ui/components/skeleton"

// Radius global proyek = 0 (tajam) — paksa semua kerangka rounded-none supaya
// tak ada sudut membulat yang keluar dari bahasa desain.
const KOTAK = "rounded-none bg-muted"

export default function DashboardLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-6" aria-busy="true">
      {/* Kepala: eyebrow + judul + deskripsi. */}
      <div className="shrink-0 space-y-2.5">
        <Skeleton className={`${KOTAK} h-2.5 w-40`} />
        <Skeleton className={`${KOTAK} h-7 w-72 max-w-[70%]`} />
        <Skeleton className={`${KOTAK} h-3.5 w-96 max-w-[85%]`} />
      </div>

      {/* Kartu tabel mengisi sisa tinggi. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border border-border/70 bg-card">
        {/* Baris toolbar: label + badge kiri, aksi kanan. */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-4 py-2.5">
          <Skeleton className={`${KOTAK} h-3 w-32`} />
          <Skeleton className={`${KOTAK} h-4 w-16`} />
          <div className="ml-auto flex items-center gap-1.5">
            <Skeleton className={`${KOTAK} h-7 w-20`} />
            <Skeleton className={`${KOTAK} h-7 w-20`} />
          </div>
        </div>
        {/* Baris pencarian + filter. */}
        <div className="flex shrink-0 items-center gap-1.5 border-b border-border/70 bg-muted/20 px-4 py-2">
          <Skeleton className={`${KOTAK} h-7 w-56`} />
          <Skeleton className={`${KOTAK} h-7 w-28`} />
        </div>
        {/* Header kolom + deretan baris. */}
        <div className="flex shrink-0 items-center gap-4 border-b border-border/70 px-4 py-2.5">
          {[24, 16, 20, 12, 14].map((w, i) => (
            <Skeleton key={i} className={`${KOTAK} h-2.5`} style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col divide-y divide-border/50 overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              {[24, 16, 20, 12, 14].map((w, j) => (
                <Skeleton
                  key={j}
                  className={`${KOTAK} h-3.5`}
                  // Redupkan progresif ke bawah → kesan "memudar", bukan blok
                  // pekat yang berat di mata.
                  style={{ width: `${w}%`, opacity: 1 - i * 0.06 }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
