/**
 * workspace.tsx — sisa kepingan UI bersama ruang kerja petugas.
 *
 * DULU berkas ini memuat `WorkspaceScaffold`, kerangka halaman berbar polos
 * yang dipakai hampir semua layar. Kerangka itu SUDAH DIHAPUS: seluruh layar
 * kini memakai `layar-gradasi.tsx`, dan mempertahankan dua kerangka adalah
 * persis penyebab header bergradasi yang sudah disetujui tidak pernah sampai
 * ke sebagian layar.
 *
 * Ikut terhapus karena tidak ada lagi yang memakainya: `WorkspaceSection`,
 * `SquircleIcon`, `LaunchpadItem`, `MiniStat`, `IndikatorPenyimpanan`, dan
 * `paddingIsiWorkspace`. Semuanya masih ada di riwayat git bila suatu saat
 * dibutuhkan lagi.
 */
import type { ComponentType } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { LucideProps } from 'lucide-react-native';
import { Berat, GlassPanel, Radius, Spasi, Teks, UkuranIkon, useTheme } from '@/components';

export type Ikon = ComponentType<LucideProps>;

/**
 * Statistik kompak: label kecil beserta ikonnya di atas, angka tebal di bawah.
 * Dipakai berdampingan dua-dua di layar Riwayat dan Cadangan.
 *
 * `bahaya` mengubah angka DAN ikon ke rumpun Rose — dipakai untuk hitungan
 * yang menuntut tindakan (antrean belum terkirim, laporan ditolak), bukan
 * sekadar angka besar.
 */
export function CompactStat({
  label,
  nilai,
  ikon: IkonStat,
  bahaya = false,
  style,
}: {
  label: string;
  nilai: string;
  ikon: Ikon;
  bahaya?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const warna = bahaya ? colors.destructive : colors.foreground;
  return (
    <GlassPanel padding={0} style={{ ...styles.panel, ...style }}>
      <View style={styles.baris}>
        <IkonStat
          size={UkuranIkon.kecil}
          color={bahaya ? colors.destructive : colors.mutedForeground}
        />
        <Text numberOfLines={1} style={[styles.label, { color: colors.mutedForeground }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.nilai, { color: warna }]}>{nilai}</Text>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    paddingHorizontal: Spasi.md,
    paddingVertical: Spasi.md,
    borderRadius: Radius.kartu,
  },
  baris: { flexDirection: 'row', alignItems: 'center', gap: Spasi.xs + 2 },
  label: { flex: 1, fontSize: Teks.xs },
  nilai: { fontSize: Teks.xl2, fontWeight: Berat.tebal, marginTop: Spasi.xs },
});
