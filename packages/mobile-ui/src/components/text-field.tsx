/**
 * text-field.tsx — input teks berlabel (padanan `ShadInputFormField`).
 *
 * Berbeda dari Flutter yang memakai ShadForm + validator terpusat, di RN
 * validasi dikelola state layar (controlled): layar menghitung pesan galat
 * lalu mengopernya lewat `error`. Komponen ini murni presentasi + a11y —
 * menampilkan label, kotak input bertema, dan pesan galat/deskripsi di bawah.
 */
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import { useTheme } from '../theme/theme-context';

export interface TextFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  placeholder?: string;
  /** Pesan galat validasi; bila ada, border & teks bantuan jadi destruktif. */
  error?: string | null;
  /** Teks bantuan di bawah input saat tidak ada galat. */
  description?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  editable?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  multiline?: boolean;
  onBlur?: () => void;
}

export function TextField({
  value,
  onChangeText,
  label,
  placeholder,
  error,
  description,
  keyboardType,
  maxLength,
  editable = true,
  secureTextEntry,
  autoCapitalize,
  multiline,
  onBlur,
}: TextFieldProps) {
  const { colors, radius } = useTheme();
  const [fokus, setFokus] = useState(false);

  const borderColor = error ? colors.destructive : fokus ? colors.ring : colors.input;
  const bantuan = error ?? description;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
        maxLength={maxLength}
        editable={editable}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        selectionColor={colors.ring}
        onFocus={() => setFokus(true)}
        onBlur={() => {
          setFokus(false);
          onBlur?.();
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            color: colors.foreground,
            backgroundColor: colors.background,
            borderColor,
            borderRadius: radius.md,
          },
          !editable && styles.disabled,
        ]}
      />
      {bantuan ? (
        <Text
          style={[
            styles.help,
            { color: error ? colors.destructive : colors.mutedForeground },
          ]}
        >
          {bantuan}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  disabled: { opacity: 0.5 },
  help: { fontSize: 12.5, lineHeight: 17 },
});
