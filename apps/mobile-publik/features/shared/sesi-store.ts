/**
 * sesi-store.ts — token versi sesi warga (padanan `_sesiVersion` di
 * main_shell_screen.dart). Saat masuk/daftar/keluar, `tandaiBerubah()` menaikkan
 * versi; tab lain (Beranda) memakai `useSesiVersi()` sebagai dependency supaya
 * ikut membaca ulang status login tanpa perlu di-remount manual.
 */
import { useSyncExternalStore } from 'react';

let versi = 0;
const pendengar = new Set<() => void>();

export function tandaiSesiBerubah(): void {
  versi += 1;
  for (const l of pendengar) l();
}

function subscribe(listener: () => void): () => void {
  pendengar.add(listener);
  return () => pendengar.delete(listener);
}

/** Nilai berubah tiap kali sesi berubah — pakai untuk memicu render ulang. */
export function useSesiVersi(): number {
  return useSyncExternalStore(subscribe, () => versi);
}
