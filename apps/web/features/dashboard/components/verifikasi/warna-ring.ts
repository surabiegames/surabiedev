// features/dashboard/components/verifikasi/warna-ring.ts — SATU tempat yang
// memutuskan warna di layar verifikasi.
//
// KENAPA TERPUSAT. Warna di sini bukan hiasan: ia yang membuat 5.000 baris
// bisa dibaca sekilas. Kalau setiap komponen memilih kelasnya sendiri,
// "sudah V2" akan tampil hijau di satu tempat dan biru di tempat lain, dan
// artinya hilang. Semua warna diambil dari sini.
//
// SEMUA PASANGAN TERANG/GELAP DITULIS EKSPLISIT. Tidak ada warna yang hanya
// benar di satu tema: tiap kelas membawa varian `dark:`-nya sendiri, karena
// tema gelap bukan mode kedua yang boleh lebih buruk.

export type Tahap = "MENUNGGU" | "V1" | "V2" | "V3" | "DITOLAK"

/// Urutan ring yang sudah dilewati sebuah laporan.
export function tahapDari(row: {
  verif1At?: string | null
  verif2At?: string | null
  verif3At?: string | null
  verifiedAt?: string | null
  isVerified?: boolean | null
}): Tahap {
  if (row.verif3At) return "V3"
  // DITOLAK = verifiedAt terisi TANPA isVerified (lihat catatan STATUS_VERIF
  // di laporan-harian.router.ts). Diperiksa sebelum V1/V2 karena penolakan
  // mereset ring dan yang harus terlihat adalah "perlu dicek ulang".
  if (row.verifiedAt && !row.isVerified) return "DITOLAK"
  if (row.verif2At) return "V2"
  if (row.verif1At) return "V1"
  return "MENUNGGU"
}

export interface GayaTahap {
  label: string
  /// Latar baris — sengaja tipis (8-12% campuran) supaya teks tetap terbaca
  /// dan 5.000 baris tidak berubah jadi papan warna.
  baris: string
  /// Lencana di kolom status — kontras penuh, ini penanda utamanya.
  lencana: string
  /// Garis kiri baris; penanda kedua bagi yang kesulitan membedakan warna.
  garis: string
}

export const GAYA_TAHAP: Record<Tahap, GayaTahap> = {
  MENUNGGU: {
    label: "Menunggu",
    baris: "bg-transparent",
    lencana:
      "bg-slate-100 text-slate-700 ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600",
    garis: "before:bg-slate-300 dark:before:bg-slate-600",
  },
  V1: {
    label: "V1 diperiksa",
    baris: "bg-amber-50/70 dark:bg-amber-950/25",
    lencana:
      "bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800",
    garis: "before:bg-amber-400 dark:before:bg-amber-600",
  },
  V2: {
    label: "V2 divalidasi",
    baris: "bg-sky-50/70 dark:bg-sky-950/25",
    lencana:
      "bg-sky-100 text-sky-800 ring-1 ring-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-800",
    garis: "before:bg-sky-400 dark:before:bg-sky-600",
  },
  V3: {
    label: "V3 resmi",
    baris: "bg-emerald-50/70 dark:bg-emerald-950/25",
    lencana:
      "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800",
    garis: "before:bg-emerald-500 dark:before:bg-emerald-600",
  },
  DITOLAK: {
    label: "Cek ulang",
    baris: "bg-rose-50/70 dark:bg-rose-950/25",
    lencana:
      "bg-rose-100 text-rose-800 ring-1 ring-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-800",
    garis: "before:bg-rose-500 dark:before:bg-rose-600",
  },
}

/// Baris "belum dibaca" — bukan tahap verifikasi, melainkan ketiadaan
/// laporan sama sekali. Warnanya sengaja BEDA KELUARGA dari kelima tahap di
/// atas (ungu), supaya tidak pernah tertukar dengan "menunggu verifikasi":
/// yang satu pekerjaan verifikator, yang satu lagi pekerjaan petugas.
export const GAYA_BELUM_DIBACA: GayaTahap = {
  label: "Belum dibaca",
  baris: "bg-violet-50/70 dark:bg-violet-950/25",
  lencana:
    "bg-violet-100 text-violet-800 ring-1 ring-violet-300 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-800",
  garis: "before:bg-violet-500 dark:before:bg-violet-600",
}

/// Penanda anomali. BUKAN latar baris — ia menumpang di atas warna tahap,
/// karena sebuah baris bisa sekaligus "V1" dan "anomali". Dibuat sebagai
/// lencana terpisah supaya kedua informasi tetap terbaca bersamaan.
export function gayaAnomali(persentase: number | null, ambang: number): string | null {
  if (persentase === null) return null
  if (persentase > ambang || persentase < -ambang) {
    return "bg-red-100 text-red-800 ring-1 ring-red-300 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800"
  }
  return null
}
