// features/publik/lib/format.ts — pemformatan untuk tampilan publik.
//
// SEMUA di file ini deterministik dan TIDAK bergantung locale/zona waktu
// mesin. Itu disengaja: komponen ini dirender di server lalu di-hydrate di
// browser, dan `toLocaleDateString()` tanpa opsi eksplisit bisa menghasilkan
// string BERBEDA di server (UTC) vs browser (WIB) — hasilnya hydration
// mismatch yang muncul acak, bukan saat dites.

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

/** 202605 -> "Mei 2026" */
export function formatPeriode(thbl: number): string {
  const tahun = Math.floor(thbl / 100)
  const bulan = thbl % 100
  return `${BULAN[bulan - 1] ?? "?"} ${tahun}`
}

/** 202605 -> "Mei". Untuk label sumbu grafik, di mana tahun penuh kepanjangan. */
export function formatBulanSingkat(thbl: number): string {
  const bulan = thbl % 100
  return (BULAN[bulan - 1] ?? "?").slice(0, 3)
}

/** 173540 -> "Rp 173.540" */
export function formatRupiah(nilai: number): string {
  return `Rp ${nilai.toLocaleString("id-ID")}`
}

/** 3012396720 -> "Rp 3,01 M". Untuk kartu statistik & sumbu grafik.
 *
 * Angka penuh TIDAK muat di kartu statistik: nilai tagihan sebulan mencapai
 * ratusan juta–miliar rupiah, dan versi panjangnya terpotong jadi
 * "Rp 3.012.3…" — persis kondisi yang membuat angkanya tak terbaca sama
 * sekali. Bentuk ringkas juga lebih mudah dibandingkan sekilas antar kartu.
 * Nilai penuh tetap dipakai di tabel/rincian, di mana ruangnya ada. */
