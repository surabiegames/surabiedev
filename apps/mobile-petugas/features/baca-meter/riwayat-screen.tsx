/**
 * riwayat-screen.tsx — seluruh hasil catat AKUN INI pada periode berjalan,
 * beserta status verifikasinya. Padanan `riwayat_screen.dart` (`tv_today_reading`
 * + daftar read Aurora, ditambah status berjenjang yang Aurora tidak punya).
 *
 * Menggabungkan DUA sumber dengan sengaja: baris yang masih ANTRE di
 * perangkat dan baris yang sudah ada di server. Tanpa penggabungan itu,
 * "riwayat" akan bohong tepat pada saat paling penting — sore hari setelah
 * seharian bekerja offline, ketika daftar server masih kosong.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Clock, TriangleAlert, WifiOff, XCircle } from 'lucide-react-native';
import {
  ApiException,
  dicatatHariIni,
  formatWaktuLokal,
  labelDari,
  labelKondisiMeter,
  labelPeriode,
  type LaporanSaya,
  type StatusVerifLaporan,
} from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { GlassPanel, MasterPalette as P, useTheme } from '@/components';
import { CompactStat, WorkspaceScaffold, type Ikon } from '@/features/petugas/workspace';
import { periodeCatatSekarang, riwayatSaya } from './repository';

const IKON_STATUS: Record<StatusVerifLaporan, Ikon> = {
  ANTRE: WifiOff,
  MENUNGGU: Clock,
  DIVERIFIKASI: CheckCircle2,
  DITOLAK: XCircle,
};

const LABEL_STATUS: Record<StatusVerifLaporan, string> = {
  ANTRE: 'Antre di perangkat',
  MENUNGGU: 'Menunggu verifikasi',
  DIVERIFIKASI: 'Diverifikasi',
  DITOLAK: 'Ditolak',
};

export function RiwayatScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [daftar, setDaftar] = useState<LaporanSaya[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      setDaftar(await riwayatSaya());
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal memuat riwayat.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const angka = useMemo(() => {
    const hitung = (s: StatusVerifLaporan) => daftar.filter((l) => l.statusVerif === s).length;
    return {
      total: daftar.length,
      hariIni: daftar.filter(dicatatHariIni).length,
      antre: hitung('ANTRE'),
      ditolak: hitung('DITOLAK'),
    };
  }, [daftar]);

  const periode = periodeCatatSekarang();

  return (
    <WorkspaceScaffold
      judul="Riwayat Catat"
      subjudul={`Hasil kerja Anda · ${labelPeriode(periode)}`}
      onBack={onBack}
      onSegarkan={() => void muat()}
      sedangMuat={memuat}
    >
      <View style={styles.statBaris}>
        <CompactStat label="Dicatat periode ini" nilai={String(angka.total)} ikon={CheckCircle2} />
        <CompactStat label="Hari ini" nilai={String(angka.hariIni)} ikon={Clock} />
      </View>
      <View style={[styles.statBaris, styles.jarakKecil]}>
        <CompactStat
          label="Antre kirim"
          nilai={String(angka.antre)}
          ikon={WifiOff}
          bahaya={angka.antre > 0}
        />
        <CompactStat
          label="Ditolak"
          nilai={String(angka.ditolak)}
          ikon={XCircle}
          bahaya={angka.ditolak > 0}
        />
      </View>

      {galat != null ? (
        <View style={styles.jarak}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Gagal memuat</AlertTitle>
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      {memuat && daftar.length === 0 ? (
        <View style={styles.tengah}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : daftar.length === 0 ? (
        <Text style={[styles.kosong, { color: colors.mutedForeground }]}>
          Belum ada hasil catat pada periode ini. Mulai dari menu Baca Meter.
        </Text>
      ) : (
        <>
          <Text style={[styles.judulDaftar, { color: colors.foreground }]}>Daftar pencatatan</Text>
          {daftar.map((l, i) => (
            <BarisRiwayat key={`${l.nomorLangganan}-${l.id ?? i}`} laporan={l} />
          ))}
        </>
      )}
    </WorkspaceScaffold>
  );
}

function BarisRiwayat({ laporan }: { laporan: LaporanSaya }) {
  const { colors } = useTheme();
  const Ikon = IKON_STATUS[laporan.statusVerif];
  const warna =
    laporan.statusVerif === 'DIVERIFIKASI'
      ? P.emerald600
      : laporan.statusVerif === 'DITOLAK'
        ? colors.destructive
        : colors.mutedForeground;

  const pemakaian =
    laporan.pemakaian ??
    (laporan.standAkhir != null && laporan.standAwal != null
      ? laporan.standAkhir - laporan.standAwal
      : null);

  return (
    <GlassPanel padding={14} style={styles.baris}>
      <View style={styles.barisAtas}>
        <Ikon size={16} color={warna} />
        <Text style={[styles.barisNomor, { color: colors.foreground }]}>
          {laporan.nomorLangganan}
        </Text>
        <Text style={[styles.barisStatus, { color: warna }]}>
          {LABEL_STATUS[laporan.statusVerif]}
        </Text>
      </View>

      {laporan.namaPelanggan != null ? (
        <Text numberOfLines={1} style={[styles.barisNama, { color: colors.foreground }]}>
          {laporan.namaPelanggan}
        </Text>
      ) : null}

      <Text style={[styles.barisRincian, { color: colors.mutedForeground }]}>
        Stand {laporan.standAwal ?? '—'} → {laporan.standAkhir ?? '—'}
        {pemakaian != null ? ` · ${pemakaian} m³` : ''}
        {laporan.kondisi != null ? ` · ${labelDari(labelKondisiMeter, laporan.kondisi)}` : ''}
      </Text>

      {laporan.tanggalCatat != null ? (
        <Text style={[styles.barisWaktu, { color: colors.mutedForeground }]}>
          Dicatat {formatWaktuLokal(laporan.tanggalCatat)}
        </Text>
      ) : null}

      {laporan.pesanGagal != null ? (
        <Text style={[styles.barisPesan, { color: colors.destructive }]}>
          Ditolak server: {laporan.pesanGagal}
        </Text>
      ) : null}

      {laporan.catatanVerif != null ? (
        <Text style={[styles.barisPesan, { color: colors.mutedForeground }]}>
          Catatan verifikator: {laporan.catatanVerif}
        </Text>
      ) : null}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  statBaris: { flexDirection: 'row', gap: 10 },
  jarakKecil: { marginTop: 10 },
  jarak: { marginTop: 14 },
  tengah: { paddingVertical: 48, alignItems: 'center' },
  kosong: { fontSize: 12.5, textAlign: 'center', paddingVertical: 36, lineHeight: 19 },
  judulDaftar: { fontSize: 13, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  baris: { marginBottom: 8 },
  barisAtas: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barisNomor: { flex: 1, fontSize: 13, fontWeight: '600' },
  barisStatus: { fontSize: 11, fontWeight: '600' },
  barisNama: { fontSize: 12.5, marginTop: 4 },
  barisRincian: { fontSize: 11.5, marginTop: 4 },
  barisWaktu: { fontSize: 11, marginTop: 3 },
  barisPesan: { fontSize: 11.5, marginTop: 6, lineHeight: 17 },
});
