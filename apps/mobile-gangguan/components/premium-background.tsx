/**
 * premium-background.tsx — LATAR HALAMAN. Namanya dipertahankan karena
 * dipakai di banyak layar, tapi ia bukan lagi latar "premium".
 *
 * PADANAN `body { @apply bg-background }` di packages/ui globals.css: satu
 * warna `background` yang rata. Itu saja.
 *
 * YANG DIBUANG: gradien vertikal dua warna dan dua cahaya radial di pojok
 * (`react-native-svg` RadialGradient, warisan `_Cahaya` Flutter). Keduanya
 * indah, tapi dashboard web tidak punya apa pun seperti itu — dan latar
 * bergradien adalah alasan kartu translusen dulu diperlukan. Sekali latarnya
 * rata, kartu bisa memakai warna `card` yang sesungguhnya, dan kontras teks
 * jadi persis seperti yang dirancang di token.
 *
 * Kalau suatu saat butuh kedalaman, tempatnya di `card` vs `background`
 * (dua warna berbeda di mode gelap: #161B1D di atas #090B0C), bukan gradien.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from './theme/theme-context';

export function PremiumBackground({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.fill, { backgroundColor: colors.background }]}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
