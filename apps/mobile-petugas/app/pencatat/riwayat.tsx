/** Rute /pencatat/riwayat — hasil catat saya periode berjalan. */
import { router } from 'expo-router';
import { RiwayatScreen } from '@/features/baca-meter/riwayat-screen';

export default function Riwayat() {
  return <RiwayatScreen onBack={() => router.back()} />;
}
