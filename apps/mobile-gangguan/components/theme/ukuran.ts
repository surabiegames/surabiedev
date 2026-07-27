/**
 * ukuran.ts — token UKURAN. SATU SUMBER: `packages/ui` (dashboard web,
 * shadcn style "radix-nova"). Setiap nilai di bawah disalin dari sana, bukan
 * dikarang di sini.
 *
 * KENAPA WEB, BUKAN FLUTTER. Tujuannya "satu tema dengan aplikasi web".
 * Flutter lama dan web SUDAH tidak sepakat — Flutter memakai GlassPanel
 * radius 20, web memakai `--radius: 0` (globals.css:100, sudut siku di
 * seluruh dashboard). Keduanya tidak bisa dipenuhi sekaligus, dan yang
 * dipilih adalah web.
 *
 * SATU-SATUNYA ATURAN PEMETAAN, dan ia disengaja:
 *
 *   Mobile memakai langkah `lg` web sebagai UKURAN BAKU-nya.
 *
 * Web memakai `h-8` (32) untuk tombol & input baku karena diarahkan mouse,
 * yang presisinya beberapa piksel. Di HP yang mengarahkan adalah jempol.
 * Naik satu langkah ke `h-9` (36) — nilai yang SUDAH ADA di skala web, bukan
 * angka baru — membuat kontrolnya bisa ditekan tanpa memperkenalkan dialek
 * ketiga. Tidak ada nilai lain di berkas ini yang tidak ada di web.
 *
 * Tabel verifikasi ada di `docs/verifikasi-token.md`.
 */
import type { TextStyle } from 'react-native';

/**
 * Skala teks Tailwind, persis seperti yang dipakai komponen web:
 * Button `text-sm`, Card `text-sm`, Input `text-base`, Badge `text-xs`.
 */
export const Teks = {
  /** `text-xs` — badge, chip, jejak waktu. */
  xs: 12,
  /** `text-sm` — ukuran kerja web: isi kartu, label tombol, baris tabel. */
  sm: 14,
  /** `text-base` — isi input & teks utama. */
  base: 16,
  /** `text-lg` — judul kartu. */
  lg: 18,
  /** `text-2xl` — judul layar. */
  xl2: 24,
  /** `text-4xl` — angka pahlawan (stand, persentase progres). */
  xl4: 36,
} as const;

/** Tinggi baris Tailwind untuk teks yang membungkus. */
export const TinggiBaris = {
  xs: 16,
  sm: 20,
  base: 24,
  lg: 28,
} as const;

export const Berat = {
  normal: '400',
  medium: '500',
  semi: '600',
  tebal: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/** Spasi Tailwind (`--spacing(n)` = n × 4px). Web Card memakai spacing 4 = 16. */
export const Spasi = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * SUDUT MEMBULAT. Sudut siku `--radius: 0` yang sempat disalin dari dashboard
 * web DIBATALKAN (keputusan 2026-07-27) — aplikasi ini punya bahasa bentuknya
 * sendiri. Nilainya mengikuti `features/beranda.md`: kartu besar 16, kartu
 * kecil & kontrol 12, elemen kecil 8.
 */
export const Radius = {
  kartu: 16,
  kontrol: 12,
  kecil: 8,
  dialog: 16,
  /** Indikator bundar: titik legend, lencana, avatar. */
  bundar: 999,
} as const;

/**
 * Tinggi kontrol. Angka web + aturan "naik satu langkah" di atas.
 *
 *   web h-6 (24) → chip     web h-8 (32) → kecil
 *   web h-7 (28) → kecil    web h-9 (36) → BAKU di mobile
 */
export const TinggiKontrol = {
  /** Chip & badge yang tidak diketuk. */
  chip: 24,
  /** Aksi sekunder yang berdampingan dengan teks. */
  kecil: 36,
  /** Baku: tombol, input, select. */
  baku: 44,
} as const;

/** Ukuran ikon — mengikuti `[&_svg]:size-4` (16) dan `size-3.5` (14) web. */
export const UkuranIkon = {
  kecil: 14,
  sedang: 16,
  besar: 20,
  kosong: 32,
} as const;

/**
 * Sisi NativeWind dari skala yang sama, untuk primitif components/ui yang
 * memakai `className`. Nilainya wajib cocok dengan konstanta di atas.
 */
export const Kelas = {
  tombol: 'h-11 w-full',
  tombolBaris: 'h-11 px-4',
  tombolKecil: 'h-9 px-3',
  tombolTeks: 'text-sm font-medium',
  input: 'h-11 text-base',
  select: 'h-11',
  areaTeks: 'min-h-20 text-base',
} as const;
