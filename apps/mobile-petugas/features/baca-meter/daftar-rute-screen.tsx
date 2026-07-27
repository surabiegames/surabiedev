/**
 * daftar-rute-screen.tsx — Baca Meter LANGKAH 1: pilih rute yang dikerjakan
 * hari ini. Padanan `daftar_pelanggan_screen.dart`.
 *
 * Petugas bisa memegang beberapa rute; layar ini menampilkannya sebagai kartu
 * (kode, seksi, progres per rute). Ketuk satu rute → daftar pelanggannya urut
 * nomor urut.
 *
 * Tombol unduh = TARIK ULANG paket rute dari server lalu simpan ke SQLite.
 * Membuka layar ini TIDAK menembak jaringan — ia membaca cache, supaya
 * berpindah layar tetap instan di sinyal yang buruk.
 *
 * TIDAK ADA auto-upload di sini. Hasil catat menunggu di antrean sampai
 * petugas menekan Upload — model Aurora, yang memberi petugas kendali atas
 * kapan kuota dan foto besarnya terkirim.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  BadgeCheck,
  ChevronRight,
  CloudDownload,
  CloudUpload,
  Map as MapIcon,
  MapPinOff,
  RotateCw,
  TriangleAlert,
  WifiOff,
} from 'lucide-react-native';
import {
  ApiException,
  formatWaktuLokal,
  labelPeriode,
  type RuteRingkas,
  type RuteSaya,
} from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Text as UIText } from '@/components/ui/text';
import { GlassPanel, MasterPalette as P, useTheme } from '@/components';
import { WorkspaceScaffold } from '@/features/petugas/workspace';
import { jumlahTertunda, periodeCatatSekarang, ruteSaya } from './repository';

export function DaftarRuteScreen({
  onBack,
  onBukaRute,
  onBukaAntrean,
}: {
  onBack: () => void;
  onBukaRute: (kodeRute: string) => void;
  onBukaAntrean: () => void;
}) {
  const { colors } = useTheme();
  const [paket, setPaket] = useState<RuteSaya | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [tertunda, setTertunda] = useState(0);
  const [memuat, setMemuat] = useState(false);

  const muat = useCallback(async (paksa = false) => {
    setMemuat(true);
    setGalat(null);
    try {
      const hasil = await ruteSaya({ segarkan: paksa });
      setPaket(hasil);
      setTertunda(await jumlahTertunda());
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal memuat rute.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat(false);
  }, [muat]);

  // Kembali dari layar rute: progres bisa berubah karena baru saja mencatat.
  useFocusEffect(
    useCallback(() => {
      void muat(false);
    }, [muat]),
  );

  const periode = paket?.periode ?? periodeCatatSekarang();

  const targetRute = (r: RuteRingkas) =>
    (paket?.pelanggan ?? []).filter((p) => p.ruteKode === r.kode).length;
  const terbacaRute = (r: RuteRingkas) =>
    (paket?.pelanggan ?? []).filter((p) => p.ruteKode === r.kode && p.sudahDicatat).length;

  return (
    <WorkspaceScaffold
      judul="Baca Meter"
      subjudul={`Pilih rute · ${labelPeriode(periode)}`}
      onBack={onBack}
      onSegarkan={() => void muat(true)}
      sedangMuat={memuat}
    >
      {paket == null && galat == null ? (
        <View style={styles.tengah}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : galat != null && paket == null ? (
        <View>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Gagal mengunduh rute</AlertTitle>
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
          <Button variant="outline" onPress={() => void muat(true)} className="mt-3 w-full">
            <RotateCw size={15} color={colors.foreground} />
            <UIText>Coba Lagi</UIText>
          </Button>
        </View>
      ) : paket != null && paket.rutes.length === 0 ? (
        <View style={styles.kosong}>
          <MapPinOff size={40} color={colors.mutedForeground} />
          <Text style={[styles.kosongTeks, { color: colors.mutedForeground }]}>
            Rute belum ditugaskan ke akun Anda. Penugasan diatur admin di dashboard web (menu
            Pemetaan Rute) — hubungi admin bila belum ada, lalu tarik-segarkan halaman ini.
          </Text>
        </View>
      ) : paket != null ? (
        <>
          <RingkasanCatat paket={paket} tertunda={tertunda} onBukaAntrean={onBukaAntrean} />
          <Text style={[styles.subjudulDaftar, { color: colors.foreground }]}>
            Rute Anda hari ini
          </Text>
          {paket.rutes.map((rute) => (
            <KartuRute
              key={rute.id}
              rute={rute}
              target={targetRute(rute)}
              terbaca={terbacaRute(rute)}
              onPress={() => onBukaRute(rute.kode)}
            />
          ))}
        </>
      ) : null}
    </WorkspaceScaffold>
  );
}

function RingkasanCatat({
  paket,
  tertunda,
  onBukaAntrean,
}: {
  paket: RuteSaya;
  tertunda: number;
  onBukaAntrean: () => void;
}) {
  const { colors } = useTheme();
  const rasio = paket.target === 0 ? 0 : paket.terbaca / paket.target;

  return (
    <GlassPanel padding={14}>
      <View style={styles.ringkasanBaris}>
        <View style={[styles.pilRute, { backgroundColor: P.emerald600 }]}>
          <Text style={styles.pilRuteTeks}>{paket.rutes.length} rute</Text>
        </View>
        {paket.dariCache ? <ChipKecil ikon={WifiOff} label="Offline" bahaya /> : null}
        {tertunda > 0 ? (
          <Text onPress={onBukaAntrean}>
            <ChipKecil ikon={CloudUpload} label={`${tertunda} antre`} />
          </Text>
        ) : null}
        <View style={styles.dorong} />
        <Text style={[styles.ringkasanAngka, { color: colors.mutedForeground }]}>
          {paket.terbaca} dari {paket.target} target
        </Text>
      </View>

      <BarProgres rasio={rasio} />

      {paket.diunduhPada != null ? (
        <Text style={[styles.jejakUnduh, { color: colors.mutedForeground }]}>
          Terunduh {formatWaktuLokal(paket.diunduhPada)}
          {paket.dariCache ? ' · data terakhir sebelum sinyal hilang' : ''}
        </Text>
      ) : null}
    </GlassPanel>
  );
}

function KartuRute({
  rute,
  target,
  terbaca,
  onPress,
}: {
  rute: RuteRingkas;
  target: number;
  terbaca: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const selesai = target > 0 && terbaca >= target;
  const rasio = target === 0 ? 0 : terbaca / target;

  return (
    <GlassPanel padding={14} onPress={onPress} style={styles.kartuRute}>
      <View style={styles.ruteBaris}>
        <View
          style={[
            styles.ikonRute,
            { backgroundColor: selesai ? P.emerald600 : colors.secondary },
          ]}
        >
          {selesai ? (
            <BadgeCheck size={20} color="#FFFFFF" />
          ) : (
            <MapIcon size={20} color={colors.mutedForeground} />
          )}
        </View>
        <View style={styles.ruteTeks}>
          <Text style={[styles.ruteKode, { color: colors.foreground }]}>Rute {rute.kode}</Text>
          {rute.seksiCater != null ? (
            <Text numberOfLines={1} style={[styles.ruteSeksi, { color: colors.mutedForeground }]}>
              {rute.seksiCater}
            </Text>
          ) : null}
        </View>
        <Text
          style={[
            styles.ruteAngka,
            { color: selesai ? P.emerald600 : colors.foreground },
          ]}
        >
          {terbaca}/{target}
        </Text>
        <ChevronRight size={16} color={colors.mutedForeground} />
      </View>
      <BarProgres rasio={rasio} />
    </GlassPanel>
  );
}

/**
 * Bar progres sederhana. Sengaja tidak memakai komponen Progress bersama:
 * yang dibutuhkan di sini hanya dua View, dan menariknya lewat primitif
 * beranimasi menambah kerja render di daftar yang bisa berisi puluhan rute.
 */
