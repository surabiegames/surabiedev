/**
 * photo-box.tsx — kotak unggah + pratinjau SATU foto bukti (padanan
 * `KotakFotoBukti`). Dipakai BERSAMA layar Lapor Pengaduan & Lapor Meter
 * supaya ukurannya IDENTIK. Label/deskripsi dirender layar pemanggil; yang
 * disamakan hanya KOTAK-nya.
 */
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from './theme/theme-context';

export interface PhotoBoxProps {
  /** URI berkas foto yang sudah diambil — null = belum ada foto. */
  uri: string | null;
  onPress?: () => void;
  /** Sedang mengompres/memproses foto (tampilkan spinner). */
  memproses?: boolean;
}

export function PhotoBox({ uri, onPress, memproses = false }: PhotoBoxProps) {
  const { colors, radius } = useTheme();
  const terisi = uri != null;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.box,
        {
          backgroundColor: colors.muted,
          borderColor: terisi ? colors.primary : colors.border,
          borderRadius: radius.sm,
        },
      ]}
    >
      {memproses ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : terisi ? (
        <>
          <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
          <View style={styles.pita}>
            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            <Text style={styles.pitaText}>Ganti / hapus foto</Text>
          </View>
        </>
      ) : (
        <View style={styles.center}>
          <Ionicons name="camera" size={28} color={colors.mutedForeground} />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>Ambil foto</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { height: 160, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  hint: { fontSize: 13 },
  preview: { width: '100%', height: '100%' },
  pita: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 4,
    backgroundColor: '#000000B3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pitaText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
});
