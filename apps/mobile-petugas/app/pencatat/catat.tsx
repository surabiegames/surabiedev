/**
 * Rute /pencatat/catat?nomorLangganan=&kodeRute= — layar catat satu pelanggan.
 *
 * Pelanggan dan urutan kunjungannya dibaca dari CACHE LOKAL, bukan dioper
 * lewat parameter navigasi: objek pelanggan terlalu besar untuk URL, dan yang
 * lebih penting, membacanya ulang berarti layar ini selalu melihat status
 * TERBARU (termasuk baris yang baru saja masuk antrean) alih-alih salinan
 * yang membeku saat layar dibuka.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { PelangganRute } from '@workspace/mobile-core';
import { PremiumBackground } from '@/components';
import { Button } from '@/components/ui/button';
import { Text as UIText } from '@/components/ui/text';
import { CatatMeterScreen } from '@/features/baca-meter/catat-screen';
import { ambilPelanggan, ruteSaya } from '@/features/baca-meter/repository';

export default function Catat() {
  const { nomorLangganan, kodeRute } = useLocalSearchParams<{
    nomorLangganan: string;
    kodeRute?: string;
  }>();
  const [pelanggan, setPelanggan] = useState<PelangganRute | null>(null);
  const [urutan, setUrutan] = useState<PelangganRute[]>([]);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    let batal = false;
    (async () => {
      const target = await ambilPelanggan(nomorLangganan ?? '').catch(() => null);
      const paket = await ruteSaya({ segarkan: false }).catch(() => null);
      if (batal) return;
      setPelanggan(target);
      // Urutan kunjungan = teman serute yang BELUM dicatat, urut jalan.
      const rute = kodeRute ?? target?.ruteKode ?? null;
      setUrutan(
        (paket?.pelanggan ?? []).filter(
          (p) => (rute == null || p.ruteKode === rute) && !p.sudahDicatat,
        ),
      );
      setSiap(true);
    })();
    return () => {
      batal = true;
    };
  }, [nomorLangganan, kodeRute]);

  if (!siap) {
    return (
      <PremiumBackground>
        <View style={gaya.tengah}>
          <ActivityIndicator />
        </View>
      </PremiumBackground>
    );
  }

  // Nomor tidak ada di cache: rutenya belum diunduh, atau paketnya diganti
  // unduhan baru yang tidak lagi memuat pelanggan ini. Layar kosong tanpa
  // penjelasan adalah jalan buntu di lapangan — katakan apa yang terjadi dan
  // apa yang harus dilakukan.
  if (pelanggan == null) {
    return (
      <PremiumBackground>
        <View style={gaya.tengah}>
          <Text style={gaya.pesan}>
            Pelanggan {nomorLangganan} tidak ada di data yang tersimpan di perangkat ini.
            Buka Download Data untuk mengunduh ulang rute Anda, lalu coba lagi.
          </Text>
          <Button variant="outline" onPress={() => router.back()}>
            <UIText>Kembali</UIText>
          </Button>
        </View>
      </PremiumBackground>
    );
  }

  return (
    <CatatMeterScreen
      pelanggan={pelanggan}
      urutanKunjungan={urutan}
      onBack={() => router.back()}
      onSelesai={() => router.back()}
      onPindah={(tujuan) =>
        // `replace`: berpindah rumah tidak boleh menumpuk layar catat, kalau
        // tidak tombol kembali menelusuri kembali seluruh rute satu per satu.
        router.replace({
          pathname: '/pencatat/catat',
          params: { nomorLangganan: tujuan, kodeRute: kodeRute ?? '' },
        })
      }
    />
  );
}

const gaya = StyleSheet.create({
  tengah: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  pesan: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
