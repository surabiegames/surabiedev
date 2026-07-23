/**
 * kelola-langganan-screen.tsx — Kelola nomor langganan tertaut akun (padanan
 * kelola_langganan_screen.dart): lihat semua, tambah (maks 5, dibatasi server),
 * jadikan utama, lepas tautan. Setiap mutasi menyegarkan LanggananSayaCache
 * supaya beranda ikut terbarui.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Alert,
  AppScaffold,
  Badge,
  Button,
  Card,
  Dialog,
  MasterPalette as P,
  SectionHeader,
  StatusBadge,
  TextField,
  useTheme,
} from '@workspace/mobile-ui';
import { ApiException, formatRupiah, labelStatusPelanggan } from '@workspace/mobile-core';

import { PratinjauPelanggan } from './pratinjau-pelanggan';
import { buatLanggananWargaRepository, LanggananSayaCache, type LanggananWargaModel } from './repository';

export function KelolaLanggananScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [repo] = useState(buatLanggananWargaRepository);

  const [data, setData] = useState<LanggananWargaModel[] | null>(null);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [nomorBaru, setNomorBaru] = useState('');
  const [galatTambah, setGalatTambah] = useState<string | null>(null);
  const [menambah, setMenambah] = useState(false);
  const [idSibuk, setIdSibuk] = useState<string | null>(null);
  const [hapusTarget, setHapusTarget] = useState<LanggananWargaModel | null>(null);
  const [galatDialog, setGalatDialog] = useState<string | null>(null);

  const muat = async (paksa = false) => {
    setGalatMuat(null);
    try {
      setData(await LanggananSayaCache.muat(paksa));
    } catch (e) {
      setGalatMuat(ApiException.is(e) ? e.message : 'Gagal memuat.');
    }
  };

  useEffect(() => {
    void muat(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tambah = async () => {
    if (!/^\d{11}$/.test(nomorBaru)) {
      setGalatTambah('Nomor langganan harus 11 digit angka.');
      return;
    }
    setMenambah(true);
    setGalatTambah(null);
    try {
      await repo.tambah(nomorBaru);
      setNomorBaru('');
      await muat(true);
    } catch (e) {
      setGalatTambah(ApiException.is(e) ? e.message : 'Gagal menautkan.');
    } finally {
      setMenambah(false);
    }
  };

  const jadikanUtama = async (l: LanggananWargaModel) => {
    setIdSibuk(l.id);
    try {
      await repo.jadikanUtama(l.id);
      await muat(true);
    } catch (e) {
      setGalatDialog(ApiException.is(e) ? e.message : 'Gagal.');
    } finally {
      setIdSibuk(null);
    }
  };

  const hapus = async (l: LanggananWargaModel) => {
    setHapusTarget(null);
    setIdSibuk(l.id);
    try {
      await repo.hapus(l.id);
      await muat(true);
    } catch (e) {
      setGalatDialog(ApiException.is(e) ? e.message : 'Gagal.');
    } finally {
      setIdSibuk(null);
    }
  };

  return (
    <AppScaffold
      title="Nomor Langganan"
      subtitle="Kelola langganan tertaut akun Anda"
      onBack={() => router.back()}
      body={
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {galatMuat != null ? (
            <>
              <Alert variant="destructive" title="Gagal memuat" description={galatMuat} />
              <View style={styles.retry}>
                <Button variant="outline" onPress={() => muat()}>Coba lagi</Button>
              </View>
            </>
          ) : data == null ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <>
              <View style={styles.list}>
                {data.map((l) => (
                  <BarisLangganan
                    key={l.id}
                    langganan={l}
                    sibuk={idSibuk === l.id}
                    bisaHapus={data.length > 1}
                    onJadikanUtama={l.isUtama ? undefined : () => jadikanUtama(l)}
                    onHapus={() => setHapusTarget(l)}
                  />
                ))}
              </View>

              <SectionHeader judul="Tambah Nomor Langganan" />
              <Text style={[styles.penjelasan, { color: colors.mutedForeground }]}>
                Berlangganan lebih dari satu sambungan? Tautkan nomornya di sini supaya semuanya tampil di beranda.
              </Text>
              <View style={styles.tambahForm}>
                <TextField
                  value={nomorBaru}
                  onChangeText={(t) => {
                    setNomorBaru(t.replace(/\D/g, '').slice(0, 11));
                    setGalatTambah(null);
                  }}
                  placeholder="11 digit nomor langganan"
                  keyboardType="number-pad"
                  error={galatTambah}
                />
                <PratinjauPelanggan nomor={nomorBaru} />
                <Button
                  onPress={tambah}
                  loading={menambah}
                  disabled={nomorBaru.length !== 11}
                  leading={menambah ? undefined : <Ionicons name="add" size={18} color={colors.primaryForeground} />}
                >
                  {menambah ? 'Menautkan…' : 'Tautkan Nomor Ini'}
                </Button>
              </View>
            </>
          )}
        </ScrollView>
      }
    >
      <Dialog
        visible={hapusTarget != null}
        onDismiss={() => setHapusTarget(null)}
        title="Lepas Tautan Langganan?"
        description={
          hapusTarget != null
            ? `Nomor ${hapusTarget.nomorLangganan} (${hapusTarget.nama}) akan dilepas dari akun Anda. Data pelanggannya sendiri tidak berubah — Anda bisa menautkannya kembali kapan saja.`
            : ''
        }
        actions={
          <>
            <Button variant="destructive" onPress={() => hapusTarget && hapus(hapusTarget)}>Lepas Tautan</Button>
            <Button variant="outline" onPress={() => setHapusTarget(null)}>Batal</Button>
          </>
        }
      />
      <Dialog
        visible={galatDialog != null}
        onDismiss={() => setGalatDialog(null)}
        title="Gagal"
        description={galatDialog ?? ''}
        actions={<Button onPress={() => setGalatDialog(null)}>Tutup</Button>}
      />
    </AppScaffold>
  );
}

function BarisLangganan({
  langganan: l,
  sibuk,
  bisaHapus,
  onJadikanUtama,
  onHapus,
}: {
  langganan: LanggananWargaModel;
  sibuk: boolean;
  bisaHapus: boolean;
  onJadikanUtama?: () => void;
  onHapus: () => void;
}) {
  const { colors } = useTheme();
  const adaTunggakan = l.totalTunggakan > 0;
  return (
    <Card style={styles.baris}>
      <View style={styles.barisTop}>
        <View style={styles.barisInfo}>
          <View style={styles.namaRow}>
            <Text style={[styles.nama, { color: colors.foreground }]} numberOfLines={1}>{l.nama}</Text>
            {l.isUtama ? <Badge>Utama</Badge> : null}
          </View>
          <Text style={[styles.nomor, { color: colors.mutedForeground }]}>{l.nomorLangganan}</Text>
          <Text style={[styles.alamat, { color: colors.mutedForeground }]} numberOfLines={1}>{l.alamatLengkap}</Text>
        </View>
        <StatusBadge
          label={labelStatusPelanggan[l.status] ?? l.status}
          tone={l.status === 'AKTIF' ? 'success' : 'warning'}
        />
      </View>
      <View style={styles.barisBawah}>
        <Text
          style={[styles.tunggakan, { color: adaTunggakan ? P.rose600 : P.emerald600 }]}
          numberOfLines={2}
        >
          {adaTunggakan
            ? `Tunggakan ${formatRupiah(l.totalTunggakan)} (${l.jumlahTagihanBelumBayar} tagihan)`
            : 'Tidak ada tunggakan'}
        </Text>
        <View style={styles.barisAksi}>
          {onJadikanUtama != null ? (
            <Button variant="ghost" block={false} disabled={sibuk} onPress={onJadikanUtama}>Jadikan Utama</Button>
          ) : null}
          <Button variant="ghost" block={false} disabled={sibuk || !bisaHapus} onPress={onHapus}>
            {sibuk ? (
              <ActivityIndicator size="small" color={colors.destructive} />
            ) : (
              <Ionicons name="trash-outline" size={16} color={colors.destructive} />
            )}
          </Button>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 48 },
  retry: { marginTop: 12 },
  loading: { paddingVertical: 48, alignItems: 'center' },
  list: { gap: 10 },
  penjelasan: { fontSize: 13, lineHeight: 18 },
  tambahForm: { marginTop: 12, gap: 12 },
  baris: { padding: 14 },
  barisTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  barisInfo: { flex: 1 },
  namaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nama: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  nomor: { fontSize: 12.5, letterSpacing: 1.2, marginTop: 2 },
  alamat: { fontSize: 12, marginTop: 1 },
  barisBawah: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  tunggakan: { flex: 1, fontSize: 12, fontWeight: '600' },
  barisAksi: { flexDirection: 'row', alignItems: 'center' },
});
