/**
 * bottom-dock.tsx — tab bar bawah gaya iOS (padanan `BottomDock` +
 * `DockItem` di features/public/home/widgets/bottom_dock.dart): lebar penuh,
 * menempel tepi bawah, latar blur/translusen, hairline di atas, dan tint
 * systemBlue untuk item aktif — padanan UITabBar standar.
 *
 * Murni presentational: tidak tahu apa pun soal layar tujuan. Di Expo Router,
 * adapter di `app/(tabs)/_layout.tsx` yang memetakan state navigasi → props ini.
 *
 * `icon` = glyph tidak aktif (outline), `iconActive` = glyph aktif (filled) —
 * iOS membedakan keduanya (mis. "home-outline" vs "home"). Bila `iconActive`
 * null, glyph yang sama dipakai di kedua keadaan.
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme-context';

type IoniconName = keyof typeof Ionicons.glyphMap;

export interface DockItem {
  icon: IoniconName;
  iconActive?: IoniconName;
  label: string;
}

export interface BottomDockProps {
  items: DockItem[];
  currentIndex: number;
  onTap: (index: number) => void;
}

export function BottomDock({ items, currentIndex, onTap }: BottomDockProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={48}
      tint={isDark ? 'dark' : 'light'}
      style={[styles.bar, { borderTopColor: colors.iosSeparator }]}
    >
      <View style={[styles.row, { paddingBottom: insets.bottom }]}>
        {items.map((item, i) => {
          const active = i === currentIndex;
          const color = active ? colors.systemBlue : colors.iosSecondaryLabel;
          const name = active ? item.iconActive ?? item.icon : item.icon;
          return (
            <Pressable key={item.label} onPress={() => onTap(i)} style={styles.button}>
              <Ionicons name={name} size={24} color={color} />
              <Text style={[styles.label, { color }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row' },
  button: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: { fontSize: 10, fontWeight: '600' },
});
