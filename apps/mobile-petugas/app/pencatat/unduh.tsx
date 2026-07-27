/** Rute /pencatat/unduh — Download Data. */
import { router } from 'expo-router';
import { UnduhDataScreen } from '@/features/baca-meter/unduh-screen';

export default function Unduh() {
  return <UnduhDataScreen onBack={() => router.back()} />;
}
