/**
 * badge.tsx — lencana kecil (padanan `ShadBadge` + varian). Varian `default`,
 * `secondary`, `outline`, `destructive`; warna dapat ditimpa lewat
 * `backgroundColor`/`foregroundColor` (dipakai StatusBadge untuk nada
 * sukses/peringatan yang tak punya varian shadcn sendiri).
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/theme-context';
import type { ThemeColors } from '../theme/tokens';

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  backgroundColor?: string;
  foregroundColor?: string;
}

export function Badge({ children, variant = 'default', backgroundColor, foregroundColor }: BadgeProps) {
  const { colors, radius } = useTheme();
  const v = variantStyle(variant, colors);
  const bg = backgroundColor ?? v.bg;
  const fg = foregroundColor ?? v.fg;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg, borderColor: v.border, borderRadius: radius.sm },
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[styles.text, { color: fg }]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

function variantStyle(
  variant: BadgeVariant,
  c: ThemeColors,
): { bg: string; fg: string; border: string } {
  switch (variant) {
    case 'secondary':
      return { bg: c.secondary, fg: c.secondaryForeground, border: 'transparent' };
    case 'outline':
      return { bg: 'transparent', fg: c.foreground, border: c.border };
    case 'destructive':
      return { bg: c.destructive, fg: c.destructiveForeground, border: 'transparent' };
    case 'default':
    default:
      return { bg: c.primary, fg: c.primaryForeground, border: 'transparent' };
  }
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 12, fontWeight: '600', letterSpacing: -0.1 },
});
