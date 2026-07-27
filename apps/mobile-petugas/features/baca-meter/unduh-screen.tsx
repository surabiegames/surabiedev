/**
 * unduh-screen.tsx — Download Data: tarik paket rute + master tarif ke
 * perangkat untuk kerja offline. Padanan `download_data_screen.dart`
 * (`DownloadDataActivity` Aurora).
 *
 * Unduhan MENGGANTI paket rute yang tersimpan — itu memang tujuannya, karena
 * unduhan baru adalah kebenaran baru. Yang TIDAK pernah ikut terhapus adalah
 * ANTREAN KIRIM: itu hasil kerja petugas yang belum sampai server, dan
 * membuangnya karena seseorang menekan "unduh" tidak bisa diterima. Konfirmasi
 * di layar ini menyatakan itu secara eksplisit.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  CheckCircle2,
  CloudDownload,
  Database,
  Map as MapIcon,
  Receipt,
  TriangleAlert,
  Upload,
} from 'lucide-react-native';
import {
  ApiException,
  formatWaktuLokal,
  labelPeriode,
  type RuteSaya,
} from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Text as UIText } from '@/components/ui/text';
import { GlassPanel, useTheme } from '@/components';
import { DialogKonfirmasi } from '@/features/petugas/dialog-konfirmasi';
import { WorkspaceScaffold, type Ikon } from '@/features/petugas/workspace';
import { jumlahTertunda, periodeCatatSekarang, ruteSaya } from './repository';
import { semuaTarif, unduhTarif } from './tarif';

export function UnduhDataScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [paket, setPaket] = useState<RuteSaya | null>(null);
  const [jumlahTarif, setJumlahTarif] = useState(0);
  const [tertunda, setTertunda] = useState(0);
  const [mengunduh, setMengunduh] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [hasil, setHasil] = useState<string | null>(null);
  const [tanyaGanti, setTanyaGanti] = useState(false);

  /**
   * Keadaan data lokal saat ini TANPA memaksa unduh, supaya layar tetap
   * informatif saat offline. Jumlah tarif dimuat terpisah: ia menyentuh cache
   * yang bisa lambat, dan tidak boleh menahan seluruh layar di balik spinner.
   */
  const muatKeadaan = useCallback(async () => {
    try {
      setPaket(await ruteSaya({ segarkan: false }));
      setTertunda(await jumlahTertunda());
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal membaca data lokal.');
    }
    try {
      setJumlahTarif((await semuaTarif()).size);
    } catch {
      // biarkan 0 — estimasi bukan inti layar ini.
    }
  }, []);

  useEffect(() => {
    void muatKeadaan();
  }, [muatKeadaan]);

  const unduh = async () => {
    setTanyaGanti(false);
    setMengunduh(true);
    setGalat(null);
    setHasil(null);
    try {
      // Rute dulu (inti kerja), master tarif menyusul (pelengkap estimasi).
      // Tarif yang gagal TIDAK menggagalkan unduhan rute.
      const baru = await ruteSaya({ segarkan: true });
      let tarif = jumlahTarif;
      try {
        tarif = await unduhTarif();
      } catch {
        // estimasi tetap memakai cache lama — bukan penghalang.
      }
      setPaket(baru);
      setJumlahTarif(tarif);
      setHasil(
        baru.ruteKode == null
          ? 'Akun Anda belum ditugaskan rute — penugasan diatur admin di dashboard web (menu Pemetaan Rute). Hubungi admin, lalu unduh lagi.'
          : `Berhasil: ${baru.target} pelanggan ${
              baru.rutes.length > 1 ? `(${baru.rutes.length} rute)` : `rute ${baru.ruteKode}`
            }${tarif > 0 ? ` + ${tarif} golongan tarif` : ''} siap dipakai offline.`,
      );
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal mengunduh.');
    } finally {
      setMengunduh(false);
    }
  };

  const adaRute = paket?.ruteKode != null;

  return (
    <WorkspaceScaffold
      judul="Download Data"
      subjudul="Unduh rute & master tarif untuk kerja offline"
      onBack={onBack}
    >
      <GlassPanel padding={0} style={styles.kartu}>
        <BarisData
          ikon={MapIcon}
          judul="Paket rute"
          nilai={
            adaRute
              ? `${paket?.target ?? 0} pelanggan · ${paket?.rutes.length ?? 0} rute`
              : 'Belum diunduh'
          }
          keterangan={
            paket?.diunduhPada != null
              ? `Terunduh ${formatWaktuLokal(paket.diunduhPada)}`
              : 'Rute dipakai untuk bekerja tanpa sinyal.'
          }
        />
        <Pemisah />
        <BarisData
          ikon={Receipt}
          judul="Master tarif"
          nilai={jumlahTarif > 0 ? `${jumlahTarif} golongan` : 'Belum diunduh'}
          keterangan="Dasar estimasi tagihan saat pelanggan bertanya di lokasi."
        />
        <Pemisah />
        <BarisData
          ikon={Upload}
          judul="Menunggu upload"
          nilai={`${tertunda} laporan`}
          keterangan={
            tertunda > 0
              ? 'Tidak akan hilang saat mengunduh ulang — tapi sebaiknya kirim dulu.'
              : 'Semua hasil catat sudah terkirim.'
          }
          bahaya={tertunda > 0}
        />
        <Pemisah />
        <BarisData
          ikon={Database}
          judul="Periode kerja"
          nilai={labelPeriode(paket?.periode ?? periodeCatatSekarang())}
          keterangan="Bulan berjalan — pencatatan lapangan selalu merekam bulan ini."
        />
      </GlassPanel>

      {hasil != null ? (
        <View style={styles.jarak}>
          <Alert icon={CheckCircle2}>
            <AlertTitle>Selesai</AlertTitle>
            <AlertDescription>{hasil}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      {galat != null ? (
        <View style={styles.jarak}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Gagal mengunduh</AlertTitle>
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      <Button
        onPress={() => (adaRute ? setTanyaGanti(true) : void unduh())}
        disabled={mengunduh}
        className="mt-4 h-12 w-full"
      >
        {mengunduh ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <CloudDownload size={16} color={colors.primaryForeground} />
        )}
        <UIText>{mengunduh ? 'Mengunduh…' : adaRute ? 'Unduh Ulang' : 'Unduh Data'}</UIText>
      </Button>

      <Text style={[styles.catatan, { color: colors.mutedForeground }]}>
        Unduh saat masih ada sinyal bagus — di lapangan aplikasi bekerja penuh dari data ini.
      </Text>

      <DialogKonfirmasi
        visible={tanyaGanti}
        judul="Unduh Ulang Data?"
        deskripsi={
          'Data rute yang tersimpan akan diganti dengan yang terbaru dari server.' +
          (tertunda > 0
            ? `\n\n${tertunda} hasil catat yang belum terkirim TIDAK akan hilang — tapi kirim dulu lewat Upload Data bila ragu.`
            : '')
        }
        labelKonfirmasi="Unduh"
        onTutup={() => setTanyaGanti(false)}
        onKonfirmasi={unduh}
      />
    </WorkspaceScaffold>
  );
}

function BarisData({
  ikon: IkonBaris,
  judul,
  nilai,
  keterangan,
  bahaya = false,
}: {
  ikon: Ikon;
  judul: string;
  nilai: string;
  keterangan: string;
  bahaya?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.baris}>
      <IkonBaris size={18} color={bahaya ? colors.destructive : colors.mutedForeground} />
      <View style={styles.barisTeks}>
        <Text style={[styles.barisJudul, { color: colors.mutedForeground }]}>{judul}</Text>
        <Text style={[styles.barisNilai, { color: bahaya ? colors.destructive : colors.foreground }]}>
          {nilai}
        </Text>
        <Text style={[styles.barisKeterangan, { color: colors.mutedForeground }]}>
          {keterangan}
        </Text>
      </View>
    </View>
  );
}

function Pemisah() {
  const { colors } = useTheme();
  return <View style={[styles.pemisah, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  kartu: { paddingVertical: 4 },
  baris: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  barisTeks: { flex: 1 },
  barisJudul: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  barisNilai: { fontSize: 15, fontWeight: '600', marginTop: 3 },
  barisKeterangan: { fontSize: 11.5, marginTop: 3, lineHeight: 17 },
  pemisah: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  jarak: { marginTop: 14 },
  catatan: { fontSize: 11.5, textAlign: 'center', marginTop: 12, lineHeight: 17 },
});
