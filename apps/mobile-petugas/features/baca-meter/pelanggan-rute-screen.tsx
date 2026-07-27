/**
 * pelanggan-rute-screen.tsx — daftar pelanggan SATU rute yang sedang
 * dikerjakan. Padanan `pelanggan_rute_screen.dart` (pola
 * `daftarPelangganUnRead/Read` Aurora).
 *
 * Urut nomor urut rute, tab Belum/Sudah dibaca, dan pencarian — semuanya
 * dibatasi ke rute ini. Data dibaca dari CACHE LOKAL (rutenya sudah diunduh
 * di layar sebelumnya), jadi ringan dan jalan penuh tanpa sinyal.
 *
 * Daftar tab aktif juga menjadi URUTAN KUNJUNGAN untuk tombol
 * sebelumnya/berikutnya di layar catat — itu sebabnya urutannya tidak boleh
 * diacak oleh pencarian.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CheckCircle2, ChevronRight, Search } from 'lucide-react-native';
import { labelPeriode, type PelangganRute, type RuteSaya } from '@workspace/mobile-core';
import { Input } from '@/components/ui/input';
import { GlassPanel, MasterPalette as P, useTheme } from '@/components';
import { WorkspaceScaffold } from '@/features/petugas/workspace';
import { BarProgres } from './daftar-rute-screen';
import { periodeCatatSekarang, ruteSaya } from './repository';

export function PelangganRuteScreen({
  kodeRute,
  onBack,
  onBukaCatat,
}: {
  kodeRute: string;
  onBack: () => void;
  onBukaCatat: (nomorLangganan: string) => void;
}) {
  const { colors } = useTheme();
  const [paket, setPaket] = useState<RuteSaya | null>(null);
  const [kunci, setKunci] = useState('');
  const [tabSudah, setTabSudah] = useState(false);

  // Cache saja: rutenya sudah diunduh di layar sebelumnya, dan mencatat
  // memperbarui DAO sehingga statusnya langsung tampak di sini.
  const muat = useCallback(async () => {
    setPaket(await ruteSaya({ segarkan: false }).catch(() => null));
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat]),
  );

  const pelangganRute = useMemo(
    () => (paket?.pelanggan ?? []).filter((p) => p.ruteKode === kodeRute),
    [paket, kodeRute],
  );

  const target = pelangganRute.length;
  const terbaca = pelangganRute.filter((p) => p.sudahDicatat).length;

  /** Daftar tab aktif — juga urutan kunjungan untuk tombol berikutnya. */
  const daftarTab = useMemo(
    () => pelangganRute.filter((p) => p.sudahDicatat === tabSudah),
    [pelangganRute, tabSudah],
  );

  const tersaring = useMemo(() => {
    const k = kunci.trim().toLowerCase();
    if (k.length === 0) return daftarTab;
    return daftarTab.filter(
      (p) =>
        p.nomorLangganan.includes(k) ||
        p.nama.toLowerCase().includes(k) ||
        (p.alamat ?? '').toLowerCase().includes(k),
    );
  }, [daftarTab, kunci]);

  const seksi = paket?.rutes.find((r) => r.kode === kodeRute)?.seksiCater;
  const periode = paket?.periode ?? periodeCatatSekarang();

  return (
    <WorkspaceScaffold
      judul={`Rute ${kodeRute}`}
      subjudul={`${seksi ?? 'Rute pencatatan'} · ${labelPeriode(periode)}`}
      onBack={onBack}
    >
      {paket == null ? (
        <View style={styles.tengah}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          <GlassPanel padding={14}>
            <View style={styles.progresBaris}>
              <Text style={[styles.progresLabel, { color: colors.foreground }]}>Progres rute</Text>
              <Text style={[styles.progresAngka, { color: colors.mutedForeground }]}>
                {terbaca} dari {target} dibaca
              </Text>
            </View>
            <BarProgres rasio={target === 0 ? 0 : terbaca / target} />
          </GlassPanel>

          <View style={styles.cari}>
            <Input
              value={kunci}
              onChangeText={setKunci}
              placeholder="Cari nomor langganan / nama / alamat…"
              autoCapitalize="none"
              className="pl-10"
            />
            <View style={styles.ikonCari}>
              <Search size={16} color={colors.mutedForeground} />
            </View>
          </View>

          <View style={styles.tabBaris}>
            <TombolTab
              label={`Belum dibaca (${target - terbaca})`}
              aktif={!tabSudah}
              onPress={() => setTabSudah(false)}
            />
            <TombolTab
              label={`Sudah dibaca (${terbaca})`}
              aktif={tabSudah}
              onPress={() => setTabSudah(true)}
            />
          </View>

          {tersaring.length === 0 ? (
            <Text style={[styles.kosong, { color: colors.mutedForeground }]}>
              {kunci.trim().length > 0
                ? 'Tidak ada yang cocok dengan pencarian Anda.'
                : tabSudah
                  ? 'Belum ada pelanggan yang dicatat di rute ini.'
                  : 'Seluruh pelanggan rute ini sudah dibaca. Kerja bagus!'}
            </Text>
          ) : (
            <FlatList
              data={tersaring}
              scrollEnabled={false}
              keyExtractor={(p) => p.nomorLangganan}
              renderItem={({ item }) => (
                <BarisPelanggan
                  pelanggan={item}
                  onPress={() => onBukaCatat(item.nomorLangganan)}
                />
              )}
            />
          )}
        </>
      )}
    </WorkspaceScaffold>
  );
}

