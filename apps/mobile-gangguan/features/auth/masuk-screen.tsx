/**
 * masuk-screen.tsx — Masuk Petugas: tukar username/email + password menjadi
 * Bearer token (POST /api/mobile/auth/login). Padanan
 * `features/staff/auth/login_screen.dart`.
 *
 * TIDAK ADA tautan daftar. Akun petugas dibuat admin lewat dashboard web —
 * pendaftaran mandiri di aplikasi lapangan berarti siapa pun bisa membuat
 * identitas pencatat, dan seluruh jejak audit pencatatan kehilangan artinya.
 *
 * Pesan gagal dari server seragam apa pun sebabnya (anti user-enumeration) —
 * tampilkan apa adanya, jangan menebak-nebak sebabnya untuk pengguna.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff, LogIn, TriangleAlert } from 'lucide-react-native';
import { ApiException, SesiPetugas } from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text as UIText } from '@/components/ui/text';
import {
  Berat,
  GlassPanel,
  Kelas,
  PremiumBackground,
  Spasi,
  Teks,
  TinggiBaris,
  UkuranIkon,
  useTheme,
} from '@/components';

export function MasukPetugasScreen({ onSukses }: { onSukses: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [identitas, setIdentitas] = useState('');
  const [sandi, setSandi] = useState('');
  const [sandiTerlihat, setSandiTerlihat] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const masuk = async () => {
    const id = identitas.trim();
    if (id.length === 0 || sandi.length === 0) {
      setGalat('Isi username/email dan password terlebih dahulu.');
      return;
    }
    setSibuk(true);
    setGalat(null);
    try {
      const akun = await SesiPetugas.masuk({ identifier: id, password: sandi });
      // Akun warga (role USER) memang bisa lolos login mobile — endpointnya
      // satu pintu untuk kedua aplikasi. Tapi ia tidak punya rute untuk
      // dibaca, jadi menahannya di sini jauh lebih jelas daripada
      // membiarkannya masuk dan menemui layar kosong tanpa penjelasan.
      if (!akun.bolehLapangan) {
        await SesiPetugas.keluar();
        setGalat(
          'Akun ini bukan akun petugas lapangan. Gunakan aplikasi Tirtawening untuk pelanggan, ' +
            'atau minta admin menautkan akun Anda ke data Pencatat.',
        );
        setSibuk(false);
        return;
      }
      onSukses();
    } catch (err) {
      setGalat(ApiException.is(err) ? err.message : 'Terjadi kesalahan. Coba lagi.');
      setSibuk(false);
    }
  };

  return (
    <PremiumBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.batas}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.merek, { color: colors.mutedForeground }]}>
            PERUMDA TIRTAWENING
          </Text>
          <Text style={[styles.judul, { color: colors.foreground }]}>Portal Petugas</Text>
          <Text style={[styles.deskripsi, { color: colors.mutedForeground }]}>
            Masuk dengan akun yang didaftarkan admin.
          </Text>

          <GlassPanel padding={20} style={styles.panel}>
            <Text style={[styles.label, { color: colors.foreground }]}>Username / Email</Text>
            <Input
              value={identitas}
              onChangeText={setIdentitas}
              placeholder="nama.petugas"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!sibuk}
            />

            <Text style={[styles.label, styles.labelKedua, { color: colors.foreground }]}>
              Password
            </Text>
            <View>
              <Input
                value={sandi}
                onChangeText={setSandi}
                placeholder="••••••••"
                secureTextEntry={!sandiTerlihat}
                editable={!sibuk}
                onSubmitEditing={masuk}
                returnKeyType="go"
                className="pr-11"
              />
              <Pressable
                hitSlop={8}
                onPress={() => setSandiTerlihat((v) => !v)}
                style={styles.mataSandi}
              >
                {sandiTerlihat ? (
                  <EyeOff size={UkuranIkon.kecil} color={colors.mutedForeground} />
                ) : (
                  <Eye size={UkuranIkon.kecil} color={colors.mutedForeground} />
                )}
              </Pressable>
            </View>

            {galat != null ? (
              <View style={styles.galat}>
                <Alert icon={TriangleAlert} variant="destructive">
                  <AlertTitle>Tidak dapat masuk</AlertTitle>
                  <AlertDescription>{galat}</AlertDescription>
                </Alert>
              </View>
            ) : null}

            <Button onPress={masuk} disabled={sibuk} className={`mt-5 ${Kelas.tombol}`}>
              {sibuk ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <LogIn size={UkuranIkon.kecil} color={colors.primaryForeground} />
              )}
              <UIText>{sibuk ? 'Memeriksa…' : 'Masuk'}</UIText>
            </Button>
          </GlassPanel>

          <Text style={[styles.kaki, { color: colors.mutedForeground }]}>
            Lupa password? Atur ulang lewat dashboard web.
          </Text>
        </View>
      </ScrollView>
    </PremiumBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spasi.xl },
  batas: { width: '100%', maxWidth: 420, alignItems: 'stretch' },
  logo: { width: 72, height: 72, alignSelf: 'center' },
  merek: { fontSize: Teks.xs, fontWeight: '700', letterSpacing: 1.4, textAlign: 'center', marginTop: Spasi.xl },
  judul: { fontSize: Teks.xl2, fontWeight: '700', textAlign: 'center', marginTop: Spasi.xs },
  deskripsi: { fontSize: Teks.sm, textAlign: 'center', marginTop: Spasi.sm },
  panel: { marginTop: Spasi.xl },
  label: { fontSize: Teks.sm, fontWeight: '500', marginBottom: Spasi.sm },
  labelKedua: { marginTop: Spasi.lg },
  mataSandi: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  galat: { marginTop: Spasi.lg },
  kaki: { fontSize: Teks.xs, textAlign: 'center', marginTop: Spasi.lg },
});
