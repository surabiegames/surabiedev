/**
 * db.ts — pembuka SQLite lokal, pondasi kerja offline aplikasi petugas.
 * Padanan `core/db/database_lokal.dart` (sqflite → expo-sqlite).
 *
 * KENAPA SQLITE, BUKAN SECURE-STORE/ASYNC-STORAGE. Paket rute berisi ratusan
 * baris dan antrean offline berisi hasil kerja SEHARIAN petugas. Sebagai satu
 * blob JSON, gagal parse = SEMUANYA hilang; sebagai baris tabel, satu baris
 * korup tidak menular ke tetangganya. Aurora bertahan bertahun-tahun di
 * lapangan dengan pola ini, dan alasannya persis itu.
 *
 * Query per-domain TIDAK ada di sini — lihat `dao.ts`.
 */
import * as SQLite from 'expo-sqlite';

const NAMA_BERKAS = 'wipel_petugas.db';

/**
 * Versi skema. Naikkan HANYA bersama cabang migrasi di [migrasi]; menaikkan
 * tanpa cabang berarti perangkat lama berhenti di versi lamanya tanpa
 * peringatan apa pun.
 */
const VERSI = 1;

let koneksi: SQLite.SQLiteDatabase | null = null;
let sedangDibuka: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Buka (sekali) database lokal. Aman dipanggil serentak: pemanggil kedua
 * menunggu promise yang sama alih-alih membuka koneksi kedua — dua koneksi
 * ke berkas yang sama adalah jalan pintas menuju "database is locked".
 */
export function bukaDb(): Promise<SQLite.SQLiteDatabase> {
  if (koneksi != null) return Promise.resolve(koneksi);
  if (sedangDibuka != null) return sedangDibuka;

  sedangDibuka = (async () => {
    const db = await SQLite.openDatabaseAsync(NAMA_BERKAS);
    await migrasi(db);
    koneksi = db;
    sedangDibuka = null;
    return db;
  })().catch((err) => {
    sedangDibuka = null;
    throw err;
  });

  return sedangDibuka;
}

async function migrasi(db: SQLite.SQLiteDatabase): Promise<void> {
  // WAL: pembacaan tidak memblokir penulisan. Petugas menggulir daftar rute
  // sambil antrean menulis di belakang — tanpa ini keduanya saling menunggu.
  await db.execAsync('PRAGMA journal_mode = WAL');

  const baris = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const versiSekarang = baris?.user_version ?? 0;
  if (versiSekarang >= VERSI) return;

  if (versiSekarang < 1) {
    // Paket rute yang diunduh. Kolom yang DIPAKAI MENYARING/MENGURUTKAN
    // dipecah jadi kolom nyata; sisanya utuh di data_json supaya server
    // boleh menambah field tanpa memaksa migrasi skema di ribuan perangkat.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pelanggan_rute(
        nomor_langganan TEXT PRIMARY KEY,
        pelanggan_id    TEXT NOT NULL,
        nama            TEXT NOT NULL DEFAULT '',
        alamat          TEXT,
        rute_kode       TEXT,
        urutan          INTEGER,
        periode         INTEGER NOT NULL,
        sudah_dicatat   INTEGER NOT NULL DEFAULT 0,
        data_json       TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_pelanggan_rute_urutan ON pelanggan_rute(urutan);
      CREATE INDEX IF NOT EXISTS idx_pelanggan_rute_rute ON pelanggan_rute(rute_kode);
    `);

    // Antrean offline (outbox) hasil catat yang belum sampai server.
    // UNIQUE(nomor_langganan, periode) ON CONFLICT REPLACE menyamai
    // @@unique([nomorLangganan, periode]) di server: mencatat ulang
    // pelanggan yang sama MENIMPA antreannya, bukan menggandakannya.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS antrean_laporan(
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        nomor_langganan TEXT NOT NULL,
        periode         INTEGER NOT NULL,
        payload_json    TEXT NOT NULL,
        foto_paths_json TEXT NOT NULL DEFAULT '{}',
        percobaan       INTEGER NOT NULL DEFAULT 0,
        pesan_gagal     TEXT,
        dibuat_pada     TEXT NOT NULL,
        UNIQUE(nomor_langganan, periode) ON CONFLICT REPLACE
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS meta(
        kunci TEXT PRIMARY KEY,
        nilai TEXT NOT NULL
      );
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${VERSI}`);
}

/**
 * Tutup koneksi — dipakai uji dan "hapus data lokal". Bukan bagian dari alur
 * normal: database tetap terbuka selama aplikasi hidup.
 */
export async function tutupDb(): Promise<void> {
  await koneksi?.closeAsync();
  koneksi = null;
}
