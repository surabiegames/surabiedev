// features/dashboard/components/halaman-dasbor.tsx — kepala halaman seragam
// untuk semua halaman dashboard: eyebrow hijau + judul editorial + deskripsi
// (+ slot aksi/chip di kanan). Grammar yang sama dengan halaman Ringkasan
// dan permukaan publik.
//
// RANTAI TINGGI (penting — ini yang bikin tabel konsisten di semua halaman):
// layout.tsx sekarang mengunci area konten (SidebarInset h-dvh
// overflow-hidden → div konten min-h-0 flex-1 overflow-hidden), jadi halaman
// TIDAK boleh lagi mengandalkan <body> untuk menggulir. Pembungkus ini
// mengambil alih tinggi itu:
//   - root `flex h-full min-h-0 flex-col`  → mengisi pas sisa layar
//   - kepala `shrink-0`                     → tinggi natural, tidak menyusut
//   - area isi `min-h-0 flex-1 overflow-y-auto` → SATU wilayah gulir internal
// Efeknya seragam untuk dua bentuk halaman tanpa perlu tahu isinya:
//   • satu tabel penuh (DataGrid `flex h-full`) → mengisi persis wilayah isi,
//     gulir memakai gulir-internal AG Grid (wilayah ini tidak ikut menggulir);
//   • konten mengalir (form impor, peta, papan pengaduan) → wilayah isi yang
//     menggulir, bukan seluruh halaman. Tanpa ini konten yang lebih tinggi
//     dari layar akan TERPOTONG oleh overflow-hidden layout.
export function HalamanDasbor({
  eyebrow,
  judul,
  deskripsi,
  aksi,
  children,
}: {
  eyebrow: string
  judul: string
  deskripsi?: string
  /** Slot kanan-atas: chip periode, tombol aksi, dsb. */
  aksi?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{judul}</h1>
          {deskripsi && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{deskripsi}</p>}
        </div>
        {aksi}
      </div>
      {/* min-w-0: cegah tabel/konten lebar memaksa halaman melebar horizontal.
          overflow-y-auto: wilayah gulir tunggal (lihat catatan rantai tinggi
          di atas). scrollbar-tipis: konsisten dengan panel lain. */}
      <div className="scrollbar-tipis flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
