/**
 * Gerbang aplikasi: sesi hidup → Portal Petugas, sesi mati → layar Masuk.
 * Padanan `GerbangPetugas`. Sesi sudah dipulihkan di root layout, jadi di
 * sini tinggal memilih — tidak ada penantian kedua yang membuat layar
 * berkedip.
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import { SesiPetugas } from '@workspace/mobile-core';
import { PortalScreen } from '@/features/portal/portal-screen';

export default function Gerbang() {
  const masuk = SesiPetugas.sudahMasuk;

  useEffect(() => {
    if (!masuk) router.replace('/masuk');
  }, [masuk]);

  if (!masuk) return null;

  return (
    <PortalScreen
      onBukaPencatat={() => router.push('/pencatat')}
      onBukaGangguan={() => router.push('/gangguan')}
      onKeluar={() => router.replace('/masuk')}
    />
  );
}
