/**
 * premium-background.tsx — latar halaman premium (padanan `PremiumBackground`
 * di core/widgets/glass_panel.dart): gradien vertikal lembut, beberapa
 * "cahaya" radial samar di posisi asimetris (emerald/sky/teal — rumpun
 * MasterPalette), dan garis sheen tipis di atas — memberi kedalaman & kesan
 * premium tanpa watermark logo, tanpa mengganggu keterbacaan konten.
 *
 * CATATAN: glow di Flutter memakai RadialGradient. expo-linear-gradient
 * hanya mendukung gradien linear, jadi cahaya di sini diaproksimasi dengan
 * lingkaran beropacity rendah (tepinya nyaris tak terlihat pada alpha
 * sekecil ini). Bila kelak butuh radial sejati, ganti _Glow dengan
 * react-native-svg <RadialGradient>.
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
      {/* Sheen tipis di tepi atas — kilau halus khas panel kaca premium. */}
      <LinearGradient
        colors={isDark ? ['#FFFFFF14', '#FFFFFF00'] : ['#FFFFFF99', '#FFFFFF00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.sheen}
        pointerEvents="none"
      />

      {/* Tiga glow asimetris dari rumpun warna brand — bukan simetris kaku,
          supaya terasa dirancang, bukan template default. */}
      <_Glow
        color={isDark ? '#2DD4BF26' : '#38BDF833'} // teal / sky
        style={{ top: -140, right: -90, width: 360, height: 360, borderRadius: 180 }}
      />
      <_Glow
        color={isDark ? '#0EA5E91F' : '#5EEAD426'} // sky / teal
        style={{ bottom: -160, left: -110, width: 380, height: 380, borderRadius: 190 }}
      />
      <_Glow
        color={isDark ? '#10B98114' : '#10B98114'} // emerald — sangat samar, aksen aksi utama
        style={{ top: '32%', left: '58%', width: 260, height: 260, borderRadius: 130 }}
      />

      {/* Vignette sangat tipis di tepi bawah — menahan mata, kesan "kartu"
          bukan halaman datar tanpa batas. */}
      <LinearGradient
        colors={isDark ? ['#00000000', '#00000033'] : ['#00000000', '#0F172A14']}
        start={{ x: 0.5, y: 0.7 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
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
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  glow: {
    position: 'absolute',
  },
});