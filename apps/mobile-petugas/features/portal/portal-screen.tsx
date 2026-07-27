/**
 * portal-screen.tsx — Portal Petugas, pintu masuk yang MEMISAHKAN dua peran
 * lapangan. Padanan `features/staff/portal/portal_screen.dart`.
 *
 *   • Pencatat Meter   — rute baca, catat stand, unduh & unggah data
 *   • Petugas Gangguan — tiket pengaduan warga, SLA, tindak lanjut
 *
 * Verifikasi laporan BUKAN di sini: itu ranah supervisor ke atas di dashboard
 * web. Aplikasi lapangan hanya menghasilkan data, tidak pernah meloloskannya.
 */
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  ChevronRight,
  ClipboardCheck,
  Clock,
  CloudUpload,
  Gauge,
  LogOut,
  Map as MapIcon,
  Ticket,
  Wrench,
} from 'lucide-react-native';
import {
  ApiConfig,
  SesiPetugas,
  formatTanggalUtc,
  type RuteSaya,
} from '@workspace/mobile-core';
import { GlassPanel, MasterPalette as P, PremiumBackground, useTheme } from '@/components';
import { jumlahTertunda, ruteSaya } from '@/features/baca-meter/repository';
import { tiketSaya, type TiketStaf } from '@/features/gangguan/repository';
import { DialogKonfirmasi } from '@/features/petugas/dialog-konfirmasi';
import { ScrollAman } from '@/features/petugas/scroll-aman';
import { MiniStat, SquircleIcon, type Ikon } from '@/features/petugas/workspace';

/** Status tiket yang masih menuntut tindakan petugas. */
const STATUS_AKTIF = new Set(['DITUGASKAN', 'DIPROSES', 'DIBUKA_KEMBALI']);

interface AngkaPortal {
  ruteTerbaca: number;
  ruteTotal: number;
  dicatatSaya: number;
  antreKirim: number;
  tiketAktif: number;
  tiketLewatSla: number;
}

const ANGKA_KOSONG: AngkaPortal = {
  ruteTerbaca: 0,
  ruteTotal: 0,
  dicatatSaya: 0,
  antreKirim: 0,
  tiketAktif: 0,
  tiketLewatSla: 0,
};

