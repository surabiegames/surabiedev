/**
 * kompres-foto.ts — kompresi foto bukti (padanan `core/services/kompres_foto.dart`).
 *
 * Flutter memakai package `image` (Dart murni) di isolate untuk resize +
 * watermark + JPEG q80. Di Expo dipakai `expo-image-manipulator` (context API
 * SDK 57): resize ke lebar target lalu simpan JPEG. Kompresi berjalan di sisi
 * native, tidak membekukan UI — jadi tak perlu isolate/`compute` seperti Dart.
 *
 * PERBEDAAN yang disengaja: **watermark stempel-waktu belum diport**.
 * `expo-image-manipulator` tidak bisa menggambar teks ke gambar (butuh kanvas
 * Skia). Untuk foto pengaduan watermark memang dimatikan (`watermark:false`),
 * jadi tak ada beda. Untuk foto meter, stempel waktu di-*defer*; server tetap
 * mencatat waktu unggah. Ditandai agar tidak terlupakan saat modul verifikasi
 * dibangun. Lihat [[flutter-to-expo-migration]].
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const LEBAR_TARGET_BAWAAN = 600;
const KUALITAS_JPEG = 0.8; // padanan quality 80 di Dart (0–100 → 0.0–1.0).

export interface KompresFotoOptions {
  /** URI berkas sumber (hasil kamera/galeri). */
  sumberUri: string;
  /** Lebar target px; menimpa 600 bawaan (foto pengaduan pakai 1280). */
  lebarTarget?: number;
  /**
   * Keterangan watermark (username). Disimpan untuk kompatibilitas API; belum
   * dirender (lihat catatan modul di atas).
   */
  keterangan?: string;
  /** Aktifkan watermark stempel waktu (belum diimplementasi — no-op). */
  watermark?: boolean;
}

/**
 * Resize [sumberUri] ke [lebarTarget] (rasio dipertahankan) lalu simpan JPEG.
 * Mengembalikan URI hasil. Melempar bila berkas tak terbaca sebagai gambar.
 */
export async function kompresFoto({
  sumberUri,
  lebarTarget = LEBAR_TARGET_BAWAAN,
}: KompresFotoOptions): Promise<string> {
  const konteks = ImageManipulator.manipulate(sumberUri);
  // Satu nilai width → tinggi dihitung otomatis (rasio terjaga). Orientasi EXIF
  // sudah dibakar oleh manipulator, jadi tak perlu bakeOrientation manual.
  konteks.resize({ width: lebarTarget });
  const dirender = await konteks.renderAsync();
  const hasil = await dirender.saveAsync({
    format: SaveFormat.JPEG,
    compress: KUALITAS_JPEG,
  });
  return hasil.uri;
}
