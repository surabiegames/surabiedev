/**
 * card.tsx — kartu standar (padanan `ShadCard` dari shadcn_ui yang dipakai
 * di seluruh layar). Latar solid `colors.card`, hairline border, sudut
 * `radius.card`. Berbeda dari GlassPanel (yang translusen di atas gradien) —
 * Card adalah permukaan buram untuk konten padat (rincian tagihan, form).
 *
 * Susunan header meniru ShadCard: [leading] [judul + deskripsi] [trailing],
 * lalu `children` di bawahnya bila ada.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme-context';

export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  style?: ViewStyle;
}

export function Card({ title, description, leading, trailing, children, style }: CardProps) {
  const { colors, radius } = useTheme();
  const adaHeader = title != null || description != null || leading != null || trailing != null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radius.card,
        },
        shadowFor(),
        style,
      ]}
    >
      {adaHeader ? (
        <View style={styles.header}>
          {leading != null ? <View style={styles.leading}>{leading}</View> : null}
          <View style={styles.headerText}>
            {/* Judul/deskripsi menerima string ATAU node; string dibungkus Text
                bertema supaya pemanggil tak perlu mengurus warna. */}
            {typeof title === 'string' ? (
              <Text style={[styles.title, { color: colors.cardForeground }]}>{title}</Text>
            ) : (
              title
            )}
            {typeof description === 'string' ? (
              <Text style={[styles.description, { color: colors.mutedForeground }]}>
                {description}
              </Text>
            ) : (
              description
            )}
          </View>
          {trailing != null ? <View style={styles.trailing}>{trailing}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Bayangan lembut ala kartu iOS — `boxShadow` lintas-platform (RN 0.76+). */
function shadowFor(): ViewStyle {
  return { boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.06)' };
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leading: { marginRight: 12 },
  headerText: { flex: 1, gap: 3 },
  trailing: { marginLeft: 12, alignItems: 'flex-end' },
  title: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  description: { fontSize: 13, lineHeight: 18 },
});
