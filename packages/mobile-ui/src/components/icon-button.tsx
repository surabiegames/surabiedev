/**
 * icon-button.tsx — tombol ikon bulat kecil (padanan `ShadIconButton`).
 * Dipakai untuk aksi sekunder ringkas (mis. muat ulang, tutup).
 */
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../theme/theme-context';

export interface IconButtonProps {
  name: ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  size?: number;
  color?: string;
  disabled?: boolean;
  variant?: 'ghost' | 'secondary';
}

export function IconButton({
  name,
  onPress,
  size = 20,
  color,
  disabled = false,
  variant = 'ghost',
}: IconButtonProps) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        { borderRadius: radius.pill },
        variant === 'secondary' && { backgroundColor: colors.secondary },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={name} size={size} color={color ?? colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.4 },
});
