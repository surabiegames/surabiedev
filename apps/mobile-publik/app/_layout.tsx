// Root layout app PUBLIK "Tirtawening" (padanan PublikApp + GerbangPublik di
// lib/app/publik_app.dart): pasang ThemeProvider (mengikuti mode sistem),
// area aman, status bar adaptif, dan PULIHKAN sesi warga tersimpan SEBELUM
// beranda pertama tampil — supaya kartu akun tidak "berkedip" dari keluar ke
// masuk setelah render pertama. Login TETAP opsional: gagal/tak ada token
// hanya berarti beranda tampil anonim (bukan diarahkan ke layar masuk).
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@workspace/mobile-ui';
import { SesiWarga } from '@workspace/mobile-core';
import 'react-native-reanimated';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Tahan splash sampai sesi selesai dipulihkan (setara FutureBuilder GerbangPublik).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    // pulihkan() tidak menyentuh jaringan — hanya membaca secure storage.
    SesiWarga.pulihkan().finally(() => {
      setSiap(true);
      void SplashScreen.hideAsync();
    });
  }, []);

  if (!siap) return null; // Splash masih tampil.

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
