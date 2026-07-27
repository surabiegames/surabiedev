/**
 * glass-panel.tsx — panel "kaca" premium gaya macOS (padanan `GlassPanel` di
 * core/widgets/glass_panel.dart): latar semi-translusen di atas gradien
 * halaman, hairline border, sudut besar continuous, bayangan lembut berlapis.
 *
 * `borderCurve: 'continuous'` = superellipse ala iOS/macOS (di iOS; Android
 * mengabaikannya dan memakai busur biasa — cukup dekat).
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from './theme/theme-context';

export interface GlassPanelProps {
  children: ReactNode;
  padding?: number;
  onPress?: () => void;
  style?: ViewStyle;
}

export function GlassPanel({ children, padding = 16, onPress, style }: GlassPanelProps) {
  const { isDark } = useTheme();

  const panelStyle: ViewStyle = {
    padding,
    backgroundColor: isDark ? '#0F172AB8' : '#FFFFFFE6',
    borderColor: isDark ? '#94A3B82E' : '#CBD5E166',
    ...shadowFor(isDark),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.panel, panelStyle, style, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.panel, panelStyle, style]}>{children}</View>;
}

/**
 * Bayangan berlapis Flutter → `boxShadow` RN (satu properti lintas-platform
 * sejak RN 0.76; menggantikan `shadow*`/`elevation` yang kini deprecated di
 * RN Web). Format CSS: offsetX offsetY blur warna.
 */
function shadowFor(isDark: boolean): ViewStyle {
  return { boxShadow: `0px 10px 24px rgba(15, 23, 42, ${isDark ? 0.4 : 0.1})` };
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: 'continuous',
  },
  pressed: { opacity: 0.9 },
});
