/**
 * backup.ts — cadangan hasil catat di penyimpanan perangkat. Padanan
 * `core/services/backup_lokal.dart`.
 *
 * KENAPA ADA, padahal sudah ada SQLite. Antrean SQLite adalah jalur kirim;
 * ini jalur SELAMAT. Bila database lokal korup atau aplikasi di-uninstall
 * setengah jalan, hasil kerja sehari penuh masih tergeletak sebagai berkas
 * biasa yang bisa diambil manual. Aurora memakai pola yang sama (`catatTxt`
 * ditulis SEBELUM yakin terkirim), dan itu berkali-kali menyelamatkan
 * pencatatan yang sudah telanjur dilakukan.
 *
 * Tata letak:
 * ```
 * <document>/tirtawening/backup/
 *     stand/     202607_stand_00700800867.jpg
 *     rumah/     202607_rumah_00700800867.jpg
 *     segel/     202607_segel_00700800867.jpg
 *     video/     202607_video_00700800867.mp4
 *     catatan/   202607_catatan.csv     # ringkasan teks, bahan impor web
 *     .meta/<periode>/<nomor>.json      # payload penuh (bahan pemulihan)
 *     .meta/<periode>/<nomor>.terunggah # ada = sudah aman di server
 *     log/       catat_202607.txt  error.log
 * ```
 *
 * `.meta` diawali titik: itu untuk mesin (pemulihan), bukan untuk dibaca
 * manusia. Folder foto per-tipe dan CSV catatan-lah yang dibagikan.
 *
 * SEMUA fungsi di sini MENELAN errornya sendiri. Cadangan tidak boleh
 * menjatuhkan alur utama — gagal mencadangkan bukan gagal mencatat.
 */
import { Directory, File, Paths } from 'expo-file-system';
import type { JenisBerkas } from '@workspace/mobile-core';

const SEMUA_JENIS: JenisBerkas[] = ['stand', 'segel', 'rumah', 'video'];

/** Satu bundel cadangan: satu pelanggan pada satu periode. */
export interface BundelPembacaan {
  periode: number;
  nomorLangganan: string;
  /** Seluruh field pembacaan + metadata — bahan pemulihan ke antrean. */
  data: Record<string, unknown>;
  fotoPaths: Partial<Record<JenisBerkas, string>>;
  /** true = sudah pernah sukses diunggah (penanda `.terunggah`). */
  terunggah: boolean;
}

function akar(): Directory {
  return new Directory(Paths.document, 'tirtawening', 'backup');
}

