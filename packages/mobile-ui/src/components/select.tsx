/**
 * select.tsx — pemilih satu-dari-banyak gaya shadcn (padanan `ShadSelectFormField`).
 *
 * Panel opsi = POPOVER MENGAMBANG: `position:absolute` tepat di bawah trigger,
 * ber-bayangan & sudut membulat, MELAYANG di atas konten (tidak mendorongnya).
 * BUKAN `<Modal>` — Modal react-native-web posisinya tak deterministik (bergeser/
 * terpotong di web). Absolute-relatif-trigger berperilaku sama di web & native.
 *
 * Hover (mouse/web) disorot lewat `onHoverIn/onHoverOut`; di native tak pernah
 * terpicu (tak ada penunjuk). Opsi terpilih → aksen primer + centang. Daftar
 * panjang bisa di-scroll di dalam panel (maks tinggi terbatas).
 *
 * Controlled: `value` + `onValueChange` dikelola layar; `error` mewarnai border.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/theme-context';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string | null;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  placeholder?: string;
  error?: string | null;
}

export function Select({ value, onValueChange, options, label, placeholder, error }: SelectProps) {
  const { colors, radius } = useTheme();
  const [buka, setBuka] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const terpilih = options.find((o) => o.value === value);

  return (
    // zIndex tinggi saat terbuka supaya popover melayang di atas field berikutnya.
    <View style={[styles.wrap, buka && styles.wrapOpen]}>
      {label ? <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text> : null}

      <View style={styles.anchor}>
        <Pressable
          onPress={() => setBuka((b) => !b)}
          style={({ pressed }) => [
            styles.trigger,
            {
              backgroundColor: colors.background,
              borderColor: error ? colors.destructive : buka ? colors.ring : colors.input,
              borderRadius: radius.md,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[styles.triggerText, { color: terpilih ? colors.foreground : colors.mutedForeground }]}
            numberOfLines={1}
          >
            {terpilih ? terpilih.label : (placeholder ?? 'Pilih…')}
          </Text>
          <Ionicons name={buka ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
        </Pressable>

        {buka ? (
          <View
            style={[
              styles.panel,
              {
                backgroundColor: colors.popover,
                borderColor: colors.border,
                borderRadius: radius.md,
                boxShadow: '0px 8px 24px rgba(15, 23, 42, 0.18)',
              },
            ]}
          >
            <ScrollView
              style={styles.panelScroll}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {options.map((item, i) => {
                const aktif = item.value === value;
                const disorot = hover === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => {
                      onValueChange(item.value);
                      setBuka(false);
                      setHover(null);
                    }}
                    onHoverIn={() => setHover(item.value)}
                    onHoverOut={() => setHover((h) => (h === item.value ? null : h))}
                    style={({ pressed }) => [
                      styles.opsi,
                      i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                      aktif && { backgroundColor: colors.accent },
                      (disorot || pressed) && !aktif && { backgroundColor: colors.muted },
                    ]}
                  >
                    <Text
                      style={[
                        styles.opsiText,
                        { color: aktif ? colors.accentForeground : colors.popoverForeground },
                        aktif && styles.opsiTextAktif,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {aktif ? <Ionicons name="checkmark" size={18} color={colors.accentForeground} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {error ? <Text style={[styles.help, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  wrapOpen: { zIndex: 1000 },
  label: { fontSize: 14, fontWeight: '600' },
  anchor: { position: 'relative' },
  trigger: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  triggerText: { flex: 1, fontSize: 15 },
  pressed: { opacity: 0.7 },
  panel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    zIndex: 1000,
  },
  panelScroll: { maxHeight: 260 },
  opsi: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  opsiText: { flex: 1, fontSize: 15 },
  opsiTextAktif: { fontWeight: '600' },
  help: { fontSize: 12.5, lineHeight: 17 },
});
