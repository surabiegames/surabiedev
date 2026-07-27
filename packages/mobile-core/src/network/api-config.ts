/**
 * api-config.ts — konfigurasi koneksi ke backend web (Next.js + Hono).
 * Padanan `core/network/api_config.dart`.
 *
 * URL produksi TERTANAM di kode (`URL_PRODUKSI`) — build produksi tidak perlu
 * flag apa pun. Untuk menunjuk backend lain (dev lokal / staging), timpa lewat
 * env Expo saat build/start:
 *   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000 npx expo start
 *
 * MODE DEMO (data contoh in-memory, tanpa backend) diaktifkan EKSPLISIT:
 *   EXPO_PUBLIC_DEMO=true npx expo start
 * Padanan `--dart-define=DEMO=true` di Flutter. Produksi tetap jadi bawaan
 * bila env tidak diisi.
 *
 * Catatan Expo: hanya variabel berawalan `EXPO_PUBLIC_` yang di-inline ke
 * bundel klien — sama seperti `String.fromEnvironment` di Dart yang menetap
 * saat kompilasi.
 */

/** URL produksi resmi (backend ter-deploy di Vercel). */
const URL_PRODUKSI = 'https://perumda.vercel.app';

/** URL lokal default untuk development */
const URL_DEV_LOCAL = 'http://localhost:3001';

/** Penimpa opsional saat build (dev/staging). Kosong = pakai produksi. */
const OVERRIDE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

/** Aktif hanya bila `EXPO_PUBLIC_DEMO=true`. */
const DEMO = process.env.EXPO_PUBLIC_DEMO === 'true';

export const ApiConfig = {
  /** 
   * Base URL efektif:
   * 1. Jika EXPO_PUBLIC_API_BASE_URL diisi di .env -> Pakai OVERRIDE.
   * 2. Jika mode Development (__DEV__) -> Fallback ke localhost:3001.
   * 3. Jika mode Production -> Fallback ke URL_PRODUKSI.
   */
  get baseUrl(): string {
    if (OVERRIDE.length > 0) {
      return OVERRIDE;
    }
    return typeof __DEV__ !== 'undefined' && __DEV__ ? URL_DEV_LOCAL : URL_PRODUKSI;
  },

  /** true = repository memakai data demo in-memory (bukan menembak backend). */
  get isDemo(): boolean {
    return DEMO;
  },

  /** Endpoint publik (tanpa login): cek tagihan, lapor meter, pengaduan. */
  publicPath: '/api/public',

  /** Endpoint bisnis (wajib Bearer token): modul petugas. */
  v1Path: '/api/v1',

  /** Pintu masuk mobile (tanpa token): tukar kredensial → Bearer token. */
  mobileAuthPath: '/api/mobile/auth',
} as const;