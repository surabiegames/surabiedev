/** Rute /gangguan — ruang kerja Petugas Gangguan. */
import { router } from 'expo-router';
import { BerandaGangguanScreen } from '@/features/gangguan/beranda-screen';

export default function Gangguan() {
  return (
    <BerandaGangguanScreen
      onBack={() => router.back()}
      onBukaTiket={(id) => router.push({ pathname: '/gangguan/tiket', params: { id } })}
      onBukaInfoTagihan={() => router.push('/pencatat/info-tagihan')}
      onBukaNotifikasi={() => router.push('/pencatat/notifikasi')}
    />
  );
}
