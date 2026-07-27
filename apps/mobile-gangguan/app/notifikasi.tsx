/** Rute /notifikasi — inbox notifikasi petugas gangguan. */
import { router } from 'expo-router';
import { NotifikasiScreen } from '@/features/notifikasi/notifikasi-screen';

export default function Notifikasi() {
  return <NotifikasiScreen onBack={() => router.back()} />;
}