export function formatRupiahRingkas(nilai: number): string {
  if (nilai >= 1_000_000_000) return `Rp ${(nilai / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`
  if (nilai >= 1_000_000) return `Rp ${(nilai / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
  if (nilai >= 1_000) return `Rp ${(nilai / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`
  return `Rp ${nilai}`
}

/** ISO string -> "1 Juni 2026". Dibaca sebagai UTC karena backend menyimpan
 *  tanggal jatuh tempo sebagai tanggal murni (tengah malam UTC) — memakai
 *  getDate() lokal akan menggeser tanggalnya sehari di zona WIB. */
export function formatTanggal(iso: string | null): string {
  if (!iso) return "-"
  const d = new Date(iso)
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export const LABEL_STATUS_TAGIHAN: Record<string, string> = {
  BELUM_BAYAR: "Belum dibayar",
  SUDAH_BAYAR: "Lunas",
  JATUH_TEMPO: "Jatuh tempo",
  DIHAPUSKAN: "Dihapuskan",
}

export interface StatusTagihanTampilan {
  label: string
  badgeClass: string
  dotClass: string
  textClass: string
}

/** Warna status per baris tagihan. Skala warna Tailwind + varian `dark:`
 *  eksplisit di tiap kelas (bukan token semantik netral bg-background/dst)
 *  — konsisten dengan cara shadcn sendiri memberi warna status/severity;
 *  aturan "token semantik saja" di FRONTEND.md soal mencegah bg-white/
 *  text-gray-500 yang TIDAK punya padanan .dark, bukan soal warna status. */
export const STATUS_TAGIHAN_CONFIG: Record<string, StatusTagihanTampilan> = {
  BELUM_BAYAR: {
    label: "Belum dibayar",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700 dark:text-amber-400",
  },
  SUDAH_BAYAR: {
    label: "Lunas",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700 dark:text-emerald-400",
  },
  JATUH_TEMPO: {
    label: "Jatuh tempo",
    badgeClass: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400",
    dotClass: "bg-red-500",
    textClass: "text-red-700 dark:text-red-400",
  },
  DIHAPUSKAN: {
    label: "Dihapuskan",
    badgeClass: "border-border bg-muted text-muted-foreground",
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
  },
}

export function statusTagihanTampilan(status: string): StatusTagihanTampilan {
  return STATUS_TAGIHAN_CONFIG[status] ?? STATUS_TAGIHAN_CONFIG.BELUM_BAYAR!
}

/// Label DIBACA WARGA — ditulis dari sudut pandang mereka, bukan sudut
/// pandang basis data. "BARU" jadi "Diterima" (yang penting bagi pelapor
/// adalah laporannya sampai, bukan bahwa barisnya baru), dan
/// "MENUNGGU_PELANGGAN" jadi ajakan bertindak, bukan tuduhan.
export const LABEL_STATUS_PENGADUAN: Record<string, string> = {
  BARU: "Diterima",
  TERVERIFIKASI: "Terverifikasi operator",
  DITUGASKAN: "Ditugaskan ke petugas",
  MENUJU_LOKASI: "Petugas menuju lokasi",
  DIPROSES: "Sedang ditangani",
  MENUNGGU_PELANGGAN: "Menunggu tanggapan Anda",
  SELESAI: "Selesai — menunggu konfirmasi Anda",
  DITUTUP: "Ditutup",
  DIBUKA_KEMBALI: "Dibuka kembali",
  DITOLAK: "Ditolak",
}

/// Warna status tiket. Skala warna Tailwind + varian `dark:` eksplisit,
/// mengikuti pola STATUS_TAGIHAN_CONFIG di atas (lihat catatan di sana soal
/// kenapa ini tidak melanggar aturan token semantik di FRONTEND.md).
export const STATUS_PENGADUAN_CONFIG: Record<string, StatusTagihanTampilan> = {
  BARU: {
    label: "Diterima",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
    dotClass: "bg-blue-500",
    textClass: "text-blue-700 dark:text-blue-400",
  },
  TERVERIFIKASI: {
    label: "Terverifikasi operator",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-400",
    dotClass: "bg-sky-500",
    textClass: "text-sky-700 dark:text-sky-400",
  },
  DITUGASKAN: {
    label: "Ditugaskan ke petugas",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700 dark:text-amber-400",
  },
  MENUJU_LOKASI: {
    label: "Petugas menuju lokasi",
    badgeClass: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-400",
    dotClass: "bg-cyan-500",
    textClass: "text-cyan-700 dark:text-cyan-400",
  },
  DIPROSES: {
    label: "Sedang ditangani",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700 dark:text-amber-400",
  },
  MENUNGGU_PELANGGAN: {
    label: "Menunggu tanggapan Anda",
    badgeClass:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-400",
    dotClass: "bg-violet-500",
    textClass: "text-violet-700 dark:text-violet-400",
  },
  SELESAI: {
    label: "Selesai — menunggu konfirmasi Anda",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700 dark:text-emerald-400",
  },
  DITUTUP: {
    label: "Ditutup",
    badgeClass: "border-border bg-muted text-muted-foreground",
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
  },
  DIBUKA_KEMBALI: {
    label: "Dibuka kembali",
    badgeClass:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-400",
    dotClass: "bg-orange-500",
    textClass: "text-orange-700 dark:text-orange-400",
  },
  DITOLAK: {
    label: "Ditolak",
    badgeClass: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400",
    dotClass: "bg-red-500",
    textClass: "text-red-700 dark:text-red-400",
  },
}

export function statusPengaduanTampilan(status: string): StatusTagihanTampilan {
  return STATUS_PENGADUAN_CONFIG[status] ?? STATUS_PENGADUAN_CONFIG.BARU!
}

/** ISO string -> "17 Juli 2026, 14.05". Linimasa tindak lanjut butuh JAM,
 *  bukan cuma tanggal: beberapa peristiwa terjadi di hari yang sama dan
 *  tanpa jam urutannya jadi tidak terbaca.
 *
 *  WIB eksplisit (UTC+7), bukan zona mesin. Komponen ini dirender di server
 *  lalu di-hydrate di browser — `toLocaleString()` tanpa zona eksplisit
 *  menghasilkan string berbeda di server (UTC) dan browser (WIB), dan
 *  hasilnya hydration mismatch yang muncul acak. Lihat catatan header. */
export function formatWaktu(iso: string | null): string {
  if (!iso) return "-"
  const wib = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000)
  const jam = String(wib.getUTCHours()).padStart(2, "0")
  const menit = String(wib.getUTCMinutes()).padStart(2, "0")
  return `${wib.getUTCDate()} ${BULAN[wib.getUTCMonth()]} ${wib.getUTCFullYear()}, ${jam}.${menit}`
}

/** Sisa menit SLA -> "2 jam 15 menit lagi" / "terlambat 3 jam".
 *  Dibulatkan ke satuan yang berarti bagi manusia: "terlambat 4.317 menit"
 *  secara teknis benar tapi tidak memberi tahu apa pun. */
export function formatSisaWaktu(sisaMenit: number | null): string {
  if (sisaMenit === null) return "-"
  const lewat = sisaMenit < 0
  const total = Math.abs(sisaMenit)
  const hari = Math.floor(total / 1440)
  const jam = Math.floor((total % 1440) / 60)
  const menit = total % 60

  const bagian = hari > 0 ? `${hari} hari${jam ? ` ${jam} jam` : ""}` : jam > 0 ? `${jam} jam${menit ? ` ${menit} menit` : ""}` : `${menit} menit`
  return lewat ? `terlambat ${bagian}` : `${bagian} lagi`
}

/// URL video yang dioptimasi untuk pemutaran web. Untuk aset Cloudinary,
/// menyisipkan transformasi `q_auto,f_auto` tepat setelah `/upload/` — inilah
/// "kompresi"-nya: Cloudinary mengirim varian ter-transcode yang jauh lebih
/// kecil, dipilih otomatis sesuai kemampuan browser, TANPA transcoding berat
/// di HP warga. URL non-Cloudinary (fallback disk lokal dev) dikembalikan apa
/// adanya. Aman dipanggil dengan null.
export function urlVideoTeroptimasi(url: string | null): string | null {
  if (!url) return null
  const penanda = "/upload/"
  const i = url.indexOf(penanda)
  if (!url.includes("res.cloudinary.com") || i === -1) return url
  const sesudah = i + penanda.length
  return `${url.slice(0, sesudah)}q_auto,f_auto/${url.slice(sesudah)}`
}

export const LABEL_JENIS_PENGADUAN: Record<string, string> = {
  KEBOCORAN: "Kebocoran pipa",
  AIR_MATI: "Air tidak mengalir",
  AIR_KERUH: "Air keruh / bau",
  METER_RUSAK: "Meter rusak",
  TAGIHAN_TIDAK_SESUAI: "Tagihan tidak sesuai",
  KUALITAS_LAYANAN: "Kualitas layanan",
  LAINNYA: "Lainnya",
}
