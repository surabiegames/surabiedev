/**
 * cadangan-screen.tsx — bundel cadangan hasil catat di perangkat, dan jalan
 * PEMULIHAN bila antrean SQLite hilang. Padanan `cadangan_screen.dart`.
 *
 * Layar ini jarang dipakai dan justru itu maksudnya: ia jaring pengaman.
 * Setiap kali petugas menyimpan catatan, salinan lengkapnya ditulis sebagai
 * berkas biasa DI LUAR database. Kalau database lokal rusak — dan itu pernah
 * terjadi — hasil kerja sehari penuh masih bisa dikembalikan ke antrean dari
 * sini, alih-alih hilang dan harus didatangi ulang satu per satu.
 *
 * PERBEDAAN DISENGAJA dari versi Flutter: ekspor ZIP dan publikasi ke galeri
 * belum diport. ZIP butuh pustaka arsip native, dan publikasi galeri butuh
 * MediaStore. Yang dibagikan di sini adalah CSV catatan — berkas yang memang
 * diimpor dashboard web; fotonya tetap ada di folder cadangan dan bisa
 * diambil lewat pengelola berkas.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import {
  Archive,
  CheckCircle2,
  ChevronLeft,
  FileText,
  FolderOpen,
  RotateCcw,
  RotateCw,
  Share2,
  TriangleAlert,
} from 'lucide-react-native';
import { labelPeriode } from '@workspace/mobile-core';
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
import { IsiStrip, LayarGradasi } from '@/features/petugas/layar-gradasi';
import { CompactStat } from '@/features/petugas/workspace';
import { daftarBundel, daftarCsvCatatan, lokasiFolder, type BundelPembacaan } from './backup';
import { pulihkanDariCadangan } from './repository';

export function CadanganScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [bundel, setBundel] = useState<BundelPembacaan[]>([]);
  const [csv, setCsv] = useState<{ nama: string; uri: string; periode: number }[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [tanyaPulihkan, setTanyaPulihkan] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      setBundel(await daftarBundel());
      setCsv(daftarCsvCatatan());
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const belumTerunggah = bundel.filter((b) => !b.terunggah).length;
  const folder = lokasiFolder();

  const bagikan = async (uri: string) => {
    setGalat(null);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        setGalat('Perangkat ini tidak menyediakan menu berbagi berkas.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    } catch {
      setGalat('Berkas tidak dapat dibagikan — coba ambil manual dari folder cadangan.');
    }
  };

  return (
    <LayarGradasi
      judul="Cadangan"
      subjudul="Jaring pengaman hasil catat di perangkat"
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
      strip={
        <IsiStrip
          kiri={`${bundel.length} bundel tersimpan`}
          kanan={belumTerunggah > 0 ? `${belumTerunggah} belum terunggah` : null}
        />
      }
      onSegarkan={() => void muat()}
      sedangMuat={memuat}
    >
      <View style={styles.statBaris}>
        <CompactStat label="Bundel tersimpan" nilai={String(bundel.length)} ikon={Archive} />
        <CompactStat
          label="Belum terunggah"
          nilai={String(belumTerunggah)}
          ikon={TriangleAlert}
          bahaya={belumTerunggah > 0}
        />
      </View>

      {pesan != null ? (
        <View style={styles.jarak}>
          <Alert icon={CheckCircle2}>
            <AlertTitle>Selesai</AlertTitle>
            <AlertDescription>{pesan}</AlertDescription>
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

      <GlassPanel padding={Spasi.lg} style={styles.jarak}>
        <View style={styles.judulBaris}>
          <RotateCcw size={UkuranIkon.besar} color={colors.foreground} />
          <Text style={[styles.judulKartu, { color: colors.foreground }]}>
            Pulihkan ke antrean
          </Text>
        </View>
        <Text style={[styles.isiKartu, { color: colors.mutedForeground }]}>
          Kembalikan hasil catat yang belum terunggah ke antrean kirim. Bundel yang sudah aman di
          server dilewati, begitu juga yang masih ada di antrean — jadi menekan ini tidak akan
          pernah menggandakan laporan.
        </Text>
        <Button
          variant="outline"
          onPress={() => setTanyaPulihkan(true)}
          disabled={belumTerunggah === 0}
          className={`mt-3 ${Kelas.tombol}`}
        >
          <RotateCcw size={UkuranIkon.kecil} color={colors.foreground} />
          <UIText className={Kelas.tombolTeks}>
            {belumTerunggah === 0
              ? 'Tidak ada yang perlu dipulihkan'
              : `Pulihkan ${belumTerunggah} pembacaan`}
          </UIText>
        </Button>
      </GlassPanel>

      <GlassPanel padding={Spasi.lg} style={styles.jarak}>
        <View style={styles.judulBaris}>
          <FileText size={UkuranIkon.besar} color={colors.foreground} />
          <Text style={[styles.judulKartu, { color: colors.foreground }]}>Berkas catatan (CSV)</Text>
        </View>
        <Text style={[styles.isiKartu, { color: colors.mutedForeground }]}>
          Ringkasan teks seluruh pencatatan per periode — inilah yang diimpor di dashboard web bila
          data perlu dimasukkan manual.
        </Text>
        {csv.length === 0 ? (
          <Text style={[styles.kosongKecil, { color: colors.mutedForeground }]}>
            Belum ada berkas catatan. Ia terbentuk sendiri saat Anda menyimpan pencatatan pertama.
          </Text>
        ) : (
          csv.map((f) => (
            <View key={f.uri} style={[styles.barisCsv, { borderColor: colors.border }]}>
              <View style={styles.barisCsvTeks}>
                <Text style={[styles.csvNama, { color: colors.foreground }]}>
                  {labelPeriode(f.periode)}
                </Text>
                <Text style={[styles.csvBerkas, { color: colors.mutedForeground }]}>{f.nama}</Text>
              </View>
              <Button variant="outline" onPress={() => void bagikan(f.uri)} className={Kelas.tombolBaris}>
                <Share2 size={UkuranIkon.kecil} color={colors.foreground} />
                <UIText className={Kelas.tombolTeks}>Bagikan</UIText>
              </Button>
            </View>
          ))
        )}
      </GlassPanel>

      {folder != null ? (
        <GlassPanel padding={Spasi.lg} style={styles.jarak}>
          <View style={styles.judulBaris}>
            <FolderOpen size={UkuranIkon.besar} color={colors.mutedForeground} />
            <Text style={[styles.judulKartu, { color: colors.foreground }]}>Lokasi berkas</Text>
          </View>
          <Text style={[styles.jalur, { color: colors.mutedForeground }]}>{folder}</Text>
          <Text style={[styles.isiKartu, { color: colors.mutedForeground }]}>
            Foto bukti tersimpan di sini per jenis (stand / segel / rumah / video). Bisa diambil
            lewat pengelola berkas bila perlu diserahkan manual ke kantor.
          </Text>
        </GlassPanel>
      ) : null}

      {memuat && bundel.length === 0 ? (
        <View style={styles.tengah}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      <DialogKonfirmasi
        visible={tanyaPulihkan}
        judul="Pulihkan ke Antrean?"
        deskripsi={`${belumTerunggah} pembacaan yang belum terunggah akan dikembalikan ke antrean kirim, lalu bisa diunggah lewat menu Upload Data.`}
        labelKonfirmasi="Pulihkan"
        onTutup={() => setTanyaPulihkan(false)}
        onKonfirmasi={async () => {
          setGalat(null);
          try {
            const n = await pulihkanDariCadangan();
            setPesan(
              n === 0
                ? 'Tidak ada yang perlu dipulihkan — semuanya sudah aman atau sudah ada di antrean.'
                : `${n} pembacaan dikembalikan ke antrean. Buka Upload Data untuk mengirimnya.`,
            );
            await muat();
          } catch {
            setGalat('Pemulihan gagal — berkas cadangan tidak terbaca.');
          }
        }}
      />
    </LayarGradasi>
  );
}

const styles = StyleSheet.create({
  ditekan: { opacity: 0.7 },
  statBaris: { flexDirection: 'row', gap: Spasi.md },
  jarak: { marginTop: Spasi.lg },
  tengah: { paddingVertical: Spasi.xxl, alignItems: 'center' },
  judulBaris: { flexDirection: 'row', alignItems: 'center', gap: Spasi.sm },
  judulKartu: { fontSize: Teks.base, fontWeight: Berat.semi },
  isiKartu: { fontSize: Teks.xs, lineHeight: TinggiBaris.xs, marginTop: Spasi.sm },
  kosongKecil: { fontSize: Teks.xs, marginTop: Spasi.md, lineHeight: TinggiBaris.xs },
  jalur: { fontSize: Teks.xs, marginTop: Spasi.sm },
  barisCsv: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.md,
    paddingVertical: Spasi.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spasi.md,
  },
  barisCsvTeks: { flex: 1 },
  csvNama: { fontSize: Teks.sm, fontWeight: Berat.semi },
  csvBerkas: { fontSize: Teks.xs, marginTop: 2 },
});
