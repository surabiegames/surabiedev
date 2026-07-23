/**
 * labels.ts — padanan `core/utils/labels.dart`.
 *
 * SATU peta label Indonesia untuk semua nilai enum API — jangan memformat
 * enum per layar. Kunci = string mentah dari API.
 */

export const labelStatusTagihan: Record<string, string> = {
  BELUM_BAYAR: 'Belum Bayar',
  SUDAH_BAYAR: 'Lunas',
  JATUH_TEMPO: 'Jatuh Tempo',
  DIHAPUSKAN: 'Dihapuskan',
};

export const labelStatusLaporan: Record<string, string> = {
  MENUNGGU: 'Menunggu',
  DIVERIFIKASI: 'Diverifikasi',
  DITOLAK: 'Ditolak',
  DIGUNAKAN: 'Digunakan',
};

export const labelJenisPengaduan: Record<string, string> = {
  KEBOCORAN: 'Kebocoran',
  AIR_MATI: 'Air Mati',
  AIR_KERUH: 'Air Keruh',
  METER_RUSAK: 'Akurasi / Meter Rusak',
  TAGIHAN_TIDAK_SESUAI: 'Tagihan Tidak Sesuai',
  KUALITAS_LAYANAN: 'Kualitas Layanan',
  LAINNYA: 'Lainnya',
};

export const labelStatusPengaduan: Record<string, string> = {
  BARU: 'Baru',
  TERVERIFIKASI: 'Terverifikasi',
  DITUGASKAN: 'Ditugaskan',
  MENUJU_LOKASI: 'Menuju Lokasi',
  DIPROSES: 'Diproses',
  MENUNGGU_PELANGGAN: 'Menunggu Pelanggan',
  SELESAI: 'Selesai',
  DITUTUP: 'Ditutup',
  DIBUKA_KEMBALI: 'Dibuka Kembali',
  DITOLAK: 'Ditolak',
};

/**
 * StatusPelanggan (prisma/pelanggan.prisma) — status sambungan pada kartu
 * langganan warga & pratinjau pelanggan.
 */
export const labelStatusPelanggan: Record<string, string> = {
  AKTIF: 'Aktif',
  TUTUP_SEMENTARA: 'Tutup Sementara',
  DISEGEL: 'Disegel',
  TUTUP_SPT: 'Tutup SPT',
  CABUT_PERMANEN: 'Cabut Permanen',
};

export const labelPrioritas: Record<string, string> = {
  RENDAH: 'Rendah',
  NORMAL: 'Normal',
  TINGGI: 'Tinggi',
  DARURAT: 'Darurat',
};

/**
 * KondisiCatat — LENGKAP, seluruh 22 nilai enum (prisma/tagihan.prisma), urut:
 * keadaan normal dulu, lalu kelainan meter, lalu kendala kunjungan. Singkatan
 * warisan sistem lama (BMK/BMB, TTB, MTA, DK, MB) ditampilkan apa adanya —
 * kepanjangannya tidak terdokumentasi, TIDAK dikarang.
 */
export const labelKondisiMeter: Record<string, string> = {
  NORMAL: 'Normal',
  TIDAK_DIPAKAI: 'Tidak Dipakai',
  RUMAH_KOSONG: 'Rumah Kosong',
  STAND_TEMPEL: 'Stand Tempel',
  STAND_KONSUMEN: 'Stand Konsumen',
  METER_RUSAK: 'Meter Rusak',
  METER_MATI_ADA_AIR: 'Meter Mati, Ada Air',
  METER_MUNDUR: 'Meter Mundur',
  METER_TERBALIK: 'Meter Terbalik',
  METER_DALAM_AIR: 'Meter Dalam Air',
  LOS_METER: 'Los Meter',
  MUDA_KEMBALI: 'Muda Kembali',
  BMK_BMB: 'BMK/BMB',
  TTB: 'TTB',
  MTA: 'MTA',
  DK: 'DK',
  MB: 'MB',
  TERHALANG: 'Terhalang',
  TIDAK_ADA_AIR: 'Tidak Ada Air',
  ADA_ANJING: 'Ada Anjing',
  REV_PENCATAT: 'Revisi Pencatat',
  DICABUT: 'Dicabut',
};

/** KategoriPembacaan — cara baca dilakukan (di lokasi / jarak jauh). */
export const labelKategoriPembacaan: Record<string, string> = {
  ONSITE: 'Di Lokasi (Onsite)',
  OFFSITE: 'Jarak Jauh (Offsite)',
};

/**
 * Kondisi yang MEMBOLEHKAN stand akhir < stand lalu (aturan bisnis backend;
 * selain ini, stand mundur ditolak 400).
 */
export const kondisiSahMundur: ReadonlySet<string> = new Set([
  'METER_RUSAK',
  'METER_MUNDUR',
  'METER_TERBALIK',
  'METER_MATI_ADA_AIR',
  'MUDA_KEMBALI',
  'LOS_METER',
  'DICABUT',
]);

/** Ambil label; `-` bila kode null, kode mentah bila tak ada di peta. */
export function labelDari(
  peta: Record<string, string>,
  kode: string | null | undefined,
): string {
  if (kode == null) return '-';
  return peta[kode] ?? kode;
}
