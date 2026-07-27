/** Rute /akun — identitas petugas, versi aplikasi, dan keluar. */
import { router } from 'expo-router';
import { AkunScreen } from '@/features/akun/akun-screen';

export default function Akun() {
  return (
    <AkunScreen onBack={() => router.back()} onKeluar={() => router.replace('/masuk')} />
  );
}
