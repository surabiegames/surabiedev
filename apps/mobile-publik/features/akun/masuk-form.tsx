/**
 * masuk-form.tsx — form masuk akun warga, LOGIKA & VALIDASI SAJA (tanpa
 * chrome halaman). Padanan widgets/masuk_warga_form.dart. Dipakai ulang di
 * layar penuh (Masuk) DAN tab Akun tanpa duplikasi.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert, Button, TextField, useTheme } from '@workspace/mobile-ui';
import { ApiException, SesiWarga, type WargaAkun } from '@workspace/mobile-core';

export function MasukWargaForm({
  onSukses,
  onTukarKeDaftar,
}: {
  onSukses: (akun: WargaAkun) => void;
  onTukarKeDaftar?: () => void;
}) {
  const { colors } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const masuk = async () => {
    const e: Record<string, string> = {};
    if (identifier.trim().length === 0) e.identifier = 'Email wajib diisi.';
    if (password.length === 0) e.password = 'Password wajib diisi.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setMengirim(true);
    setGalat(null);
    try {
      const akun = await SesiWarga.masuk({ identifier: identifier.trim(), password });
      onSukses(akun);
    } catch (err) {
      setGalat(ApiException.is(err) ? err.message : 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setMengirim(false);
    }
  };

  return (
    <View style={styles.form}>
      <TextField label="Email" placeholder="nama@email.com" value={identifier} onChangeText={setIdentifier} keyboardType="email-address" autoCapitalize="none" error={errors.identifier} />
      <TextField label="Password" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry error={errors.password} />
      {galat != null ? <Alert variant="destructive" title="Tidak dapat masuk" description={galat} /> : null}
      <Button onPress={masuk} loading={mengirim} leading={mengirim ? undefined : <Ionicons name="log-in" size={16} color={colors.primaryForeground} />}>
        {mengirim ? 'Memeriksa…' : 'Masuk'}
      </Button>
      {onTukarKeDaftar != null ? (
        <Pressable disabled={mengirim} onPress={onTukarKeDaftar} style={styles.tautan}>
          <Text style={[styles.tautanTeks, { color: colors.mutedForeground }]}>
            Belum punya akun? <Text style={{ color: colors.primary, fontWeight: '600' }}>Daftar</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  tautan: { alignItems: 'center', paddingVertical: 4 },
  tautanTeks: { fontSize: 13 },
});
