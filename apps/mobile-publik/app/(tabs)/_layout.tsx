// Shell utama app publik (padanan MainShellScreen di
// features/public/home/main_shell_screen.dart): 3 tab NYATA
// (Beranda, Laporan, Akun) di atas BottomDock mengambang.
//
// SENGAJA HANYA 3 tab, bukan 5 seperti mockup: "Tagihan" & "Riwayat
// Transaksi" mengandaikan tagihan tertaut akun + bayar online — dua hal yang
// TIDAK ada di API ini. Menambah tab untuk fitur yang tak nyata = tombol mati.
import { Tabs } from 'expo-router';
import { BottomDock, type DockItem } from '@/components';

// Ikon outline (tidak aktif) vs filled (aktif) — pola khas tab bar iOS.
const ITEMS: Record<string, DockItem> = {
  index: { icon: 'home-outline', iconActive: 'home', label: 'Beranda' },
  laporan: { icon: 'document-text-outline', iconActive: 'document-text', label: 'Laporan' },
  akun: { icon: 'person-circle-outline', iconActive: 'person-circle', label: 'Akun' },
};

// Urutan tab (juga urutan item di dock). Nama = nama file rute.
const ORDER = ['index', 'laporan', 'akun'] as const;

/** Bentuk minimal props tabBar dari React Navigation (dipakai expo-router). */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

function DockTabBar({ state, navigation }: TabBarProps) {
  const items = state.routes.map((r) => ITEMS[r.name]).filter((x): x is DockItem => Boolean(x));

  return (
    <BottomDock
      items={items}
      currentIndex={state.index}
      onTap={(i) => {
        const route = state.routes[i];
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (state.index !== i && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
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
      {ORDER.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ title: ITEMS[name].label }} />
      ))}
    </Tabs>
  );
}