/** Direktori sub-folder, dibuat bila belum ada. */
function dir(...bagian: string[]): Directory {
  const d = new Directory(akar(), ...bagian);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

/** Path folder cadangan untuk ditunjukkan ke petugas. null bila tak terbaca. */
export function lokasiFolder(): string | null {
  try {
    return akar().uri;
  } catch {
    return null;
  }
}

function namaBerkas(periode: number, jenis: JenisBerkas, nomor: string): string {
  return `${periode}_${jenis}_${nomor}.${jenis === 'video' ? 'mp4' : 'jpg'}`;
}

function berkasFoto(periode: number, jenis: JenisBerkas, nomor: string): File {
  return new File(dir(jenis), namaBerkas(periode, jenis, nomor));
}

/**
 * Salin foto/video bukti ke folder per-tipe. Cache image picker bisa
 * dibersihkan OS kapan saja, jadi SALINAN INI yang jadi path utama dan yang
 * kelak diunggah. Kembalikan path salinan, atau null bila gagal.
 */
export async function simpanSalinanFoto(input: {
  jenis: JenisBerkas;
  periode: number;
  nomorLangganan: string;
  sumberPath: string;
}): Promise<string | null> {
  try {
    const sumber = new File(input.sumberPath);
    if (!sumber.exists) return null;
    const tujuan = berkasFoto(input.periode, input.jenis, input.nomorLangganan);
    if (tujuan.exists) tujuan.delete();
    await sumber.copy(tujuan);
    return tujuan.uri;
  } catch {
    return null;
  }
}

// ── Meta pembacaan (pemulihan) + CSV catatan (impor teks) ──────────────

function dirMeta(periode: number): Directory {
  return dir('.meta', String(periode));
}

/**
 * Tulis meta pembacaan — SELURUH field + metadata — lalu regenerasi CSV
 * catatan periode itu supaya ringkasan teksnya selalu sinkron.
 */
export async function simpanCatatan(input: {
  periode: number;
  nomorLangganan: string;
  data: Record<string, unknown>;
}): Promise<void> {
  try {
    const berkas = new File(dirMeta(input.periode), `${input.nomorLangganan}.json`);
    if (berkas.exists) berkas.delete();
    berkas.create({ overwrite: true });
    berkas.write(JSON.stringify(input.data, null, 2));
    await tulisCsvCatatan(input.periode);
  } catch {
    // sengaja ditelan — lihat doc berkas.
  }
}

const KOLOM_CSV = [
  'periode',
  'nomorLangganan',
  'nomorMeter',
  'ruteKode',
  'standAwal',
  'standAkhir',
  'pemakaianLalu',
  'kondisi',
  'isSegel',
  'usulanPerubahan',
  'notelpBaru',
  'latCatat',
  'longCatat',
  'namaPetugas',
  'tanggalCatat',
] as const;

/**
 * Eskape satu sel CSV (RFC 4180): bungkus tanda kutip bila mengandung
 * koma/kutip/baris-baru, dan gandakan kutip di dalamnya. Alamat pelanggan
 * memang berisi koma — tanpa ini berkasnya bergeser kolom saat diimpor.
 */
function selCsv(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** Regenerasi `catatan/<periode>_catatan.csv` dari seluruh meta periode itu. */
async function tulisCsvCatatan(periode: number): Promise<void> {
  const metaDir = dirMeta(periode);
  if (!metaDir.exists) return;

  const baris: string[] = [KOLOM_CSV.map(selCsv).join(',')];
  for (const entri of metaDir.list()) {
    if (!(entri instanceof File) || !entri.name.endsWith('.json')) continue;
    try {
      const d = JSON.parse(await entri.text()) as Record<string, unknown>;
      baris.push(KOLOM_CSV.map((k) => selCsv(d[k])).join(','));
    } catch {
      continue; // meta korup — lewati barisnya, jangan gagalkan berkasnya.
    }
  }

  const csv = new File(dir('catatan'), `${periode}_catatan.csv`);
  if (csv.exists) csv.delete();
  csv.create({ overwrite: true });
  csv.write(`${baris.join('\r\n')}\r\n`);
}

/**
 * Tandai satu pembacaan sudah aman di server (penanda kosong `.terunggah`) —
 * pemulihan memakainya untuk melewati yang sudah terunggah.
 */
export async function tandaiTerunggah(periode: number, nomorLangganan: string): Promise<void> {
  try {
    const penanda = new File(dirMeta(periode), `${nomorLangganan}.terunggah`);
    if (!penanda.exists) {
      penanda.create({ overwrite: true });
      penanda.write('');
    }
  } catch {
    // ditelan.
  }
}

/**
 * Seluruh bundel cadangan di perangkat (layar Cadangan & pemulihan).
 * Dibangun dari meta; foto ditemukan lewat konvensi nama di folder per-tipe.
 */
export async function daftarBundel(): Promise<BundelPembacaan[]> {
  try {
    const metaRoot = new Directory(akar(), '.meta');
    if (!metaRoot.exists) return [];

    const hasil: BundelPembacaan[] = [];
    for (const entriPeriode of metaRoot.list()) {
      if (!(entriPeriode instanceof Directory)) continue;
      const periode = Number.parseInt(entriPeriode.name, 10);
      if (!Number.isFinite(periode)) continue;

      for (const entri of entriPeriode.list()) {
        if (!(entri instanceof File) || !entri.name.endsWith('.json')) continue;
        const nomor = entri.name.replace(/\.json$/, '');
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(await entri.text()) as Record<string, unknown>;
        } catch {
          continue; // meta korup — lewati.
        }
        const fotoPaths: Partial<Record<JenisBerkas, string>> = {};
        for (const jenis of SEMUA_JENIS) {
          const f = berkasFoto(periode, jenis, nomor);
          if (f.exists) fotoPaths[jenis] = f.uri;
        }
        hasil.push({
          periode,
          nomorLangganan: nomor,
          data,
          fotoPaths,
          terunggah: new File(entriPeriode, `${nomor}.terunggah`).exists,
        });
      }
    }
    hasil.sort((a, b) => b.periode - a.periode);
    return hasil;
  } catch {
    return [];
  }
}

/**
 * Berkas CSV catatan yang siap dibagikan (terbaru dulu) — bahan impor di
 * dashboard web. Aplikasi Flutter lama mem-ZIP folder foto + CSV; di sini
 * yang dibagikan adalah CSV-nya, karena tanpa pustaka arsip native sebuah ZIP
 * hanya akan menambah dependensi tanpa menambah data. Fotonya tetap ada di
 * folder cadangan dan bisa diambil lewat pengelola berkas.
 */
export function daftarCsvCatatan(): { nama: string; uri: string; periode: number }[] {
  try {
    const d = new Directory(akar(), 'catatan');
    if (!d.exists) return [];
    return d
      .list()
      .filter((f): f is File => f instanceof File && f.name.endsWith('.csv'))
      .map((f) => ({
        nama: f.name,
        uri: f.uri,
        periode: Number.parseInt(f.name.split('_')[0] ?? '0', 10) || 0,
      }))
      .sort((a, b) => b.periode - a.periode);
  } catch {
    return [];
  }
}

// ── Log lapangan ───────────────────────────────────────────────────────

/**
 * Satu baris pipe-delimited per penyimpanan catat — log cepat-baca:
 * `nomor|stand|kondisi|petugas|longlat|waktu|`.
 *
 * Ditulis SEBELUM laporan masuk antrean, mengikuti Aurora: apa pun nasib
 * jaringan (dan database) berikutnya, angka yang sudah dibaca petugas sudah
 * tercatat di suatu tempat.
 */
export async function catatLog(input: {
  periode: number;
  nomorLangganan: string;
  standAkhir: string;
  kondisi: string;
  petugas?: string | null;
  longlat?: string | null;
}): Promise<void> {
  try {
    const berkas = new File(dir('log'), `catat_${input.periode}.txt`);
    const baris = [
      input.nomorLangganan,
      input.standAkhir,
      input.kondisi,
      input.petugas ?? '',
      input.longlat ?? '',
      new Date().toISOString(),
      '',
    ].join('|');
    tambahBaris(berkas, `${baris}\n`);
  } catch {
    // ditelan.
  }
}

export async function catatError(pesan: string): Promise<void> {
  try {
    tambahBaris(new File(dir('log'), 'error.log'), `${new Date().toISOString()} ${pesan}\n`);
  } catch {
    // ditelan.
  }
}

/**
 * Tambah di akhir berkas. `File.write()` SDK 57 selalu menimpa, jadi mode
 * append dibuat manual lewat baca-gabung-tulis. Log lapangan berumur satu
 * periode dan hanya berisi baris pendek, sehingga biayanya tidak berarti —
 * tapi jangan pakai pola ini untuk berkas yang tumbuh besar.
 */
function tambahBaris(berkas: File, baris: string): void {
  if (!berkas.exists) {
    berkas.create({ intermediates: true, overwrite: true });
    berkas.write(baris);
    return;
  }
  berkas.write(baris, { encoding: 'utf8', append: true });
}