function TombolTab({
  label,
  aktif,
  onPress,
}: {
  label: string;
  aktif: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        {
          backgroundColor: aktif ? colors.primary : colors.muted,
          borderColor: aktif ? colors.primary : colors.border,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text
        style={[styles.tabTeks, { color: aktif ? colors.primaryForeground : colors.foreground }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BarisPelanggan({
  pelanggan,
  onPress,
}: {
  pelanggan: PelangganRute;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <GlassPanel padding={0} onPress={onPress} style={styles.baris}>
      <View style={[styles.urut, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Text style={[styles.urutTeks, { color: colors.foreground }]}>
          {pelanggan.urutan ?? '-'}
        </Text>
      </View>
      <View style={styles.barisTeks}>
        <Text numberOfLines={1} style={[styles.barisNama, { color: colors.foreground }]}>
          {pelanggan.nama}
        </Text>
        <Text numberOfLines={1} style={[styles.barisRincian, { color: colors.mutedForeground }]}>
          {pelanggan.nomorLangganan}
          {pelanggan.alamat != null ? ` · ${pelanggan.alamat}` : ''}
        </Text>
      </View>
      {pelanggan.standLalu != null ? (
        <Text style={[styles.barisStand, { color: colors.mutedForeground }]}>
          Lalu {pelanggan.standLalu}
        </Text>
      ) : null}
      {pelanggan.sudahDicatat ? (
        <CheckCircle2 size={16} color={P.emerald600} />
      ) : (
        <ChevronRight size={15} color={colors.mutedForeground} />
      )}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  tengah: { paddingVertical: 48, alignItems: 'center' },
  progresBaris: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progresLabel: { fontSize: 13, fontWeight: '500' },
  progresAngka: { fontSize: 11.5 },

  cari: { marginTop: 12, justifyContent: 'center' },
  ikonCari: { position: 'absolute', left: 12 },

  tabBaris: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 10 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  tabTeks: { fontSize: 12, fontWeight: '600' },

  kosong: { fontSize: 12.5, textAlign: 'center', paddingVertical: 32, lineHeight: 19 },

  baris: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 8,
  },
  urut: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  urutTeks: { fontSize: 12, fontWeight: '700' },
  barisTeks: { flex: 1 },
  barisNama: { fontSize: 13, fontWeight: '500' },
  barisRincian: { fontSize: 11, marginTop: 1 },
  barisStand: { fontSize: 11 },
});