export function PortalScreen({
  onBukaPencatat,
  onBukaGangguan,
  onKeluar,
}: {
  onBukaPencatat: () => void;
  onBukaGangguan: () => void;
  onKeluar: () => void;
}) {
  const { colors } = useTheme();
  const [angka, setAngka] = useState<AngkaPortal>(ANGKA_KOSONG);
  const [tanyaKeluar, setTanyaKeluar] = useState(false);

  /**
   * Setiap sumber dimuat TOLERAN: bagian yang gagal dihitung nol. Portal
   * tidak boleh gagal tampil hanya karena satu sumber data sedang mati —
   * petugas tetap harus bisa masuk ke ruang kerjanya.
   */
  const muat = useCallback(async () => {
    // Cache (segarkan: false) — paket rute sudah diunduh; portal tidak perlu
    // menembak jaringan tiap kali dibuka, itu penyebab lemot berpindah layar.
    const [paket, antre, tiket] = await Promise.all([
      ruteSaya({ segarkan: false }).catch((): RuteSaya | null => null),
      jumlahTertunda().catch(() => 0),
      tiketSaya().catch((): TiketStaf[] => []),
    ]);
    setAngka({
      ruteTerbaca: paket?.terbaca ?? 0,
      ruteTotal: paket?.target ?? 0,
      dicatatSaya: paket?.dicatatSaya ?? 0,
      antreKirim: antre,
      tiketAktif: tiket.filter((t) => STATUS_AKTIF.has(t.status)).length,
      tiketLewatSla: tiket.filter((t) => t.lewatSla).length,
    });
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  // Segarkan angka tiap kali portal kembali ke depan — petugas baru saja
  // mencatat sesuatu di layar sebelah, dan angkanya harus ikut berubah.
  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat]),
  );

  const hariIni = new Date();
  const nama = SesiPetugas.akun?.name;

  return (
    <PremiumBackground>
      <ScrollAman maxWidth={560}>
        <View style={styles.kepala}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.kepalaTeks}>
            <Text style={[styles.merek, { color: colors.mutedForeground }]}>
              PERUMDA TIRTAWENING
            </Text>
            <Text style={[styles.judul, { color: colors.foreground }]}>Portal Petugas</Text>
          </View>
          {ApiConfig.isDemo ? (
            <View style={[styles.pilDemo, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.pilDemoTeks, { color: colors.mutedForeground }]}>DEMO</Text>
            </View>
          ) : (
            <Pressable
              hitSlop={10}
              accessibilityLabel="Keluar dari akun"
              onPress={() => setTanyaKeluar(true)}
              style={({ pressed }) => [styles.tombolKeluar, pressed && { opacity: 0.55 }]}
            >
              <LogOut size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        <Text style={[styles.sapaan, { color: colors.mutedForeground }]}>
          {nama ? `Selamat bertugas, ${nama}` : 'Selamat bertugas'} ·{' '}
          {formatTanggalUtc(
            new Date(Date.UTC(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate())),
          )}
        </Text>

        <Text style={[styles.seksi, { color: colors.mutedForeground }]}>PILIH RUANG KERJA</Text>

        <KartuRuang
          ikon={Gauge}
          gradasi={[P.teal, P.teal600]}
          judul="Pencatat Meter"
          deskripsi="Rute baca meter, catat stand, unduh & unggah data"
          onPress={onBukaPencatat}
          chips={
            <>
              <MiniStat
                ikon={MapIcon}
                label={`${angka.ruteTerbaca}/${angka.ruteTotal} SL`}
              />
              <MiniStat ikon={ClipboardCheck} label={`${angka.dicatatSaya} dicatat`} />
              {angka.antreKirim > 0 ? (
                <MiniStat ikon={CloudUpload} label={`${angka.antreKirim} antre kirim`} bahaya />
              ) : null}
            </>
          }
        />

        <View style={styles.jarak} />

        <KartuRuang
          ikon={Wrench}
          gradasi={[P.rose400, P.rose600]}
          judul="Petugas Gangguan"
          deskripsi="Tiket pengaduan warga, SLA, tindak lanjut lapangan"
          onPress={onBukaGangguan}
          chips={
            <>
              <MiniStat ikon={Ticket} label={`${angka.tiketAktif} aktif`} />
              {angka.tiketLewatSla > 0 ? (
                <MiniStat ikon={Clock} label={`${angka.tiketLewatSla} lewat SLA`} bahaya />
              ) : null}
            </>
          }
        />

        <Text style={[styles.versi, { color: colors.mutedForeground }]}>
          Tirtawening Petugas · v1.0
        </Text>
      </ScrollAman>

      <DialogKonfirmasi
        visible={tanyaKeluar}
        judul="Keluar dari Akun"
        deskripsi={
          'Sesi di perangkat ini akan dihapus. Rute yang sudah diunduh dan hasil catat ' +
          'yang belum terunggah TETAP tersimpan — keduanya kembali begitu Anda masuk lagi.'
        }
        labelKonfirmasi="Keluar"
        destruktif
        onTutup={() => setTanyaKeluar(false)}
        onKonfirmasi={async () => {
          await SesiPetugas.keluar();
          onKeluar();
        }}
      />
    </PremiumBackground>
  );
}

function KartuRuang({
  ikon,
  gradasi,
  judul,
  deskripsi,
  chips,
  onPress,
}: {
  ikon: Ikon;
  gradasi: readonly [string, string];
  judul: string;
  deskripsi: string;
  chips: React.ReactNode;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <GlassPanel onPress={onPress}>
      <View style={styles.ruangBaris}>
        <SquircleIcon ikon={ikon} gradasi={gradasi} ukuran={56} />
        <View style={styles.ruangTeks}>
          <Text style={[styles.ruangJudul, { color: colors.foreground }]}>{judul}</Text>
          <Text style={[styles.ruangDeskripsi, { color: colors.mutedForeground }]}>
            {deskripsi}
          </Text>
          <View style={styles.chips}>{chips}</View>
        </View>
        <ChevronRight size={18} color={colors.mutedForeground} />
      </View>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingTop: 10 },
  logo: { width: 46, height: 46 },
  kepalaTeks: { flex: 1 },
  merek: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.4 },
  judul: { fontSize: 24, fontWeight: '700', marginTop: 2 },
  pilDemo: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pilDemoTeks: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  sapaan: { fontSize: 13, marginTop: 6, paddingLeft: 60 },
  seksi: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 26, marginBottom: 12 },
  jarak: { height: 14 },
  ruangBaris: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ruangTeks: { flex: 1 },
  ruangJudul: { fontSize: 16, fontWeight: '600' },
  ruangDeskripsi: { fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  versi: { fontSize: 11, textAlign: 'center', marginTop: 24 },
  tombolKeluar: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
