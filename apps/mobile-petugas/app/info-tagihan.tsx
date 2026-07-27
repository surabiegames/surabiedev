/** Rute /info-tagihan — cek rekening pelanggan di lokasi. */
import { router } from 'expo-router';
import { InfoTagihanScreen } from '@/features/info-tagihan/info-tagihan-screen';

export default function InfoTagihan() {
  return <InfoTagihanScreen onBack={() => router.back()} />;
}
