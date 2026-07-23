/**
 * dialog.tsx — dialog modal (padanan `ShadDialog` / `showShadDialog`).
 *
 * Flutter memanggil `showShadDialog<T>()` imperatif; di RN pola idiomatiknya
 * DEKLARATIF: layar menyimpan state `visible` dan merender `<Dialog>`.
 *
 * IMPLEMENTASI: overlay `position:absolute` mengisi layar, BUKAN `<Modal>`.
 * `Modal` react-native-web posisinya tak deterministik (kadang inline, dan
 * `position:fixed`-nya bisa "terkurung" ancestor ber-filter/transform — mis.
 * BlurView expo-blur — sehingga dialog tampak bergeser/miring, bukan di
 * tengah). Overlay absolute + flex-center berperilaku IDENTIK di web & native.
 * Dialog dirender sebagai anak AppScaffold (lihat prop `children`-nya), jadi
 * ia menutupi seluruh area layar itu.
 *
 * `actions` biasanya beberapa <Button> — ditata menumpuk vertikal (pola sheet
 * iOS) agar label panjang tidak terpotong.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/theme-context';

export interface DialogProps {
  visible: boolean;
  onDismiss?: () => void;
  title?: string;
  description?: ReactNode;
  /** Tombol aksi (ditata menumpuk). */
  actions?: ReactNode;
  children?: ReactNode;
}

export function Dialog({ visible, onDismiss, title, description, actions, children }: DialogProps) {
  const { colors, radius } = useTheme();

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      {/* Backdrop redup penuh-layar: mengetuknya menutup dialog. */}
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      {/* Kartu di tengah; berada DI ATAS backdrop, tap-nya tidak menembus.
          `box-none`: area kosong di sekitar kartu meneruskan tap ke backdrop. */}
      <View style={styles.centerBoxNone}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.popover, borderColor: colors.border, borderRadius: radius.dialog },
          ]}
        >
          {title != null ? (
            <Text style={[styles.title, { color: colors.popoverForeground }]}>{title}</Text>
          ) : null}
          {description != null ? (
            typeof description === 'string' ? (
              <Text style={[styles.desc, { color: colors.mutedForeground }]}>{description}</Text>
            ) : (
              description
            )
          ) : null}
          {children}
          {actions != null ? <View style={styles.actions}>{actions}</View> : null}
        </View>
      </View>
    </View>
  );
}

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  overlay: { ...FILL, zIndex: 1000, alignItems: 'center', justifyContent: 'center' },
  backdrop: { ...FILL, backgroundColor: '#0F172A99' },
  centerBoxNone: {
    ...FILL,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    pointerEvents: 'box-none',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  desc: { fontSize: 14, lineHeight: 20 },
  actions: { marginTop: 12, gap: 8 },
});
