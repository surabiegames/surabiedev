/**
 * workspace.tsx — kerangka & kepingan UI ruang kerja petugas. Padanan
 * `features/staff/dashboard/workspace_widgets.dart`.
 *
 * Dipakai bersama oleh ruang kerja Pencatat Meter dan Petugas Gangguan
 * supaya keduanya terasa satu aplikasi, bukan dua yang ditempel.
 */
import type { ComponentType, ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, RotateCw, type LucideProps } from 'lucide-react-native';
import { formatUkuranByte } from '@workspace/mobile-core';
import { GlassPanel, PremiumBackground, useTheme } from '@/components';

export type Ikon = ComponentType<LucideProps>;

// ── Kerangka halaman ───────────────────────────────────────────────────

/**
 * Kerangka ruang kerja: latar premium, bar atas ramping (kembali · judul ·
 * segarkan), konten di tengah maks 560 (nyaman juga di tablet).
 *
 * `onSegarkan` dipasang ke tombol DAN pull-to-refresh. Di lapangan tarik-ke-
 * bawah jauh lebih sering dipakai daripada menemukan tombol kecil di pojok.
 */
export function WorkspaceScaffold({
  judul,
  subjudul,
  children,
  onBack,
  onSegarkan,
  sedangMuat = false,
}: {
  judul: string;
  subjudul: string;
  children: ReactNode;
  onBack?: () => void;
  onSegarkan?: () => void;
  sedangMuat?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <PremiumBackground>
      <View style={[styles.kolom, { paddingTop: insets.top }]}>
        <View style={styles.barAtas}>
          {onBack ? (
            <Pressable
              hitSlop={10}
              onPress={onBack}
              style={({ pressed }) => [styles.tombolIkon, pressed && styles.ditekan]}
            >
              <ChevronLeft size={22} color={colors.systemBlue} />
            </Pressable>
          ) : (
            <View style={styles.spasiKiri} />
          )}
          <View style={styles.judulWrap}>
            <Text numberOfLines={1} style={[styles.judul, { color: colors.foreground }]}>
              {judul}
            </Text>
            <Text numberOfLines={1} style={[styles.subjudul, { color: colors.mutedForeground }]}>
              {subjudul}
            </Text>
          </View>
          {onSegarkan ? (
            <Pressable
              hitSlop={10}
              onPress={onSegarkan}
              style={({ pressed }) => [styles.tombolIkon, pressed && styles.ditekan]}
            >
              <RotateCw size={17} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.areaIsi}>
          <ScrollView
            style={styles.batasLebar}
            contentContainerStyle={[styles.isi, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onSegarkan ? (
                <RefreshControl
                  refreshing={sedangMuat}
                  onRefresh={onSegarkan}
                  tintColor={colors.mutedForeground}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </PremiumBackground>
  );
}

/** Judul seksi kecil (huruf kapital berjarak). */
export function WorkspaceSection({ judul, aksi }: { judul: string; aksi?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.seksi}>
      <Text style={[styles.seksiJudul, { color: colors.mutedForeground }]}>
        {judul.toUpperCase()}
      </Text>
      {aksi}
    </View>
  );
}

// ── Ikon squircle bergradasi ───────────────────────────────────────────

/** Ikon squircle bergradasi ala macOS — penanda visual tiap aplikasi kerja. */
export function SquircleIcon({
  ikon: Ikon,
  gradasi,
  ukuran = 56,
}: {
  ikon: Ikon;
  gradasi: readonly [string, string];
  ukuran?: number;
}) {
  return (
    <LinearGradient
      colors={gradasi}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.squircle,
        { width: ukuran, height: ukuran, borderRadius: ukuran * 0.29 },
      ]}
    >
      <Ikon size={ukuran * 0.46} color="#FFFFFF" strokeWidth={2.2} />
    </LinearGradient>
  );
}

// ── Launchpad ──────────────────────────────────────────────────────────

/** Satu pintasan aplikasi kerja di grid Launchpad. */
export function LaunchpadItem({
  ikon,
  label,
  gradasi,
  badge,
  onPress,
}: {
  ikon: Ikon;
  label: string;
  gradasi: readonly [string, string];
  /** Angka kecil di pojok ikon (mis. jumlah antrean). */
  badge?: string | null;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.launchpad, pressed && styles.ditekan]}
    >
      <View>
        <SquircleIcon ikon={ikon} gradasi={gradasi} ukuran={54} />
        {badge != null && badge.length > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
            <Text style={styles.badgeTeks} numberOfLines={1}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={[styles.launchpadLabel, { color: colors.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Statistik kompak ───────────────────────────────────────────────────

export function CompactStat({
  label,
  nilai,
  ikon: Ikon,
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
    <GlassPanel padding={0} style={{ ...styles.statPanel, ...style }}>
      <View style={styles.statBaris}>
        <Ikon size={13} color={bahaya ? colors.destructive : colors.mutedForeground} />
        <Text numberOfLines={1} style={[styles.statLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.statNilai, { color: warna }]}>{nilai}</Text>
    </GlassPanel>
  );
}

/** Pil kecil (ikon + label) untuk chip ringkasan di kartu portal. */
export function MiniStat({
  ikon: Ikon,
  label,
  bahaya = false,
}: {
  ikon: Ikon;
  label: string;
  bahaya?: boolean;
}) {
  const { colors } = useTheme();
  const warna = bahaya ? colors.destructive : colors.mutedForeground;
  return (
    <View style={[styles.pil, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Ikon size={11.5} color={warna} />
      <Text style={[styles.pilTeks, { color: warna, fontWeight: bahaya ? '600' : '400' }]}>
        {label}
      </Text>
    </View>
  );
}

// ── Indikator penyimpanan ──────────────────────────────────────────────

/**
 * Padanan bar "sisa memori" dashboard Aurora, difokuskan ulang ke risiko
 * lapangan yang sebenarnya: berapa banyak hasil catat (beserta foto bukti)
 * menumpuk BELUM terunggah, dan berapa besar berkasnya di perangkat.
 *
 * Aurora memperingatkan saat catatan belum-upload melewati 500; ambang yang
 * sedikit lebih awal dipakai di sini supaya peringatannya masih sempat
 * ditindaklanjuti sebelum petugas kehabisan ruang.
 */
const AMBANG_PERHATIAN = 400;

export function IndikatorPenyimpanan({
  jumlahAntrean,
  totalByteFoto,
  ikonAman: IkonAman,
  ikonAntre: IkonAntre,
  ikonBahaya: IkonBahaya,
}: {
  jumlahAntrean: number;
  totalByteFoto: number;
  ikonAman: Ikon;
  ikonAntre: Ikon;
  ikonBahaya: Ikon;
}) {
  const { colors } = useTheme();
  const aman = jumlahAntrean === 0;
  const perhatian = jumlahAntrean >= AMBANG_PERHATIAN;
  const warna = perhatian ? colors.destructive : aman ? colors.success : colors.foreground;
  const Ikon = perhatian ? IkonBahaya : aman ? IkonAman : IkonAntre;

  const judul = aman
    ? 'Penyimpanan aman'
    : perhatian
      ? 'Segera upload — antrean menumpuk'
      : 'Antrean menunggu upload';
  const rincian = aman
    ? 'Tidak ada hasil catat yang menunggu diunggah.'
    : `${jumlahAntrean} laporan · ${formatUkuranByte(totalByteFoto)} foto bukti tersimpan di perangkat.`;

  return (
    <GlassPanel padding={0} style={styles.indikator}>
      <Ikon size={22} color={warna} />
      <View style={styles.indikatorTeks}>
        <Text style={[styles.indikatorJudul, { color: warna }]}>{judul}</Text>
        <Text style={[styles.indikatorRincian, { color: colors.mutedForeground }]}>{rincian}</Text>
      </View>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  kolom: { flex: 1 },
  barAtas: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  tombolIkon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  spasiKiri: { width: 10 },
  ditekan: { opacity: 0.55 },
  judulWrap: { flex: 1, paddingLeft: 2 },
  judul: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  subjudul: { fontSize: 11.5, marginTop: 1 },

  areaIsi: { flex: 1, alignItems: 'center' },
  batasLebar: { flex: 1, width: '100%', maxWidth: 560 },
  isi: { paddingHorizontal: 20, paddingTop: 8 },

  seksi: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 10,
    gap: 8,
  },
  seksiJudul: { flex: 1, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2 },

  squircle: { alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' },

  launchpad: { width: '33.333%', alignItems: 'center', gap: 8, paddingVertical: 4 },
  launchpadLabel: { fontSize: 11.5, fontWeight: '500' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTeks: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },

  statPanel: { paddingHorizontal: 12, paddingVertical: 10, flex: 1 },
  statBaris: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statLabel: { flex: 1, fontSize: 10.5 },
  statNilai: { fontSize: 19, fontWeight: '700', marginTop: 5 },

  pil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pilTeks: { fontSize: 11 },

  indikator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  indikatorTeks: { flex: 1 },
  indikatorJudul: { fontSize: 13, fontWeight: '600' },
  indikatorRincian: { fontSize: 11.5, marginTop: 2 },
});
