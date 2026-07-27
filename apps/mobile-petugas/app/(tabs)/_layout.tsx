/**
 * Shell utama aplikasi Pencatat Meter — empat tab di atas dock mengambang,
 * dengan tombol Scan di tengah.
 *
 *   Beranda · Rute · [Scan] · Download · Upload
 *
 * Portal SUDAH TIDAK ADA (keputusan 2026-07-27): aplikasi ini berdiri sendiri
 * hanya untuk petugas catat meter, dan gangguan pindah ke `apps/mobile-gangguan`.
 * Karena itu tab pertama adalah akar navigasi — tidak ada tombol kembali di
 * beranda, dan sebagai gantinya sudut kiri header dipakai tombol Akun.
 *
 * Scan BUKAN tab. Ia didorong sebagai layar biasa (`/scan`) lalu ditutup;
 * kalau dibuat tab, "kembali" dari kamera akan mendarat di tab kosong.
 *
 * Lencana Upload dibaca ulang tiap kali shell mendapat fokus — angka antrean
 * berubah setiap petugas menyimpan hasil catat di layar lain.
 */
import { useCallback, useState } from 'react';
import { Tabs, router, useFocusEffect } from 'expo-router';
import { CloudDownload, CloudUpload, Gauge, House } from 'lucide-react-native';
import { BottomDock, type DockItem } from '@/components';
import { jumlahTertunda } from '@/features/baca-meter/repository';

/** Urutan tab = urutan berkas rute di folder ini. */
const URUTAN = ['index', 'rute', 'unduh', 'upload'] as const;

const LABEL: Record<(typeof URUTAN)[number], { ikon: DockItem['ikon']; label: string }> = {
  index: { ikon: House, label: 'Beranda' },
  rute: { ikon: Gauge, label: 'Rute' },
  unduh: { ikon: CloudDownload, label: 'Download' },
  upload: { ikon: CloudUpload, label: 'Upload' },
};

/** Bentuk minimal props tabBar dari React Navigation (dipakai expo-router). */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

function DockTabBar({ state, navigation }: TabBarProps) {
  const [tertunda, setTertunda] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let batal = false;
      jumlahTertunda()
        .then((n) => {
          if (!batal) setTertunda(n);
        })
        .catch(() => {
          // Lencana hanya kenyamanan — kegagalan membacanya tidak boleh
          // menjatuhkan dock.
        });
      return () => {
        batal = true;
      };
    }, []),
  );

  const items: DockItem[] = state.routes
    .map((r) => LABEL[r.name as (typeof URUTAN)[number]])
    .filter(Boolean)
    .map((def) => ({
      ...def,
      lencana: def.label === 'Upload' && tertunda > 0 ? String(tertunda) : null,
    }));

  return (
    <BottomDock
      items={items}
      currentIndex={state.index}
      onScan={() => router.push('/scan')}
      onTap={(i) => {
        const route = state.routes[i];
        if (!route) return;
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (state.index !== i && !event.defaultPrevented) navigation.navigate(route.name);
      }}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <DockTabBar {...(props as unknown as TabBarProps)} />}
    >
      {URUTAN.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ title: LABEL[name].label }} />
      ))}
    </Tabs>
  );
}
