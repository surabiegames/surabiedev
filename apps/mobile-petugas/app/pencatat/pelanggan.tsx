/** Rute /pencatat/pelanggan — pilih rute yang dikerjakan hari ini. */
import { router } from 'expo-router';
import { DaftarRuteScreen } from '@/features/baca-meter/daftar-rute-screen';

export default function Pelanggan() {
  return (
    <DaftarRuteScreen
      onBack={() => router.back()}
      onBukaRute={(kodeRute) =>
        router.push({ pathname: '/pencatat/rute', params: { kodeRute } })
      }
      onBukaAntrean={() => router.push('/pencatat/upload')}
    />
  );
}
