// prisma/seed/lib/csv.ts — pembaca CSV bertipe untuk keempat sumber data
// legacy. Semua file memakai delimiter ";" dan BOM UTF-8 (standar export
// Excel Indonesia). File mentah TIDAK PERNAH ditulis ulang oleh kode ini
// — hanya dibaca (lihat prisma/README.md bagian "Filosofi ETL").

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "csv-parse/sync"

const DATA_DIR = join(process.cwd(), "prisma", "data")

function readCsv<T>(filename: string): T[] {
  const content = readFileSync(join(DATA_DIR, filename), "utf-8")
  return parse(content, {
    delimiter: ";",
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as T[]
}

/// ProgresCater-PW5.csv — closing pencatatan meter bulanan, dasar
/// rekapitulasi wilayah pelayanan & DRD. Sumber utama untuk Pelanggan,
/// Meter, PembacaanMeter, Tagihan, dan hierarki wilayah.
export interface ProgresCaterRow {
  thbl: string
  nolg: string
  nprs: string
  nama: string
  almt: string
  trp: string
  namatrp: string
  ukr: string
  tmss: string
  ketcatat: string
  stml: string
  stma: string
  pakai_drd: string
  blok_m3: string
  jmlhargaair: string
  beabeban: string
  beaadmin: string
  airkotor: string
  lainlain: string
  tjtg: string
  pakailalu: string
  blok_m3lalu: string
  wiladmkode: string
  wiladmnama: string
  kdkec: string
  namakec: string
  kdkel: string
  namakel: string
  rw: string
  rt: string
  caterseksikode: string
  caterseksinama: string
  rute_kode: string
  pencatat: string
  wildistkode: string
  wildistnama: string
  wilseksikode: string
  wilseksinama: string
  zonakode: string
  zonanama: string
  obid: string
  obnama: string
  gbid: string
  gbnama: string
  isovb: string
  ps: string
  mbr: string
  ismbr: string
  kd_merkmeter: string
  ukmeter: string
  nometer: string
  nosegelmeter: string
  tglpasangmeter: string
  umurmeterthn: string
  umurmeterbln: string
  umurmeterhari: string
  umurmeterkode: string
  umurmeternama: string
  notelp: string
  potensialpenagihan: string
  potensialcater: string
  durasi: string
  jamgilirstart: string
  jamgilirend: string
  waktugilir: string
  pb: string
  pk: string
  jmlreknunggak: string
  tagnunggak: string
  jmlreknunggakkode: string
  jmlreknunggaknama: string
  nominalnunggakkode: string
  nominalnunggaknama: string
  blokm3nama: string
  nominalkode: string
  nominalnama: string
  kondisimeterkode: string
  kondisimeternama: string
  wpkode: string
  dmakode: string
  mutasikode: string
  mutasinama: string
  kategorialkode: string
  kategorialnama: string
  tglcatat: string
}

/// lapdatametertes.csv — hasil pencatatan meter dari aplikasi baca meter
/// petugas lapangan (pra-verifikasi). PENTING: kolom "Kd_kel"/"Nm_Kel"
/// SEBENARNYA berisi kode/teks kondisi-catat, BUKAN kelurahan — lihat
/// normalize.ts.
export interface LapdatameterRow {
  "No Pel": string
  Nama: string
  Alamat: string
  Periode: string
  "St AWAL": string
  "St Akhir": string
  "St Akhir Catat": string
  Pakai: string
  "Pakai Lau": string
  persentase: string
  Trf: string
  Kd_kel: string
  Nm_Kel: string
  kd_petugas: string
  kd_wm: string
  Wil: string
  Rute: string
  "Zona Wil": string
  "Kd Zonasi": string
  "Nama Zonasi": string
  Kecamatan: string
  Kelurahan: string
  tgl_catat: string
  tgl_upload: string
  "Nama Petugas": string
}

/// PBPK202605-PW5.csv — pasang baru & pemasangan kembali (mutasian: PB/PK).
export interface PbpkRow {
  nolg: string
  nolangganan: string
  nama: string
  kd_kecamatan: string
  kd_kelurahan: string
  rt: string
  rw: string
  alamat: string
  notelp: string
  jmlpenghuni: string
  nometer: string
  kd_merkmeter: string
  kd_ukmeter: string
  tglaktif: string
  sta_aktif: string
  wilayah: string
  kd_rute: string
  updater: string
  geo_long: string
  goe_lat: string
  kode_wilayah: string
  kd_goltarif: string
  no_urutrute: string
  mutasian: string
}

/// r-nomor.csv — riwayat pemutusan sambungan (TSM/SPT) karena tunggakan
/// atau permintaan pelanggan.
export interface RNomorRow {
  periode: string
  jenis_pemutusan: string
  nomor_pelanggan: string
  nama: string
  no_surat: string
  tgl_permohonan: string
  tgl_tutup: string
  no_spt: string
  tgl_spt: string
  tgl_cabut: string
}

export function readProgresCater(): ProgresCaterRow[] {
  return readCsv<ProgresCaterRow>("ProgresCater-PW5.csv")
}

export function readLapdatameter(): LapdatameterRow[] {
  return readCsv<LapdatameterRow>("lapdatametertes.csv")
}

const PBPK_FILENAME = "PBPK202605-PW5.csv"

export function readPbpk(): PbpkRow[] {
  return readCsv<PbpkRow>(PBPK_FILENAME)
}

/// PBPK.csv TIDAK punya kolom "periode" sendiri (beda dari ProgresCater/
/// r-nomor) — periodenya cuma tersirat di NAMA FILE ("PBPK202605-PW5.csv"
/// -> 202605). WAJIB diambil dari nama file, BUKAN dari tglaktif (dua
/// baris "PK" di data py tglaktif-nya adalah tanggal pasang ASLI sambungan
/// lama, bisa puluhan tahun lalu — bukan tanggal mutasi bulan ini).
export function getPbpkPeriode(): number {
  const match = PBPK_FILENAME.match(/PBPK(\d{6})/)
  if (!match) throw new Error(`Tidak bisa mengekstrak periode dari nama file ${PBPK_FILENAME}`)
  return Number(match[1])
}

export function readRNomor(): RNomorRow[] {
  return readCsv<RNomorRow>("r-nomor.csv")
}
