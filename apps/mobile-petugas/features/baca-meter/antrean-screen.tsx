/**
 * antrean-screen.tsx — Upload Data: antrean hasil catat yang belum sampai
 * server. Padanan `antrean_upload_screen.dart`.
 *
 * KENAPA ANTREAN INI TERLIHAT. Di Aurora, hasil catat yang ditolak server
 * bisa lenyap tanpa jejak dan baru ketahuan saat closing — pekerjaan sehari
 * hilang tanpa ada yang tahu. Di sini setiap baris tetap ada beserta PESAN
 * GAGAL dari server, sehingga petugas melihat persis apa yang belum beres dan
 * bisa memperbaikinya selagi masih ingat rumahnya yang mana.
 *
 * Menghapus baris = membuang hasil kerja. Karena itu selalu lewat konfirmasi,
 * dan tidak pernah terjadi sebagai efek samping tindakan lain.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle2,
  ChevronLeft,
  CloudUpload,
  Inbox,
  RotateCw,
  Trash2,
  TriangleAlert,
  WifiOff,
} from 'lucide-react-native';
import {
  ApiException,
  formatWaktuLokal,
  labelPeriode,
  nomorLanggananAntrean,
  periodeAntrean,
  type CatatTertunda,
} from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Text as UIText } from '@/components/ui/text';
import {
  Berat,
  GlassPanel,
  Kelas,
  Spasi,
  Teks,
  TinggiBaris,
  UkuranIkon,
  useTheme,
} from '@/components';
import { DialogKonfirmasi } from '@/features/petugas/dialog-konfirmasi';
import { IsiStrip, LayarGradasi, PADDING_ISI } from '@/features/petugas/layar-gradasi';
import { daftarTertunda, hapusTertunda, kirimTertunda } from './repository';

export function AntreanUploadScreen({ onBack }: { onBack?: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [antrean, setAntrean] = useState<CatatTertunda[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [mengirim, setMengirim] = useState(false);
  const [hasil, setHasil] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [akanDihapus, setAkanDihapus] = useState<CatatTertunda | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      setAntrean(await daftarTertunda());
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const kirim = async () => {
    setMengirim(true);
    setHasil(null);
    setGalat(null);
    try {
      const r = await kirimTertunda();
      const bagian: string[] = [];
      if (r.terkirim > 0) bagian.push(`${r.terkirim} laporan terkirim`);
      if (r.gagal > 0) bagian.push(`${r.gagal} ditolak server`);
      if (r.terhentiOffline) bagian.push('sisanya menunggu sinyal');
      setHasil(
        bagian.length > 0
          ? `${bagian.join(' · ')}.`
          : 'Belum ada yang bisa dikirim — periksa koneksi Anda.',
      );
      await muat();
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal mengirim antrean.');
    } finally {
      setMengirim(false);
    }
  };

  const adaGagal = antrean.some((e) => e.pesanGagal != null);

  /*
   * Chrome layar (ringkasan, alert, tombol kirim) jadi kepala daftar, bukan
   * saudara sekandung di dalam ScrollView. Alasannya sama dengan
   * pelanggan-rute-screen: antrean bisa memuat satu rute penuh yang belum
   * terkirim — ribuan baris, masing-masing dengan tombol dan pesan gagal.
   * Dioper sebagai ELEMEN supaya tidak dipasang ulang tiap render.
   */
  const kepala = (
    <View style={styles.kepala}>
      {/*
        Jumlah antrean sudah ada di strip header, jadi kartu ringkasan lama
        dihapus — aturan tanpa aksi/informasi ganda. Yang tersisa hanya
        peringatan saat ADA yang ditolak, karena itu keadaan yang menuntut
        tindakan berbeda: baca pesannya dulu, jangan langsung kirim ulang.
      */}
      {adaGagal ? (
        <GlassPanel padding={Spasi.lg}>
          <View style={styles.ringkasBaris}>
            <Inbox size={UkuranIkon.besar} color={colors.destructive} />
            <Text style={[styles.ringkasIsi, { flex: 1, color: colors.mutedForeground }]}>
              Sebagian ditolak server — baca pesannya di bawah sebelum mencoba lagi.
            </Text>
          </View>
        </GlassPanel>
      ) : null}

      {hasil != null ? (
        <View style={styles.jarak}>
          <Alert icon={CheckCircle2}>
            <AlertTitle>Hasil kirim</AlertTitle>
            <AlertDescription>{hasil}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      {galat != null ? (
        <View style={styles.jarak}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Gagal</AlertTitle>
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      <Button onPress={kirim} disabled={mengirim} className={`mt-4 ${Kelas.tombol}`}>
        {mengirim ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <CloudUpload size={UkuranIkon.sedang} color={colors.primaryForeground} />
        )}
        <UIText className={Kelas.tombolTeks}>
          {mengirim ? 'Mengirim…' : `Kirim ${antrean.length} Laporan`}
        </UIText>
      </Button>

      <Text style={[styles.judulDaftar, { color: colors.foreground }]}>Isi antrean</Text>
    </View>
  );

  return (
    <LayarGradasi
      judul="Upload Data"
      subjudul="Hasil catat yang belum sampai server"
      kiri={
        onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            style={({ pressed }) => pressed && styles.ditekan}
          >
            <ChevronLeft size={22} color="#FFFFFF" />
          </Pressable>
        ) : null
      }
      kanan={
        <Pressable
          onPress={() => void muat()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Segarkan"
          style={({ pressed }) => pressed && styles.ditekan}
        >
          <RotateCw size={UkuranIkon.sedang} color="#FFFFFF" />
        </Pressable>
      }
      // Angka antrean naik ke strip supaya tetap terlihat saat daftar
      // digulir — ia yang menentukan petugas perlu menekan Kirim atau tidak.
      strip={
        <IsiStrip
          kiri={antrean.length === 0 ? 'Semua sudah terkirim' : `${antrean.length} laporan menunggu`}
          kanan={adaGagal ? `${antrean.filter((e) => e.pesanGagal != null).length} ditolak` : null}
        />
      }
      onSegarkan={() => void muat()}
      sedangMuat={memuat}
      gulir={antrean.length === 0}
    >
      {memuat && antrean.length === 0 ? (
        <View style={styles.tengah}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : antrean.length === 0 ? (
        <View style={styles.kosong}>
          <CheckCircle2 size={UkuranIkon.kosong} color={colors.success} />
          <Text style={[styles.kosongJudul, { color: colors.foreground }]}>Antrean kosong</Text>
          <Text style={[styles.kosongTeks, { color: colors.mutedForeground }]}>
            Semua hasil catat sudah sampai di server. Tidak ada yang perlu dikerjakan di sini.
          </Text>
        </View>
      ) : (
        <FlatList
          data={antrean}
          keyExtractor={(entri) => String(entri.idAntrean ?? nomorLanggananAntrean(entri))}
          ListHeaderComponent={kepala}
          contentContainerStyle={{
            paddingHorizontal: PADDING_ISI,
            paddingBottom: insets.bottom + Spasi.xl,
          }}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          refreshing={memuat}
          onRefresh={() => void muat()}
          renderItem={({ item }) => (
            <BarisAntrean entri={item} onHapus={() => setAkanDihapus(item)} />
          )}
        />
      )}

      <DialogKonfirmasi
        visible={akanDihapus != null}
        judul="Hapus dari Antrean?"
        deskripsi={
          akanDihapus == null
            ? ''
            : `Hasil catat ${nomorLanggananAntrean(akanDihapus)} akan DIBUANG dan tidak pernah sampai ke kantor. ` +
              'Pelanggan ini kembali berstatus belum dibaca, dan Anda harus mendatanginya lagi.'
        }
        labelKonfirmasi="Hapus"
        destruktif
        onTutup={() => setAkanDihapus(null)}
        onKonfirmasi={async () => {
          if (akanDihapus?.idAntrean != null) await hapusTertunda(akanDihapus.idAntrean);
          await muat();
        }}
      />
    </LayarGradasi>
  );
}

function BarisAntrean({
  entri,
  onHapus,
}: {
  entri: CatatTertunda;
  onHapus: () => void;
}) {
  const { colors } = useTheme();
  const gagal = entri.pesanGagal != null;
  const stand = entri.payload['standAkhir'];
  const jumlahBerkas = Object.keys(entri.fotoPaths).length;

  return (
    <GlassPanel padding={Spasi.lg} style={styles.baris}>
      <View style={styles.barisAtas}>
        {gagal ? (
          <TriangleAlert size={UkuranIkon.sedang} color={colors.destructive} />
        ) : (
          <WifiOff size={UkuranIkon.sedang} color={colors.mutedForeground} />
        )}
        <Text style={[styles.barisNomor, { color: colors.foreground }]}>
          {nomorLanggananAntrean(entri)}
        </Text>
        <Text style={[styles.barisPeriode, { color: colors.mutedForeground }]}>
          {labelPeriode(periodeAntrean(entri))}
        </Text>
      </View>

      <Text style={[styles.barisRincian, { color: colors.mutedForeground }]}>
        Stand {typeof stand === 'number' ? stand : '—'} ·{' '}
        {jumlahBerkas === 0 ? 'tanpa berkas' : `${jumlahBerkas} berkas`} ·{' '}
        {formatWaktuLokal(entri.dibuatPada)}
      </Text>

      {gagal ? (
        <Text style={[styles.pesanGagal, { color: colors.destructive }]}>
          Ditolak ({entri.percobaan}× dicoba): {entri.pesanGagal}
        </Text>
      ) : null}

      <Button variant="outline" onPress={onHapus} className={`mt-3 ${Kelas.tombol}`}>
        <Trash2 size={UkuranIkon.kecil} color={colors.destructive} />
        <UIText className={Kelas.tombolTeks} style={{ color: colors.destructive }}>
          Buang dari antrean
        </UIText>
      </Button>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  ditekan: { opacity: 0.7 },
  tengah: { paddingVertical: Spasi.xxl + Spasi.lg, alignItems: 'center' },
  kosong: { paddingVertical: Spasi.xxl + Spasi.md, alignItems: 'center', gap: Spasi.md },
  kosongJudul: { fontSize: Teks.base, fontWeight: Berat.semi },
  kosongTeks: { fontSize: Teks.sm, textAlign: 'center', lineHeight: TinggiBaris.sm },
  kepala: { paddingBottom: Spasi.xs },

  ringkasBaris: { flexDirection: 'row', alignItems: 'flex-start', gap: Spasi.md },
  ringkasIsi: { fontSize: Teks.xs, marginTop: Spasi.xs, lineHeight: TinggiBaris.xs },

  jarak: { marginTop: Spasi.lg },
  judulDaftar: {
    fontSize: Teks.base,
    fontWeight: Berat.tebal,
    marginTop: Spasi.xl,
    marginBottom: Spasi.md,
  },
  baris: { marginBottom: Spasi.md },
  barisAtas: { flexDirection: 'row', alignItems: 'center', gap: Spasi.sm },
  barisNomor: { flex: 1, fontSize: Teks.sm, fontWeight: Berat.semi },
  barisPeriode: { fontSize: Teks.xs },
  barisRincian: { fontSize: Teks.xs, marginTop: Spasi.sm, lineHeight: TinggiBaris.xs },
  pesanGagal: { fontSize: Teks.xs, marginTop: Spasi.sm, lineHeight: TinggiBaris.xs },
});
