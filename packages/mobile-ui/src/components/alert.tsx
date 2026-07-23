/**
 * alert.tsx — kotak peringatan inline (padanan `ShadAlert` + `ShadAlert.destructive`).
 * Ikon di kiri, judul + deskripsi di kanan. Varian `default` (netral) dan
 * `destructive` (galat) — mewarnai border, ikon, dan judul.
 */
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/theme-context';

export type AlertVariant = 'default' | 'destructive';

export interface AlertProps {
  title: string;
  description?: ReactNode;
  variant?: AlertVariant;
  /** Nama ikon Ionicons; default menyesuaikan varian. */
  icon?: ComponentProps<typeof Ionicons>['name'];
}

export function Alert({ title, description, variant = 'default', icon }: AlertProps) {
  const { colors, radius } = useTheme();
  const aksen = variant === 'destructive' ? colors.destructive : colors.foreground;
  const namaIkon = icon ?? (variant === 'destructive' ? 'alert-circle' : 'information-circle');

  return (
    <View
      style={[
        styles.alert,
        {
          borderColor: variant === 'destructive' ? colors.destructive : colors.border,
          backgroundColor: colors.card,
          borderRadius: radius.md,
        },
      ]}
    >
      <Ionicons name={namaIkon} size={20} color={aksen} style={styles.icon} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: aksen }]}>{title}</Text>
        {description != null ? (
          typeof description === 'string' ? (
            <Text style={[styles.desc, { color: colors.mutedForeground }]}>{description}</Text>
          ) : (
            description
          )
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  alert: {
    flexDirection: 'row',
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  icon: { marginTop: 1 },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 14.5, fontWeight: '700' },
  desc: { fontSize: 13, lineHeight: 18 },
});
