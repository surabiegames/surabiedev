/**
 * Root layout aplikasi PETUGAS "Tirtawening Petugas" — padanan `PetugasApp` +
 * `GerbangPetugas` di lib/app/. Memasang tema, area aman, status bar, dan
 * MEMULIHKAN sesi petugas SEBELUM layar pertama tampil.
 *
 * BEDA MENDASAR dari aplikasi publik: di sana login opsional dan gagal-pulih
 * hanya berarti beranda tampil anonim. Di sini login WAJIB — tanpa token
 * tidak ada rute untuk dibaca — jadi gerbang mengarahkan ke layar masuk.
 *
 * `pulihkan()` TIDAK menyentuh jaringan. Itu disengaja: petugas harus bisa
 * membuka aplikasi dan bekerja dengan rute yang sudah ter-cache walau sedang
 * tanpa sinyal. Keabsahan token teruji sendiri pada request pertama yang
 * berhasil menembus jaringan (401 → sesi berakhir).
 */
import '../global.css';
import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PortalHost } from '@rn-primitives/portal';
import { ApiClient, SesiPetugas } from '@workspace/mobile-core';
import { ThemeProvider } from '@/components';
import 'react-native-reanimated';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    // Token kedaluwarsa/dicabut di tengah pemakaian: lempar kembali ke layar
    // masuk sekali saja. Dipasang di akar supaya berlaku untuk SELURUH layar,
    // bukan hanya yang kebetulan sedang terbuka.
    ApiClient.onUnauthorized = () => {
      void SesiPetugas.keluar().finally(() => router.replace('/masuk'));
    };
    SesiPetugas.pulihkan().finally(() => {
      setSiap(true);
      void SplashScreen.hideAsync();
    });
    return () => {
      ApiClient.onUnauthorized = null;
    };
  }, []);

  if (!siap) return null; // Splash masih tampil.

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      </ThemeProvider>
      {/* Root portal untuk overlay react-native-reusables (Dialog/Select/Menu). */}
      <PortalHost />
    </SafeAreaProvider>
  );
}
