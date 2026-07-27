/** Tab Beranda — layar pertama aplikasi Pencatat Meter. */
import { router } from 'expo-router';
import { BerandaPencatatScreen } from '@/features/pencatat/beranda-screen';

export default function Beranda() {
  return (
    <BerandaPencatatScreen
      onBukaAkun={() => router.push('/akun')}
      onBukaRiwayat={() => router.push('/riwayat')}
      onBukaInfoTagihan={() => router.push('/info-tagihan')}
      onBukaNotifikasi={() => router.push('/notifikasi')}
      onBukaCadangan={() => router.push('/cadangan')}
      onBukaCatat={(nomorLangganan) =>
        router.push({ pathname: '/catat', params: { nomorLangganan } })
      }
    />
  );
}
