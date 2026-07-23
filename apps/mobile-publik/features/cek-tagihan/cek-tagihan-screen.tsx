/**
 * cek-tagihan-screen.tsx — Cek Tagihan (publik, tanpa login). Padanan
 * features/public/cek_tagihan/cek_tagihan_screen.dart.
 *
 * Identitas cukup nomor langganan persis 11 digit; hasil menampilkan maksimal
 * 12 periode terakhir plus ringkasan tunggakan.
 *
 * Validasi form Flutter (ShadForm + validator) diganti state controlled: nomor
 * disaring digit-only saat mengetik, pesan galat dihitung saat submit.
 *
 * CATATAN: prefill nomor langganan UTAMA (LanggananSayaCache.utama di Flutter)
 * menyusul saat modul Langganan diport — untuk kini form mulai kosong.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Alert, AppScaffold, Button, Card, TextField, useTheme } from '@workspace/mobile-ui';
import { ApiException, type CekTagihanResult } from '@workspace/mobile-core';

import { buatCekTagihanRepository } from './repository';
import { HasilCekTagihanView } from './hasil-view';

export function CekTagihanScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  // Repository dibuat sekali per mount (bukan tiap render).
  const [repo] = useState(buatCekTagihanRepository);

  const [nomor, setNomor] = useState('');
  const [galatInput, setGalatInput] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [hasil, setHasil] = useState<CekTagihanResult | null>(null);

  const cek = async () => {
    if (nomor.length !== 11) {
      setGalatInput('Nomor langganan harus tepat 11 digit angka.');
      return;
    }
    setGalatInput(null);
    setMemuat(true);
    setGalat(null);
    setHasil(null);
    try {
      setHasil(await repo.cekTagihan(nomor));
    } catch (e) {
      // Pesan ApiException sudah bahasa Indonesia & siap tampil.
      setGalat(ApiException.is(e) ? e.message : 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setMemuat(false);
    }
  };

  return (
    <AppScaffold
      title="Cek Tagihan"
      subtitle="Informasi rekening air Anda"
      onBack={() => router.back()}
      body={
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Card
            title="Nomor Langganan"
            description="Masukkan 11 digit nomor langganan sesuai yang tertera pada rekening air Anda."
          >
            <View style={styles.form}>
              <TextField
                value={nomor}
                // Saring hanya digit + batasi 11 (padanan inputFormatters Flutter).
                onChangeText={(t) => setNomor(t.replace(/\D/g, '').slice(0, 11))}
                placeholder="Contoh: 00000100119"
                keyboardType="number-pad"
                maxLength={11}
                error={galatInput}
              />
              <Button
                onPress={cek}
                loading={memuat}
                leading={
                  memuat ? undefined : (
                    <Ionicons name="search" size={16} color={colors.primaryForeground} />
                  )
                }
              >
                {memuat ? 'Memeriksa…' : 'Cek Tagihan'}
              </Button>
            </View>
          </Card>

          {galat != null ? (
            <View style={styles.spacer}>
              <Alert variant="destructive" title="Pemeriksaan gagal" description={galat} />
            </View>
          ) : null}

          {hasil != null ? (
            <View style={styles.spacer}>
              <HasilCekTagihanView hasil={hasil} />
            </View>
          ) : null}
        </ScrollView>
      }
    />
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  form: { marginTop: 12, gap: 12 },
  spacer: { marginTop: 16 },
});
