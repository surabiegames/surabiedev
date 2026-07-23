/**
 * button.tsx — tombol standar (padanan `ShadButton` + variannya). Varian
 * meniru shadcn: `default` (primer terisi), `secondary`, `outline`, `ghost`,
 * `destructive`. Mendukung `leading`/`trailing` (ikon atau spinner) dan
 * keadaan `loading`/`disabled`.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/theme-context';
import type { ThemeColors } from '../theme/tokens';

export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';

export interface ButtonProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Rentangkan selebar induk (pola tombol utama form). */
  block?: boolean;
  style?: ViewStyle;
}

export function Button({
  children,
  onPress,
  variant = 'default',
  disabled = false,
  loading = false,
  leading,
  trailing,
  block = true,
  style,
}: ButtonProps) {
  const { colors, radius } = useTheme();
  const v = variantStyle(variant, colors);
  const nonaktif = disabled || loading;

  return (
    <Pressable
      onPress={nonaktif ? undefined : onPress}
      disabled={nonaktif}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border, borderRadius: radius.md },
        block ? styles.block : styles.inline,
        nonaktif && styles.disabled,
        pressed && !nonaktif && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} style={styles.slot} />
      ) : leading != null ? (
        <View style={styles.slot}>{leading}</View>
      ) : null}
      {typeof children === 'string' ? (
        <Text style={[styles.label, { color: v.fg }]}>{children}</Text>
      ) : (
        children
      )}
      {trailing != null && !loading ? <View style={styles.slot}>{trailing}</View> : null}
    </Pressable>
  );
}

function variantStyle(
  variant: ButtonVariant,
  c: ThemeColors,
): { bg: string; fg: string; border: string } {
  switch (variant) {
    case 'secondary':
      return { bg: c.secondary, fg: c.secondaryForeground, border: 'transparent' };
    case 'outline':
      return { bg: 'transparent', fg: c.foreground, border: c.border };
    case 'ghost':
      return { bg: 'transparent', fg: c.foreground, border: 'transparent' };
    case 'destructive':
      return { bg: c.destructive, fg: c.destructiveForeground, border: 'transparent' };
    case 'default':
    default:
      return { bg: c.primary, fg: c.primaryForeground, border: 'transparent' };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  block: { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  slot: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
});
