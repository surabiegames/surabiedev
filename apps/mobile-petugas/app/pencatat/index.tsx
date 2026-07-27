/** Rute /pencatat — ruang kerja Pencatat Meter. */
import { router } from 'expo-router';
import { BerandaPencatatScreen } from '@/features/pencatat/beranda-screen';

export default function Pencatat() {
  return (
    <BerandaPencatatScreen
      onBack={() => router.back()}
      onBukaBacaMeter={() => router.push('/pencatat/pelanggan')}
      onBukaUnduh={() => router.push('/pencatat/unduh')}
      onBukaUpload={() => router.push('/pencatat/upload')}
      onBukaRiwayat={() => router.push('/pencatat/riwayat')}
      onBukaInfoTagihan={() => router.push('/pencatat/info-tagihan')}
      onBukaNotifikasi={() => router.push('/pencatat/notifikasi')}
      onBukaCadangan={() => router.push('/pencatat/cadangan')}
      onBukaCatat={(nomorLangganan) =>
        router.push({ pathname: '/pencatat/catat', params: { nomorLangganan } })
      }
    />
  );
}
