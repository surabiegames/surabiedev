/**
 * premium-background.tsx — latar halaman premium (padanan `PremiumBackground`
 * di core/widgets/glass_panel.dart): gradien vertikal lembut + dua "cahaya"
 * radial samar di pojok, memberi kedalaman tanpa mengganggu konten.
 *
 * CATATAN: glow di Flutter memakai RadialGradient. expo-linear-gradient hanya
 * mendukung gradien linear, jadi cahaya di sini diaproksimasi dengan lingkaran
 * beropacity rendah (tepinya nyaris tak terlihat pada alpha sekecil ini).
 * Bila kelak butuh radial sejati, ganti _Glow dengan react-native-svg
 * <RadialGradient>.
 */
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/theme-context';

export function PremiumBackground({ children }: { children: ReactNode }) {
  const { isDark } = useTheme();

  const gradient = isDark
    ? (['#020617', '#010409'] as const) // slate-950 → hampir hitam
    : (['#F8FAFC', '#F1F5F9'] as const); // slate-50 → slate-100

  return (
    <LinearGradient colors={gradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.fill}>
      <_Glow
        color={isDark ? '#2DD4BF26' : '#38BDF833'}
        style={{ top: -120, right: -80 }}
      />
      <_Glow
        color={isDark ? '#0EA5E91F' : '#5EEAD426'}
        style={{ bottom: -140, left: -100 }}
      />
      {children}
    </LinearGradient>
  );
}

function _Glow({ color, style }: { color: string; style: object }) {
  // `pointerEvents` di STYLE (bukan prop) — prop-nya deprecated di RN Web.
  return <View style={[styles.glow, { backgroundColor: color, pointerEvents: 'none' }, style]} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
  },
});
