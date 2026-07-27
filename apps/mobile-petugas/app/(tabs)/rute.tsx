/**
 * Tab Rute — pilih rute yang dikerjakan hari ini.
 *
 * `onBack` sengaja tidak dioper: ini tab akar, tidak ada tempat untuk kembali.
 */
import { router } from 'expo-router';
import { DaftarRuteScreen } from '@/features/baca-meter/daftar-rute-screen';

export default function Rute() {
  return (
    <DaftarRuteScreen
      onBukaRute={(kodeRute) =>
        router.push({ pathname: '/pelanggan-rute', params: { kodeRute } })
      }
      // Antrean punya tabnya sendiri di dock — pindah tab, bukan menumpuk layar.
      onBukaAntrean={() => router.navigate('/upload')}
    />
  );
}
