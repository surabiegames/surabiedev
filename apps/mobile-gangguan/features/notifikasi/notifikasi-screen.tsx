/**
 * notifikasi-screen.tsx — inbox notifikasi petugas. Padanan
 * `features/staff/notifikasi/notifikasi_screen.dart`.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BellOff, CheckCheck, TriangleAlert } from 'lucide-react-native';
import { ApiException, formatWaktuLokal } from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Text as UIText } from '@/components/ui/text';
import {
  Radius,
  Berat,
  GlassPanel,
  Kelas,
  MasterPalette as P,
  Spasi,
  Teks,
  TinggiBaris,
  UkuranIkon,
  useTheme,
} from '@/components';
import { WorkspaceScaffold } from '@/features/petugas/workspace';
import { daftarNotifikasi, tandaiDibaca, tandaiSemuaDibaca, type Notifikasi } from './repository';

export function NotifikasiScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [daftar, setDaftar] = useState<Notifikasi[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      setDaftar(await daftarNotifikasi());
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal memuat notifikasi.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const belumDibaca = daftar.filter((n) => !n.dibaca).length;

  const bacaSemua = async () => {
    try {
      await tandaiSemuaDibaca();
      await muat();
    } catch {
      setGalat('Gagal menandai terbaca — coba lagi saat sinyal membaik.');
    }
  };

  const buka = async (n: Notifikasi) => {
    if (n.dibaca) return;
    // Optimistis: tandai di layar dulu supaya ketukan terasa langsung, lalu
    // beri tahu server. Gagal di jaringan hanya berarti tanda itu kembali
    // saat daftar dimuat ulang — tidak ada data yang hilang.
    setDaftar((d) => d.map((x) => (x.id === n.id ? { ...x, dibaca: true } : x)));
    try {
      await tandaiDibaca(n.id);
    } catch {
      // biarkan; pemuatan berikutnya mengembalikan keadaan sebenarnya.
    }
  };

  return (
    <WorkspaceScaffold
      judul="Notifikasi"
      subjudul={belumDibaca > 0 ? `${belumDibaca} belum dibaca` : 'Semua sudah dibaca'}
      onBack={onBack}
      onSegarkan={() => void muat()}
      sedangMuat={memuat}
    >
      {galat != null ? (
        <View style={styles.jarak}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Gagal memuat</AlertTitle>
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      {belumDibaca > 0 ? (
        <Button variant="outline" onPress={bacaSemua} className="mb-3 w-full">
          <CheckCheck size={UkuranIkon.kecil} color={colors.foreground} />
          <UIText>Tandai semua terbaca</UIText>
        </Button>
      ) : null}

      {memuat && daftar.length === 0 ? (
        <View style={styles.tengah}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : daftar.length === 0 ? (
        <View style={styles.kosong}>
          <BellOff size={UkuranIkon.kosong} color={colors.mutedForeground} />
          <Text style={[styles.kosongTeks, { color: colors.mutedForeground }]}>
            Belum ada notifikasi.
          </Text>
        </View>
      ) : (
        daftar.map((n) => (
          <GlassPanel key={n.id} padding={14} onPress={() => void buka(n)} style={styles.baris}>
            <View style={styles.barisAtas}>
              {!n.dibaca ? <View style={[styles.titik, { backgroundColor: P.emerald600 }]} /> : null}
              <Text style={[styles.judul, { color: colors.foreground }]}>{n.judul}</Text>
            </View>
            <Text style={[styles.isi, { color: colors.mutedForeground }]}>{n.isi}</Text>
            {n.createdAt != null ? (
              <Text style={[styles.waktu, { color: colors.mutedForeground }]}>
                {formatWaktuLokal(n.createdAt)}
              </Text>
            ) : null}
          </GlassPanel>
        ))
      )}
    </WorkspaceScaffold>
  );
}

const styles = StyleSheet.create({
  jarak: { marginBottom: Spasi.md },
  tengah: { paddingVertical: 48, alignItems: 'center' },
  kosong: { paddingVertical: 44, alignItems: 'center', gap: Spasi.md },
  kosongTeks: { fontSize: Teks.xs },
  baris: { marginBottom: Spasi.sm },
  barisAtas: { flexDirection: 'row', alignItems: 'center', gap: Spasi.sm },
  titik: { width: 7, height: 7, borderRadius: Radius.kontrol },
  judul: { flex: 1, fontSize: Teks.sm, fontWeight: '600' },
  isi: { fontSize: Teks.xs, marginTop: Spasi.sm, lineHeight: TinggiBaris.xs },
  waktu: { fontSize: Teks.xs, marginTop: Spasi.sm },
});
