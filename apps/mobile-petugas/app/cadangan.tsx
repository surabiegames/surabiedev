/** Rute /cadangan — jaring pengaman hasil catat. */
import { router } from 'expo-router';
import { CadanganScreen } from '@/features/baca-meter/cadangan-screen';

export default function Cadangan() {
  return <CadanganScreen onBack={() => router.back()} />;
}
