// features/dashboard/lib/label.ts — label Indonesia untuk nilai enum yang
// tampil di grid dashboard. Satu tempat supaya ejaan konsisten antar halaman;
// nilai yang tak terdaftar jatuh kembali ke raw value (lebih baik kelihatan
// mentah daripada salah terjemah).

export const LABEL_STATUS_PELANGGAN: Record<string, string> = {
  AKTIF: "Aktif",
  TUTUP_SEMENTARA: "Tutup sementara",
  DISEGEL: "Disegel",
  TUTUP_SPT: "Tutup SPT",
  CABUT_PERMANEN: "Cabut permanen",
}

export const LABEL_STATUS_LAPORAN_MANDIRI: Record<string, string> = {
  MENUNGGU: "Menunggu",
  DIVERIFIKASI: "Diverifikasi",
  DITOLAK: "Ditolak",
  DIGUNAKAN: "Digunakan",
}

export const LABEL_JENIS_MUTASI: Record<string, string> = {
  PB: "Pasang baru",
  PK: "Perubahan kontrak",
}

export const LABEL_JENIS_PEMUTUSAN: Record<string, string> = {
  TSM: "Tutup sementara",
  SPT: "Tutup SPT",
  LAINNYA: "Lainnya",
}

export const LABEL_STATUS_POTENSI: Record<string, string> = {
  PROSPEK: "Prospek",
  DITOLAK: "Ditolak",
  MENUNGGU_SURVEI: "Menunggu survei",
  VALIDASI: "Validasi",
}

export const LABEL_STATUS_PEMBAYARAN: Record<string, string> = {
  PENDING: "Pending",
  BERHASIL: "Berhasil",
  GAGAL: "Gagal",
  EXPIRED: "Kedaluwarsa",
}

export const LABEL_KANAL_PEMBAYARAN: Record<string, string> = {
  TELLER_KANTOR: "Teller kantor",
  PPOB_BANK: "PPOB bank",
  PPOB_MINIMARKET: "PPOB minimarket",
  VIRTUAL_ACCOUNT: "Virtual account",
  QRIS: "QRIS",
  AUTODEBET: "Autodebet",
}

export const LABEL_JENIS_TAGIHAN_LAIN: Record<string, string> = {
  PASANG_BARU: "Pasang baru",
  BALIK_NAMA: "Balik nama",
  GANTI_METER: "Ganti meter",
  BUKA_SEGEL: "Buka segel",
  DENDA_PELANGGARAN: "Denda pelanggaran",
  LAINNYA: "Lainnya",
}

export const LABEL_PRIORITAS_PENGADUAN: Record<string, string> = {
  RENDAH: "Rendah",
  NORMAL: "Normal",
  TINGGI: "Tinggi",
  DARURAT: "Darurat",
}

export const LABEL_ROLE: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  DIREKSI: "Direksi",
  SENIOR_MANAGER: "Senior manager",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  STAFF: "Staf",
  USER: "Pelanggan",
}

export const LABEL_STATUS_USER: Record<string, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Non-aktif",
  SUSPENDED: "Ditangguhkan",
}

/// KondisiCatat — LENGKAP, seluruh 21 nilai enum (prisma/tagihan.prisma).
/// Sebagian adalah singkatan warisan sistem lama (BMK/BMB, TTB, MTA, DK, MB)
/// yang kepanjangannya tidak terdokumentasi di data sumber — ditampilkan
/// sebagai singkatannya sendiri, TIDAK dikarang kepanjangannya.
export const LABEL_KONDISI_CATAT: Record<string, string> = {
  NORMAL: "Normal",
  TIDAK_DIPAKAI: "Tidak dipakai",
  RUMAH_KOSONG: "Rumah kosong",
  STAND_TEMPEL: "Stand tempel",
  STAND_KONSUMEN: "Stand konsumen",
  METER_RUSAK: "Meter rusak",
  METER_MATI_ADA_AIR: "Meter mati, ada air",
  METER_MUNDUR: "Meter mundur",
  METER_TERBALIK: "Meter terbalik",
  METER_DALAM_AIR: "Meter dalam air",
  LOS_METER: "Los meter",
  BMK_BMB: "BMK/BMB",
  TTB: "TTB",
  MTA: "MTA",
  TERHALANG: "Terhalang",
  TIDAK_ADA_AIR: "Tidak ada air",
  ADA_ANJING: "Ada anjing",
  DK: "DK",
  MB: "MB",
  MUDA_KEMBALI: "Muda kembali",
  REV_PENCATAT: "Revisi pencatat",
  DICABUT: "Dicabut",
}

export function label(peta: Record<string, string>, nilai: string | null | undefined): string {
  if (!nilai) return "—"
  return peta[nilai] ?? nilai
}
