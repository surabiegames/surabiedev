/**
 * akun-screen.tsx — identitas petugas, versi aplikasi, dan keluar.
 *
 * KENAPA LAYAR INI ADA. Ketiga hal di atas dulu tinggal di Portal Petugas.
 * Portal dihapus (keputusan 2026-07-27: aplikasi ini berdiri sendiri hanya
 * untuk pencatat meter), dan tanpa rumah baru, TOMBOL KELUAR akan hilang sama
 * sekali dari aplikasi — petugas tidak akan bisa berganti akun di satu
 * perangkat yang dipakai bergantian.
 *
 * Dibuka dari tombol di sudut kiri header beranda (varian E5), posisi yang
 * dulu ditempati tombol kembali ke Portal.
 *
 * KELUAR SELALU LEWAT KONFIRMASI, dan konfirmasinya menyebut apa yang TIDAK
 * hilang: rute terunduh dan antrean yang belum terkirim tetap tersimpan.
 * Tanpa kalimat itu, petugas yang antreannya menumpuk tidak akan berani
 * menekannya — dan itu pernah jadi alasan orang memakai akun orang lain.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { ChevronLeft, Info, LogOut, ShieldCheck, User } from 'lucide-react-native';
import { SesiPetugas } from '@workspace/mobile-core';
import { Berat, Radius, Spasi, useTheme } from '@/components';
import { DialogKonfirmasi } from '@/features/petugas/dialog-konfirmasi';

export function AkunScreen({
  onBack,
  onKeluar,
}: {
  onBack: () => void;
  onKeluar: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tanyaKeluar, setTanyaKeluar] = useState(false);

  const akun = SesiPetugas.akun;
  const nama = akun?.name ?? 'Petugas';
  const surel = akun?.email ?? '';
  const versi = Constants.expoConfig?.version ?? '1.0.0';
  const inisial = nama.trim().slice(0, 2).toUpperCase();

  return (
    <View style={[gaya.layar, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={gaya.barAtas}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          style={({ pressed }) => pressed && gaya.ditekan}
        >
          <ChevronLeft size={24} color={colors.primary} />
        </Pressable>
        <Text style={[gaya.judul, { color: colors.foreground }]}>Akun</Text>
      </View>

      <View style={gaya.isi}>
        <View style={[gaya.kartuIdentitas, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[gaya.avatar, { backgroundColor: colors.nadaHijauLatar }]}>
            <Text style={[gaya.avatarTeks, { color: colors.nadaHijauTinta }]}>{inisial}</Text>
          </View>
          <View style={gaya.identitasTeks}>
            <Text numberOfLines={1} style={[gaya.nama, { color: colors.foreground }]}>
              {nama}
            </Text>
            {surel.length > 0 ? (
              <Text numberOfLines={1} style={[gaya.surel, { color: colors.mutedForeground }]}>
                {surel}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[gaya.kartuDaftar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={gaya.baris}>
            <User size={18} color={colors.mutedForeground} />
            <Text style={[gaya.barisLabel, { color: colors.foreground }]}>Peran</Text>
            <Text style={[gaya.barisNilai, { color: colors.mutedForeground }]}>Pencatat meter</Text>
          </View>
          <View style={[gaya.pemisah, { backgroundColor: colors.border }]} />
          <View style={gaya.baris}>
            <Info size={18} color={colors.mutedForeground} />
            <Text style={[gaya.barisLabel, { color: colors.foreground }]}>Versi aplikasi</Text>
            <Text style={[gaya.barisNilai, { color: colors.mutedForeground }]}>{versi}</Text>
          </View>
          <View style={[gaya.pemisah, { backgroundColor: colors.border }]} />
          <View style={gaya.baris}>
            <ShieldCheck size={18} color={colors.mutedForeground} />
            <Text style={[gaya.barisLabel, { color: colors.foreground }]}>Data lokal</Text>
            <Text style={[gaya.barisNilai, { color: colors.mutedForeground }]}>
              Aman saat keluar
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => setTanyaKeluar(true)}
          accessibilityRole="button"
          style={({ pressed }) => [
            gaya.tombolKeluar,
            { backgroundColor: colors.nadaBahayaLatar },
            pressed && gaya.ditekan,
          ]}
        >
          <LogOut size={18} color={colors.nadaBahayaTinta} />
          <Text style={[gaya.keluarTeks, { color: colors.nadaBahayaTinta }]}>Keluar dari akun</Text>
        </Pressable>
      </View>

      <DialogKonfirmasi
        visible={tanyaKeluar}
        judul="Keluar dari Akun"
        deskripsi={
          'Sesi di perangkat ini akan dihapus. Rute yang sudah diunduh dan hasil catat ' +
          'yang belum terunggah TETAP tersimpan — keduanya kembali begitu Anda masuk lagi.'
        }
        labelKonfirmasi="Keluar"
        destruktif
        onTutup={() => setTanyaKeluar(false)}
        onKonfirmasi={async () => {
          await SesiPetugas.keluar();
          onKeluar();
        }}
      />
    </View>
  );
}

const gaya = StyleSheet.create({
  layar: { flex: 1 },
  ditekan: { opacity: 0.7 },
  barAtas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.md,
    paddingHorizontal: Spasi.lg,
    paddingVertical: Spasi.md,
  },
  judul: { fontSize: 17, fontWeight: Berat.semi },
  isi: { padding: Spasi.lg, gap: Spasi.lg },

  kartuIdentitas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.md,
    padding: Spasi.lg,
    borderRadius: Radius.kartu,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.bundar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTeks: { fontSize: 17, fontWeight: Berat.tebal },
  identitasTeks: { flex: 1, minWidth: 0 },
  nama: { fontSize: 16, fontWeight: Berat.semi },
  surel: { fontSize: 12, marginTop: 2 },

  kartuDaftar: {
    borderRadius: Radius.kartu,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spasi.lg,
  },
  baris: { flexDirection: 'row', alignItems: 'center', gap: Spasi.md, paddingVertical: Spasi.md },
  barisLabel: { flex: 1, fontSize: 14 },
  barisNilai: { fontSize: 13 },
  pemisah: { height: StyleSheet.hairlineWidth },

  tombolKeluar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spasi.sm,
    height: 48,
    borderRadius: Radius.kontrol,
  },
  keluarTeks: { fontSize: 14, fontWeight: Berat.semi },
});
