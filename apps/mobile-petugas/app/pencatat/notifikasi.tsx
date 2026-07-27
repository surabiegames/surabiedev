/** Rute /pencatat/notifikasi — inbox notifikasi petugas. */
import { router } from 'expo-router';
import { NotifikasiScreen } from '@/features/notifikasi/notifikasi-screen';

export default function Notifikasi() {
  return <NotifikasiScreen onBack={() => router.back()} />;
}
