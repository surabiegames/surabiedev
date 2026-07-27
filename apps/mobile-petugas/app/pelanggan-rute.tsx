/** Rute /pelanggan-rute?kodeRute= — daftar pelanggan satu rute. */
import { router, useLocalSearchParams } from 'expo-router';
import { PelangganRuteScreen } from '@/features/baca-meter/pelanggan-rute-screen';

export default function PelangganRute() {
  const { kodeRute } = useLocalSearchParams<{ kodeRute: string }>();
  return (
    <PelangganRuteScreen
      kodeRute={kodeRute ?? ''}
      onBack={() => router.back()}
      onBukaCatat={(nomorLangganan) =>
        router.push({
          pathname: '/catat',
          params: { nomorLangganan, kodeRute: kodeRute ?? '' },
        })
      }
    />
  );
}
