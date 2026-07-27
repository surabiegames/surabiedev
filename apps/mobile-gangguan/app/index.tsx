/**
 * Rute / — ruang kerja Petugas Gangguan, layar pertama aplikasi ini.
 *
 * Dulu `/gangguan` di dalam aplikasi petugas, di belakang layar Portal.
 * Portal sudah dihapus dan gangguan berdiri sebagai aplikasi sendiri
 * (keputusan 2026-07-27), jadi ruang kerja ini naik jadi akar.
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import { SesiPetugas } from '@workspace/mobile-core';
import { BerandaGangguanScreen } from '@/features/gangguan/beranda-screen';

export default function Gangguan() {
  const masuk = SesiPetugas.sudahMasuk;

  useEffect(() => {
    if (!masuk) router.replace('/masuk');
  }, [masuk]);

  if (!masuk) return null;

  return (
    <BerandaGangguanScreen
      // Akar tumpukan: tidak ada tempat untuk kembali.
      onBack={() => {}}
      onBukaTiket={(id) => router.push({ pathname: '/tiket', params: { id } })}
      onBukaInfoTagihan={() => router.push('/info-tagihan')}
      onBukaNotifikasi={() => router.push('/notifikasi')}
    />
  );
}
