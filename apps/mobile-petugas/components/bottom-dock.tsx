/**
 * bottom-dock.tsx — dock bawah aplikasi Pencatat Meter.
 *
 * Varian yang disetujui: **G2** (mengambang bersudut) + **B1** (tombol Scan
 * bulat timbul bergradasi). Isinya **D1 versi revisi**:
 *
 *   Beranda · Rute · [Scan] · Download · Upload
 *
 * Download dan Upload sengaja BERDAMPINGAN — permintaan eksplisit, dan
 * kebetulan masuk akal: keduanya urusan sinkronisasi data, jadi berada di sisi
 * yang sama membuat dock terbaca sebagai dua kelompok (kerja | data).
 *
 * TOMBOL SCAN BUKAN TAB. Ia tidak punya layar yang ditinggali — ia mendorong
 * `/scan` ke atas tumpukan lalu kembali. Karena itu `onScan` terpisah dari
 * `onTap`, dan indeks tab tidak pernah menunjuk ke sana.
 *
 * ATURAN TANPA AKSI GANDA. Empat tujuan di dock ini TIDAK BOLEH muncul lagi
 * sebagai ubin di beranda. Kalau suatu saat ada yang menambahkannya kembali,
 * itu regresi — bukan kemudahan.
 *
 * Murni presentational: tidak tahu apa pun soal layar tujuan. Adapter di
 * `app/(tabs)/_layout.tsx` yang memetakan state navigasi ke props ini.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScanLine, type LucideProps } from 'lucide-react-native';

import { useTheme } from './theme/theme-context';
import { MasterPalette as P } from './theme/palette';
import { Berat, Radius, Spasi } from './theme/ukuran';

export interface DockItem {
  ikon: React.ComponentType<LucideProps>;
  label: string;
  /** Angka kecil di pojok ikon (mis. jumlah antrean menunggu upload). */
  lencana?: string | null;
}

export interface BottomDockProps {
  items: DockItem[];
  currentIndex: number;
  onTap: (index: number) => void;
  onScan: () => void;
}

/** Sisipkan tombol scan setelah item ke-`TENGAH`. */
const TENGAH = 2;

export function BottomDock({ items, currentIndex, onTap, onScan }: BottomDockProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const kiri = items.slice(0, TENGAH);
  const kanan = items.slice(TENGAH);

  return (
    <View
      style={[styles.luar, { paddingBottom: insets.bottom + Spasi.md }]}
      pointerEvents="box-none"
    >
      <View style={[styles.dock, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {kiri.map((it, i) => (
          <Tab
            key={it.label}
            item={it}
            aktif={currentIndex === i}
            onPress={() => onTap(i)}
          />
        ))}

        <View style={styles.slotScan}>
          <Pressable
            onPress={onScan}
            accessibilityRole="button"
            accessibilityLabel="Scan kode pelanggan"
            style={({ pressed }) => [styles.scanTekan, pressed && styles.ditekan]}
          >
            <LinearGradient
              colors={[P.emerald, P.sky600]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.bulat, { borderColor: colors.card }]}
            >
              <ScanLine size={26} color="#FFFFFF" strokeWidth={2.1} />
            </LinearGradient>
            <Text style={[styles.scanLabel, { color: colors.primary }]}>Scan</Text>
          </Pressable>
        </View>

        {kanan.map((it, i) => (
          <Tab
            key={it.label}
            item={it}
            aktif={currentIndex === i + TENGAH}
            onPress={() => onTap(i + TENGAH)}
          />
        ))}
      </View>
    </View>
  );
}

function Tab({
  item,
  aktif,
  onPress,
}: {
  item: DockItem;
  aktif: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const Ikon = item.ikon;
  const warna = aktif ? colors.primary : colors.mutedForeground;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: aktif }}
      accessibilityLabel={item.label}
      style={({ pressed }) => [styles.tab, pressed && styles.ditekan]}
    >
      <View>
        <Ikon size={22} color={warna} />
        {item.lencana != null && item.lencana.length > 0 ? (
          <View style={[styles.lencana, { backgroundColor: colors.destructive }]}>
            <Text style={styles.lencanaTeks} numberOfLines={1}>
              {item.lencana}
            </Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={[styles.tabLabel, { color: warna, fontWeight: aktif ? Berat.semi : Berat.medium }]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  luar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spasi.md },
  dock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: Spasi.sm,
    paddingTop: Spasi.sm,
    paddingBottom: Spasi.md - 2,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: '0px 6px 20px rgba(15, 23, 42, 0.12)',
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: Spasi.xs },
  tabLabel: { fontSize: 10 },
  ditekan: { opacity: 0.6 },

  slotScan: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  scanTekan: { alignItems: 'center', gap: 3 },
  // marginTop negatif = tombol menyembul di atas garis dock. Cincin setebal 3
  // berwarna `card` memisahkannya dari dock di belakangnya.
  bulat: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    boxShadow: '0px 6px 16px rgba(2, 132, 199, 0.34)',
  },
  scanLabel: { fontSize: 10, fontWeight: Berat.semi },

  lencana: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: Radius.bundar,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lencanaTeks: { color: '#FFFFFF', fontSize: 9, fontWeight: Berat.tebal },
});
