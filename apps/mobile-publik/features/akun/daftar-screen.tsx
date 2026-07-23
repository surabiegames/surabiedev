/**
 * daftar-screen.tsx — layar penuh "Daftar Akun" (padanan daftar_warga_screen.dart):
 * chrome halaman di sekitar DaftarWargaForm. Sukses → Laporan Saya; tautan
 * masuk → ganti ke layar Masuk.
 */
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { AppScaffold } from '@workspace/mobile-ui';

import { tandaiSesiBerubah } from '../shared/sesi-store';
import { DaftarWargaForm } from './daftar-form';

export function DaftarWargaScreen() {
  const router = useRouter();
  return (
    <AppScaffold
      title="Daftar Akun"
      subtitle="Supaya laporan Anda tersimpan otomatis"
      onBack={() => router.back()}
      body={
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <DaftarWargaForm
            onSukses={() => {
              tandaiSesiBerubah();
              router.replace('/laporan-saya');
            }}
            onTukarKeMasuk={() => router.replace('/masuk')}
          />
        </ScrollView>
      }
    />
  );
}

const styles = StyleSheet.create({ scroll: { padding: 16, paddingBottom: 48 } });
