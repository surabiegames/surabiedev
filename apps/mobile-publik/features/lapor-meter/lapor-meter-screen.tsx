/**
 * lapor-meter-screen.tsx — Lapor Meter Mandiri (publik). Padanan
 * features/public/lapor_meter/lapor_meter_screen.dart.
 *
 * Pelanggan memfoto & melaporkan angka meternya sendiri. Laporan masuk
 * berstatus MENUNGGU sampai petugas memverifikasi. Foto meter WAJIB (server
 * menolak 400 tanpanya). Ada dialog konfirmasi sebelum kirim — angka keliru
 * memengaruhi tagihan.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert, AppScaffold, Button, Dialog, PhotoBox, TextField, useTheme } from '@workspace/mobile-ui';
import { ApiException, labelPeriode, SesiWarga } from '@workspace/mobile-core';

import { LanggananSayaCache } from '../langganan/repository';
import { ambilFoto, MediaError, type SumberMedia } from '../shared/media';
import { buatLaporMeterRepository } from './repository';

export function LaporMeterScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [repo] = useState(buatLaporMeterRepository);

  const [nomorLangganan, setNomorLangganan] = useState(LanggananSayaCache.utama?.nomorLangganan ?? '');
  const [stand, setStand] = useState('');
  const [namaPelapor, setNamaPelapor] = useState(SesiWarga.akun?.name ?? '');
  const [nomorPelapor, setNomorPelapor] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [memprosesFoto, setMemprosesFoto] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [dialogFoto, setDialogFoto] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [sukses, setSukses] = useState<{ periode: number; standDilaporkan: number; pesan: string } | null>(null);

  const validasi = (): boolean => {
    const e: Record<string, string> = {};
    if (nomorLangganan.length !== 11) e.nomorLangganan = 'Nomor langganan harus tepat 11 digit angka.';
    if (stand.length === 0) e.stand = 'Angka meter wajib diisi.';
    else {
      const n = Number(stand);
      if (Number.isNaN(n) || n < 0 || n > 9999999) e.stand = 'Angka meter tidak valid.';
    }
    if (namaPelapor.trim().length < 2) e.namaPelapor = 'Nama pelapor wajib diisi (minimal 2 karakter).';
    if (nomorPelapor.trim().length < 5) e.nomorPelapor = 'Nomor HP wajib diisi agar petugas bisa menghubungi.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const pilihFoto = async (sumber: SumberMedia) => {
    setDialogFoto(false);
    setMemprosesFoto(true);
    setGalat(null);
    try {
      const uri = await ambilFoto(sumber, { lebarTarget: 600 });
      if (uri) setFotoUri(uri);
    } catch (e) {
      setGalat(e instanceof MediaError ? e.message : 'Gagal mengambil foto. Coba pilih dari Galeri.');
    } finally {
      setMemprosesFoto(false);
    }
  };

  const konfirmasiLaluKirim = () => {
    if (!validasi()) return;
    if (fotoUri == null) {
      setGalat('Foto meter wajib dilampirkan sebagai bukti. Ketuk kotak foto di atas untuk mengambilnya.');
      return;
    }
    setGalat(null);
    setKonfirmasi(true);
  };

  const kirim = async () => {
    setKonfirmasi(false);
    setMengirim(true);
    setGalat(null);
    try {
      const tanda = await repo.kirim({
        nomorLangganan,
        standDilaporkan: Number(stand),
        namaPelapor: namaPelapor.trim(),
        nomorPelapor: nomorPelapor.trim(),
        fotoUri,
      });
      setStand('');
      setFotoUri(null);
      setErrors({});
      setSukses({ periode: tanda.periode, standDilaporkan: tanda.standDilaporkan, pesan: tanda.pesan });
    } catch (e) {
      setGalat(ApiException.is(e) ? e.message : 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setMengirim(false);
    }
  };

  return (
    <AppScaffold
      title="Lapor Meter Mandiri"
      subtitle="Laporkan angka meter bulan ini"
      onBack={() => router.back()}
      body={
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <TextField
              label="Nomor Langganan"
              placeholder="11 digit nomor langganan"
              value={nomorLangganan}
              onChangeText={(t) => setNomorLangganan(t.replace(/\D/g, '').slice(0, 11))}
              keyboardType="number-pad"
              error={errors.nomorLangganan}
            />
            <TextField
              label="Angka Meter Saat Ini (m³)"
              placeholder="Contoh: 1245"
              description="Tulis angka HITAM pada meter air, tanpa angka merah di belakang koma."
              value={stand}
              onChangeText={(t) => setStand(t.replace(/\D/g, '').slice(0, 7))}
              keyboardType="number-pad"
              error={errors.stand}
            />

            <View style={styles.fotoGroup}>
              <Text style={styles.fotoLabel}>
                <Text style={{ color: colors.foreground }}>Foto Meter</Text>
                <Text style={{ color: colors.destructive }}> *wajib</Text>
              </Text>
              <PhotoBox uri={fotoUri} memproses={memprosesFoto} onPress={memprosesFoto ? undefined : () => setDialogFoto(true)} />
            </View>

            <TextField label="Nama Pelapor" placeholder="Nama lengkap Anda" value={namaPelapor} onChangeText={setNamaPelapor} error={errors.namaPelapor} />
            <TextField label="Nomor HP" placeholder="08xxxxxxxxxx" value={nomorPelapor} onChangeText={setNomorPelapor} keyboardType="phone-pad" error={errors.nomorPelapor} />

            {galat != null ? <Alert variant="destructive" title="Gagal mengirim" description={galat} /> : null}

            <Button onPress={konfirmasiLaluKirim} loading={mengirim} leading={mengirim ? undefined : <Ionicons name="paper-plane" size={16} color={colors.primaryForeground} />}>
              {mengirim ? 'Mengirim…' : 'Kirim Laporan'}
            </Button>
          </View>
        </ScrollView>
      }
    >
      <Dialog
        visible={dialogFoto}
        onDismiss={() => setDialogFoto(false)}
        title="Foto Meter"
        description="Ambil foto angka meter dengan jelas."
        actions={
          <>
            <Button onPress={() => pilihFoto('kamera')}>Kamera</Button>
            <Button variant="outline" onPress={() => pilihFoto('galeri')}>Galeri</Button>
            {fotoUri != null ? (
              <Button variant="destructive" onPress={() => { setFotoUri(null); setDialogFoto(false); }}>Hapus</Button>
            ) : null}
          </>
        }
      />

      <Dialog
        visible={konfirmasi}
        onDismiss={() => setKonfirmasi(false)}
        title="Konfirmasi Laporan"
        description="Periksa kembali data berikut sebelum dikirim. Angka meter yang keliru dapat memengaruhi tagihan Anda."
        actions={
          <>
            <Button onPress={kirim}>Kirim Laporan</Button>
            <Button variant="outline" onPress={() => setKonfirmasi(false)}>Periksa Lagi</Button>
          </>
        }
      >
        <View style={styles.konfirmasi}>
          <BarisKonfirmasi label="No. Langganan" nilai={nomorLangganan} />
          <BarisKonfirmasi label="Angka Meter" nilai={`${stand} m³`} />
          <BarisKonfirmasi label="Pelapor" nilai={namaPelapor} />
          <BarisKonfirmasi label="Kontak" nilai={nomorPelapor} />
        </View>
      </Dialog>

      <Dialog
        visible={sukses != null}
        onDismiss={() => setSukses(null)}
        title="Laporan Terkirim"
        description={
          sukses != null
            ? `${sukses.pesan}\n\nPeriode: ${labelPeriode(sukses.periode)}\nAngka dilaporkan: ${sukses.standDilaporkan} m³`
            : ''
        }
        actions={<Button onPress={() => setSukses(null)}>Selesai</Button>}
      />
    </AppScaffold>
  );
}

function BarisKonfirmasi({ label, nilai }: { label: string; nilai: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.barisKonf}>
      <Text style={[styles.barisKonfLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.barisKonfNilai, { color: colors.foreground }]}>{nilai}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 48 },
  form: { gap: 16 },
  fotoGroup: { gap: 8 },
  fotoLabel: { fontSize: 14, fontWeight: '600' },
  konfirmasi: { paddingVertical: 8, gap: 4 },
  barisKonf: { flexDirection: 'row', paddingVertical: 3 },
  barisKonfLabel: { width: 110, fontSize: 13 },
  barisKonfNilai: { flex: 1, fontSize: 14 },
});