export function BarProgres({ rasio }: { rasio: number }) {
  const { colors } = useTheme();
  const lebar = `${Math.round(Math.min(1, Math.max(0, rasio)) * 100)}%` as const;
  return (
    <View style={[styles.jalurBar, { backgroundColor: colors.muted }]}>
      <View style={[styles.isiBar, { width: lebar, backgroundColor: P.emerald600 }]} />
    </View>
  );
}

function ChipKecil({
  ikon: Ikon,
  label,
  bahaya = false,
}: {
  ikon: typeof WifiOff;
  label: string;
  bahaya?: boolean;
}) {
  const { colors } = useTheme();
  const warna = bahaya ? colors.destructive : colors.mutedForeground;
  return (
    <View style={[styles.chip, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Ikon size={11} color={warna} />
      <Text style={[styles.chipTeks, { color: warna }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tengah: { paddingVertical: 48, alignItems: 'center' },
  kosong: { paddingVertical: 40, alignItems: 'center', gap: 12 },
  kosongTeks: { fontSize: 12.5, textAlign: 'center', lineHeight: 19 },

  ringkasanBaris: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  pilRute: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pilRuteTeks: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  dorong: { flex: 1 },
  ringkasanAngka: { fontSize: 11.5 },
  jejakUnduh: { fontSize: 10.5, marginTop: 8 },

  subjudulDaftar: { fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  kartuRute: { marginBottom: 8 },
  ruteBaris: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  ikonRute: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ruteTeks: { flex: 1 },
  ruteKode: { fontSize: 13, fontWeight: '700' },
  ruteSeksi: { fontSize: 11.5, marginTop: 1 },
  ruteAngka: { fontSize: 13, fontWeight: '700' },

  jalurBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  isiBar: { height: '100%', borderRadius: 4 },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipTeks: { fontSize: 10.5, fontWeight: '600' },
});
