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
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  CheckCircle2,
  CloudUpload,
  Inbox,
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
import { GlassPanel, useTheme } from '@/components';
import { DialogKonfirmasi } from '@/features/petugas/dialog-konfirmasi';
import { WorkspaceScaffold } from '@/features/petugas/workspace';
import { daftarTertunda, hapusTertunda, kirimTertunda } from './repository';

export function AntreanUploadScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
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

  return (
    <WorkspaceScaffold
      judul="Upload Data"
      subjudul={`${antrean.length} hasil catat menunggu dikirim`}
      onBack={onBack}
      onSegarkan={() => void muat()}
      sedangMuat={memuat}
    >
      {memuat && antrean.length === 0 ? (
        <View style={styles.tengah}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : antrean.length === 0 ? (
        <View style={styles.kosong}>
          <CheckCircle2 size={40} color={colors.success} />
          <Text style={[styles.kosongJudul, { color: colors.foreground }]}>Antrean kosong</Text>
          <Text style={[styles.kosongTeks, { color: colors.mutedForeground }]}>
            Semua hasil catat sudah sampai di server. Tidak ada yang perlu dikerjakan di sini.
          </Text>
        </View>
      ) : (
        <>
          <GlassPanel padding={14}>
            <View style={styles.ringkasBaris}>
              <Inbox size={20} color={adaGagal ? colors.destructive : colors.foreground} />
              <View style={styles.ringkasTeks}>
                <Text style={[styles.ringkasJudul, { color: colors.foreground }]}>
                  {antrean.length} laporan menunggu
                </Text>
                <Text style={[styles.ringkasIsi, { color: colors.mutedForeground }]}>
                  {adaGagal
                    ? 'Sebagian ditolak server — baca pesannya di bawah sebelum mencoba lagi.'
                    : 'Kirim saat sinyal sedang bagus. Baris yang gagal tetap tersimpan.'}
                </Text>
              </View>
            </View>
          </GlassPanel>

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

          <Button onPress={kirim} disabled={mengirim} className="mt-4 h-12 w-full">
            {mengirim ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <CloudUpload size={16} color={colors.primaryForeground} />
            )}
            <UIText>{mengirim ? 'Mengirim…' : `Kirim ${antrean.length} Laporan`}</UIText>
          </Button>

          <Text style={[styles.judulDaftar, { color: colors.foreground }]}>Isi antrean</Text>
          {antrean.map((entri) => (
            <BarisAntrean
              key={entri.idAntrean ?? nomorLanggananAntrean(entri)}
              entri={entri}
              onHapus={() => setAkanDihapus(entri)}
            />
          ))}
        </>
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
    </WorkspaceScaffold>
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
    <GlassPanel padding={14} style={styles.baris}>
      <View style={styles.barisAtas}>
        {gagal ? (
          <TriangleAlert size={16} color={colors.destructive} />
        ) : (
          <WifiOff size={16} color={colors.mutedForeground} />
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

      <Button variant="outline" onPress={onHapus} className="mt-3 h-9 w-full">
        <Trash2 size={14} color={colors.destructive} />
        <UIText style={{ color: colors.destructive }}>Buang dari antrean</UIText>
      </Button>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  tengah: { paddingVertical: 48, alignItems: 'center' },
  kosong: { paddingVertical: 44, alignItems: 'center', gap: 10 },
  kosongJudul: { fontSize: 16, fontWeight: '600' },
  kosongTeks: { fontSize: 12.5, textAlign: 'center', lineHeight: 19 },

  ringkasBaris: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ringkasTeks: { flex: 1 },
  ringkasJudul: { fontSize: 14, fontWeight: '600' },
  ringkasIsi: { fontSize: 11.5, marginTop: 3, lineHeight: 17 },

  jarak: { marginTop: 14 },
  judulDaftar: { fontSize: 13, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  baris: { marginBottom: 8 },
  barisAtas: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barisNomor: { flex: 1, fontSize: 13, fontWeight: '600' },
  barisPeriode: { fontSize: 11 },
  barisRincian: { fontSize: 11.5, marginTop: 6 },
  pesanGagal: { fontSize: 11.5, marginTop: 6, lineHeight: 17 },
});
