/**
 * catat-screen.tsx — layar entri stand untuk SATU pelanggan rute. Padanan
 * `features/staff/baca_meter/catat_meter_screen.dart`, yang sendiri mengikuti
 * `CatatStandFragment` Aurora.
 *
 * Anatomi & guard-nya sengaja dipertahankan karena semuanya lahir dari
 * kejadian nyata di lapangan:
 *
 *   stand lalu → stand akhir dengan pemakaian & deviasi LIVE → kondisi
 *   kelainan → segel → usulan perubahan → 3 slot foto + video → jarak GPS
 *   live → riwayat 3 periode → estimasi tagihan → konfirmasi → simpan.
 *
 * TIGA GUARD YANG TIDAK BOLEH DILONGGARKAN:
 *   1. Stand MUNDUR hanya sah untuk kondisi meter bermasalah — selain itu
 *      server menolak 400, jadi menahannya di sini menghemat perjalanan
 *      bolak-balik petugas.
 *   2. Foto stand WAJIB untuk pembacaan Normal — foto itulah yang kelak jadi
 *      bukti saat verifikasi mempertanyakan angkanya.
 *   3. Konfirmasi sebelum simpan menampilkan SELURUH yang akan terkirim.
 *      Sekali tersimpan, baris ini masuk antrean dan menjadi hasil kerja.
 *
 * PERBEDAAN DISENGAJA dari versi Flutter: OCR angka stand dari foto belum
 * diport (butuh ML Kit native yang tidak ada padanannya di Expo tanpa modul
 * kustom). Slot fotonya tetap sama; angkanya diketik petugas.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Images,
  MapPin,
  MapPinOff,
  Trash2,
  TriangleAlert,
  User,
} from 'lucide-react-native';
import {
  ApiConfig,
  ApiException,
  formatRupiah,
  kondisiSahMundur,
  labelDari,
  labelKategoriPembacaan,
  labelKondisiMeter,
  labelPeriode,
  type JenisBerkas,
  type PelangganRute,
} from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Text as UIText } from '@/components/ui/text';
import { AppDialog } from '@/components/ui/app-dialog';
import { GlassPanel, MasterPalette as P, useTheme } from '@/components';
import { WorkspaceScaffold, SquircleIcon } from '@/features/petugas/workspace';
import { MediaError, ambilFoto, ambilVideo, type SumberMedia } from '@/features/shared/media';
import { simpanSalinanFoto } from './backup';
import { jarakMeter, layananAktif, pantauPosisi, posisiSekarang, type Posisi } from './lokasi';
import { catat, periodeCatatSekarang, standTerakhir } from './repository';
import { estimasiUangAir, tarifUntukGolongan, type TarifGolonganMobile } from './tarif';

/**
 * Ambang peringatan deviasi di UI. Nilai RESMI milik server (endpoint stats);
 * ini hanya peringatan dini supaya petugas memeriksa ulang angkanya selagi
 * masih berdiri di depan meter.
 */
const AMBANG_PERINGATAN = 50;

const LABEL_SLOT: Record<JenisBerkas, string> = {
  stand: 'Stand Meter',
  segel: 'Segel',
  rumah: 'Rumah',
  video: 'Video',
};

const SLOT_FOTO: JenisBerkas[] = ['stand', 'segel', 'rumah'];

export function CatatMeterScreen({
  pelanggan,
  urutanKunjungan = [],
  onBack,
  onSelesai,
  onPindah,
}: {
  pelanggan: PelangganRute;
  /** Daftar pelanggan tab aktif, urut kunjungan — dasar tombol sebelum/berikutnya. */
  urutanKunjungan?: PelangganRute[];
  onBack: () => void;
  /** Dipanggil setelah tersimpan dan petugas memilih kembali ke daftar. */
  onSelesai: () => void;
  /** Pindah ke pelanggan lain tanpa menumpuk layar. */
  onPindah: (nomorLangganan: string) => void;
}) {
  const { colors } = useTheme();

  const [standLalu, setStandLalu] = useState<number | null>(null);
  const [memuatStand, setMemuatStand] = useState(true);
  const [teksStand, setTeksStand] = useState('');
  const [kondisi, setKondisi] = useState('NORMAL');
  const [kategori, setKategori] = useState('ONSITE');
  /** null = tidak diperiksa; true/false = kondisi segel yang ditemukan. */
  const [isSegel, setIsSegel] = useState<boolean | null>(null);
  const [usulan, setUsulan] = useState('');
  const [noHp, setNoHp] = useState(pelanggan.notelp ?? '');

  const [fotoPaths, setFotoPaths] = useState<Partial<Record<JenisBerkas, string>>>({});
  const [memproses, setMemproses] = useState<JenisBerkas | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const [tarif, setTarif] = useState<TarifGolonganMobile | null>(null);
  const [posisi, setPosisi] = useState<Posisi | null>(null);

  const [slotDialog, setSlotDialog] = useState<JenisBerkas | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<string | null>(null);
  const [tanyaGps, setTanyaGps] = useState(false);
  const [tanyaLanjut, setTanyaLanjut] = useState<PelangganRute | null>(null);

  const periode = periodeCatatSekarang();
  const lepasPantau = useRef<(() => void) | null>(null);

  // ── Muat data pendukung ─────────────────────────────────────────────

  useEffect(() => {
    let batal = false;
    standTerakhir(pelanggan)
      .then((s) => {
        if (!batal) setStandLalu(s ?? pelanggan.standLalu);
      })
      .catch(() => {
        // Prefill hanya kenyamanan — biarkan kosong bila riwayat tak terbaca.
        if (!batal) setStandLalu(pelanggan.standLalu);
      })
      .finally(() => {
        if (!batal) setMemuatStand(false);
      });
    return () => {
      batal = true;
    };
  }, [pelanggan]);

  useEffect(() => {
    let batal = false;
    tarifUntukGolongan(pelanggan.golonganTarif)
      .then((t) => {
        if (!batal) setTarif(t);
      })
      .catch(() => {
        // Estimasi tidak tampil; pencatatan jalan terus.
      });
    return () => {
      batal = true;
    };
  }, [pelanggan.golonganTarif]);

  const mulaiGps = useCallback(async () => {
    const awal = await posisiSekarang();
    if (awal != null) setPosisi(awal);
    lepasPantau.current?.();
    lepasPantau.current = await pantauPosisi(setPosisi);
  }, []);

  useEffect(() => {
    void mulaiGps();
    return () => {
      lepasPantau.current?.();
      lepasPantau.current = null;
    };
  }, [mulaiGps]);

  // ── Angka turunan ───────────────────────────────────────────────────

  const standAkhir = useMemo(() => {
    const n = Number.parseInt(teksStand, 10);
    return Number.isFinite(n) ? n : null;
  }, [teksStand]);

  const pemakaian = standAkhir != null && standLalu != null ? standAkhir - standLalu : null;

  const deviasi = useMemo(() => {
    const lalu = pelanggan.pemakaianLalu;
    if (pemakaian == null || lalu == null || lalu <= 0) return null;
    return ((pemakaian - lalu) / lalu) * 100;
  }, [pemakaian, pelanggan.pemakaianLalu]);

  const mundurTanpaKondisiSah = (pemakaian ?? 0) < 0 && !kondisiSahMundur.has(kondisi);
  const anomali = Math.abs(deviasi ?? 0) > AMBANG_PERINGATAN;

  const jarakKePelanggan = useMemo(() => {
    if (posisi == null || pelanggan.geoLat == null || pelanggan.geoLong == null) return null;
    return Math.round(
      jarakMeter(posisi.latitude, posisi.longitude, pelanggan.geoLat, pelanggan.geoLong),
    );
  }, [posisi, pelanggan.geoLat, pelanggan.geoLong]);

  const estimasiAir =
    pemakaian != null && pemakaian >= 0 ? estimasiUangAir(tarif, pemakaian) : null;

  /** Komponen tetap tagihan terakhir; null bila pelanggan belum pernah ditagih. */
  const biayaTetap =
    pelanggan.beaBeban == null && pelanggan.beaAdmin == null
      ? null
      : (pelanggan.beaBeban ?? 0) + (pelanggan.beaAdmin ?? 0);

  const estimasiTotal = estimasiAir == null ? null : estimasiAir + (biayaTetap ?? 0);

  // ── Navigasi urutan jalan ───────────────────────────────────────────

  const indeks = urutanKunjungan.findIndex(
    (p) => p.nomorLangganan === pelanggan.nomorLangganan,
  );
  const sebelumnya = indeks > 0 ? urutanKunjungan[indeks - 1] : null;
  const berikutnya =
    indeks >= 0 && indeks + 1 < urutanKunjungan.length ? urutanKunjungan[indeks + 1] : null;

  /** Berikutnya yang BELUM dibaca — yang baru saja disimpan dilewati. */
  const berikutnyaBelumDibaca = (): PelangganRute | null => {
    if (indeks < 0) return null;
    for (let j = indeks + 1; j < urutanKunjungan.length; j++) {
      const kandidat = urutanKunjungan[j];
      if (kandidat != null && !kandidat.sudahDicatat) return kandidat;
    }
    return null;
  };

  // ── Berkas bukti ────────────────────────────────────────────────────

  const ambilBerkas = async (jenis: JenisBerkas, sumber: SumberMedia) => {
    setSlotDialog(null);
    setMemproses(jenis);
    setGalat(null);
    try {
      const mentah = jenis === 'video' ? await ambilVideo(sumber) : await ambilFoto(sumber);
      if (mentah == null) return;
      // Salinan di folder cadangan yang jadi path utama: cache picker bisa
      // dibersihkan OS kapan saja, dan antrean offline mungkin baru terkirim
      // berjam-jam kemudian.
      const disalin = await simpanSalinanFoto({
        jenis,
        periode,
        nomorLangganan: pelanggan.nomorLangganan,
        sumberPath: mentah,
      });
      setFotoPaths((f) => ({ ...f, [jenis]: disalin ?? mentah }));
    } catch (err) {
      setGalat(
        err instanceof MediaError
          ? err.message
          : 'Berkas tidak dapat diproses — coba ambil ulang.',
      );
    } finally {
      setMemproses(null);
    }
  };

  const hapusBerkas = (jenis: JenisBerkas) => {
    setSlotDialog(null);
    setFotoPaths((f) => {
      const salin = { ...f };
      delete salin[jenis];
      return salin;
    });
  };

  // ── Simpan ──────────────────────────────────────────────────────────

  const susunRingkasan = (): string => {
    const gantiNoHp = noHp.trim().length > 0 && noHp.trim() !== (pelanggan.notelp ?? '');
    const standDikirim = standAkhir ?? standLalu ?? 0;
    const baris = [
      `${pelanggan.nama} · ${pelanggan.nomorLangganan}`,
      `Stand ${standLalu} → ${standDikirim} (pemakaian ${pemakaian ?? 0} m³` +
        (deviasi == null
          ? ')'
          : `, ${deviasi >= 0 ? '+' : ''}${deviasi.toFixed(0)}% dari bulan lalu)`),
      `Keterangan: ${labelDari(labelKondisiMeter, kondisi)} · ${labelDari(labelKategoriPembacaan, kategori)}`,
    ];
    if (isSegel != null) baris.push(`Segel: ${isSegel ? 'tersegel' : 'tidak tersegel'}`);
    if (jarakKePelanggan != null) baris.push(`Jarak ke titik pelanggan: ±${jarakKePelanggan} m`);
    if (gantiNoHp) baris.push(`No. HP diperbarui: ${noHp.trim()}`);
    if (usulan.trim().length > 0) baris.push(`Usulan perubahan: ${usulan.trim()}`);
    const berkas = Object.keys(fotoPaths) as JenisBerkas[];
    baris.push(
      `Berkas: ${berkas.length === 0 ? 'tidak ada' : berkas.map((j) => LABEL_SLOT[j]).join(', ')}`,
    );
    if (estimasiAir != null && biayaTetap != null) {
      baris.push(
        `Estimasi tagihan: ${formatRupiah(estimasiTotal!)} (air ${formatRupiah(estimasiAir)} + beban & admin ${formatRupiah(biayaTetap)} — angka resmi dihitung sistem)`,
      );
    } else if (estimasiAir != null) {
      baris.push(
        `Estimasi uang air: ${formatRupiah(estimasiAir)} (belum termasuk beban & admin — angka resmi dihitung sistem)`,
      );
    }
    return baris.join('\n');
  };

  const periksaLaluKonfirmasi = async () => {
    // Stand kosong SAH untuk kondisi kelainan (rumah kosong, meter rusak) —
    // Aurora mengonfirmasi, tidak memblokir.
    if (standAkhir == null && kondisi === 'NORMAL') {
      setGalat('Isi angka stand, atau pilih kondisi kelainan bila meter tidak bisa dibaca.');
      return;
    }
    if (standLalu == null) {
      setGalat('Stand lalu tidak tersedia — catat lewat dashboard web.');
      return;
    }
    if (mundurTanpaKondisiSah) {
      setGalat(
        'Stand mundur hanya sah untuk kondisi meter bermasalah — pilih kondisi yang sesuai.',
      );
      return;
    }
    if (!ApiConfig.isDemo && kondisi === 'NORMAL' && fotoPaths.stand == null) {
      setGalat(
        'Foto stand meter wajib untuk pembacaan Normal — ambil lewat slot Berkas Bukti.',
      );
      return;
    }
    // Guard GPS ala Aurora (checkGPS sebelum simpan), bedanya petugas boleh
    // memilih lanjut TANPA GPS secara sadar; server tetap menerima laporannya,
    // hanya tanpa bukti kehadiran.
    if (!ApiConfig.isDemo && posisi == null) {
      const aktif = await layananAktif();
      if (!aktif || posisi == null) {
        setTanyaGps(true);
        return;
      }
    }
    setGalat(null);
    setKonfirmasi(susunRingkasan());
  };

  const simpan = async () => {
    setKonfirmasi(null);
    if (standLalu == null) return;
    setMengirim(true);
    setGalat(null);
    try {
      const gantiNoHp = noHp.trim().length > 0 && noHp.trim() !== (pelanggan.notelp ?? '');
      await catat({
        pelanggan,
        periode,
        standAwal: standLalu,
        // Kelainan tanpa angka: stand tetap di angka lalu (pemakaian 0).
        standAkhir: standAkhir ?? standLalu,
        kondisi,
        kategori,
        fotoPaths,
        latCatat: posisi?.latitude ?? null,
        longCatat: posisi?.longitude ?? null,
        isSegel,
        usulanPerubahan: usulan.trim().length > 0 ? usulan.trim() : null,
        notelpBaru: gantiNoHp ? noHp.trim() : null,
      });
      // Alur jalan Aurora: selesai satu rumah → tawarkan rumah berikutnya yang
      // belum dibaca, tanpa harus kembali ke daftar dulu.
      const berikut = berikutnyaBelumDibaca();
      if (berikut != null) {
        setTanyaLanjut(berikut);
        setMengirim(false);
        return;
      }
      onSelesai();
    } catch (err) {
      setGalat(
        err instanceof ApiException && err.isConflict
          ? 'Pelanggan ini sudah dicatat untuk periode berjalan. Kembali dan muat ulang daftar.'
          : err instanceof ApiException
            ? err.message
            : 'Gagal menyimpan — coba lagi.',
      );
      setMengirim(false);
    }
  };

  // ── Tampilan ────────────────────────────────────────────────────────

  return (
    <WorkspaceScaffold
      judul="Catat Meter"
      subjudul={labelPeriode(periode)}
      onBack={onBack}
    >
      <KartuIdentitas
        pelanggan={pelanggan}
        posisi={posisi}
        jarak={jarakKePelanggan}
      />

      <KartuStand
        standLalu={standLalu}
        memuatStand={memuatStand}
        teksStand={teksStand}
        onUbahStand={setTeksStand}
        pemakaian={pemakaian}
        deviasi={deviasi}
        anomali={anomali}
        mundurTanpaKondisiSah={mundurTanpaKondisiSah}
        pemakaianLalu={pelanggan.pemakaianLalu}
      />

      {pelanggan.riwayat.length > 0 ? <KartuRiwayat pelanggan={pelanggan} /> : null}

      <KartuPilihan
        kondisi={kondisi}
        onKondisi={setKondisi}
        kategori={kategori}
        onKategori={setKategori}
        isSegel={isSegel}
        onSegel={setIsSegel}
      />

      <KartuBerkas
        fotoPaths={fotoPaths}
        memproses={memproses}
        onBukaSlot={setSlotDialog}
      />

      <KartuTambahan
        noHp={noHp}
        onNoHp={setNoHp}
        usulan={usulan}
        onUsulan={setUsulan}
      />

      {estimasiAir != null ? (
        <KartuEstimasi
          estimasiAir={estimasiAir}
          biayaTetap={biayaTetap}
          estimasiTotal={estimasiTotal}
        />
      ) : null}

      {galat != null ? (
        <View style={styles.jarakAtas}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Belum bisa disimpan</AlertTitle>
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      <Button onPress={periksaLaluKonfirmasi} disabled={mengirim} className="mt-4 h-12 w-full">
        {mengirim ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : null}
        <UIText>{mengirim ? 'Menyimpan…' : 'Simpan Hasil Baca'}</UIText>
      </Button>

      <View style={styles.navUrutan}>
        <Button
          variant="outline"
          disabled={sebelumnya == null}
          onPress={() => sebelumnya && onPindah(sebelumnya.nomorLangganan)}
          className="flex-1"
        >
          <ChevronLeft size={15} color={colors.foreground} />
          <UIText>Sebelumnya</UIText>
        </Button>
        <Button
          variant="outline"
          disabled={berikutnya == null}
          onPress={() => berikutnya && onPindah(berikutnya.nomorLangganan)}
          className="flex-1"
        >
          <UIText>Berikutnya</UIText>
          <ChevronRight size={15} color={colors.foreground} />
        </Button>
      </View>

      {/* ── Dialog ── */}

      <AppDialog
        visible={slotDialog != null}
        onDismiss={() => setSlotDialog(null)}
        title={slotDialog === 'video' ? 'Video Pembacaan' : `Foto ${slotDialog ? LABEL_SLOT[slotDialog] : ''}`}
        description={
          slotDialog === 'video'
            ? 'Video singkat meter berputar — bukti tambahan untuk kasus sengketa stand.'
            : 'Foto dikompres lalu ikut terkirim bersama laporan.'
        }
        actions={
          <>
            <Button onPress={() => slotDialog && ambilBerkas(slotDialog, 'kamera')} className="w-full">
              <Camera size={15} color={colors.primaryForeground} />
              <UIText>Kamera</UIText>
            </Button>
            <Button
              variant="outline"
              onPress={() => slotDialog && ambilBerkas(slotDialog, 'galeri')}
              className="w-full"
            >
              <Images size={15} color={colors.foreground} />
              <UIText>Galeri</UIText>
            </Button>
            {slotDialog != null && fotoPaths[slotDialog] != null ? (
              <Button
                variant="destructive"
                onPress={() => slotDialog && hapusBerkas(slotDialog)}
                className="w-full"
              >
                <Trash2 size={15} color={colors.destructiveForeground} />
                <UIText>Hapus</UIText>
              </Button>
            ) : null}
          </>
        }
      />

      <AppDialog
        visible={tanyaGps}
        onDismiss={() => setTanyaGps(false)}
        title="GPS Belum Aktif"
        description={
          'Posisi Anda belum terbaca — laporan akan tersimpan TANPA bukti kehadiran di lokasi. ' +
          'Aktifkan GPS lalu coba lagi, atau lanjut tanpa GPS.'
        }
        actions={
          <>
            <Button
              onPress={() => {
                setTanyaGps(false);
                void mulaiGps();
              }}
              className="w-full"
            >
              <UIText>Aktifkan Dulu</UIText>
            </Button>
            <Button
              variant="outline"
              onPress={() => {
                setTanyaGps(false);
                setKonfirmasi(susunRingkasan());
              }}
              className="w-full"
            >
              <UIText>Lanjut Tanpa GPS</UIText>
            </Button>
          </>
        }
      />

      <AppDialog
        visible={konfirmasi != null}
        onDismiss={() => setKonfirmasi(null)}
        title="Konfirmasi Hasil Baca"
        description={konfirmasi ?? ''}
        actions={
          <>
            <Button onPress={simpan} className="w-full">
              <UIText>Simpan</UIText>
            </Button>
            <Button variant="outline" onPress={() => setKonfirmasi(null)} className="w-full">
              <UIText>Periksa Lagi</UIText>
            </Button>
          </>
        }
      />

      <AppDialog
        visible={tanyaLanjut != null}
        onDismiss={() => {
          setTanyaLanjut(null);
          onSelesai();
        }}
        title="Tersimpan"
        description={
          tanyaLanjut == null
            ? ''
            : `Hasil catat masuk antrean upload. Lanjut ke pelanggan berikutnya?\n${tanyaLanjut.nama} · ${tanyaLanjut.nomorLangganan}`
        }
        actions={
          <>
            <Button
              onPress={() => {
                const tujuan = tanyaLanjut;
                setTanyaLanjut(null);
                if (tujuan) onPindah(tujuan.nomorLangganan);
              }}
              className="w-full"
            >
              <UIText>Lanjut</UIText>
            </Button>
            <Button
              variant="outline"
              onPress={() => {
                setTanyaLanjut(null);
                onSelesai();
              }}
              className="w-full"
            >
              <UIText>Kembali ke Daftar</UIText>
            </Button>
          </>
        }
      />
    </WorkspaceScaffold>
  );
}

// ── Bagian tampilan ───────────────────────────────────────────────────

function KartuIdentitas({
  pelanggan,
  posisi,
  jarak,
}: {
  pelanggan: PelangganRute;
  posisi: Posisi | null;
  jarak: number | null;
}) {
  const { colors } = useTheme();
  const p = pelanggan;
  const rincian = [
    p.nomorLangganan,
    p.nomorMeter != null ? `Meter ${p.nomorMeter}` : null,
    p.golonganTarif != null ? `Tarif ${p.golonganTarif}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <GlassPanel>
      <View style={styles.identitasBaris}>
        <SquircleIcon ikon={User} gradasi={[P.emerald, P.emerald600]} ukuran={44} />
        <View style={styles.identitasTeks}>
          <Text style={[styles.nama, { color: colors.foreground }]}>{p.nama}</Text>
          <Text style={[styles.rincian, { color: colors.mutedForeground }]}>{rincian}</Text>
          {p.alamat != null ? (
            <Text style={[styles.alamat, { color: colors.mutedForeground }]}>{p.alamat}</Text>
          ) : null}
          {p.notelp != null && p.notelp.length > 0 ? (
            <Text style={[styles.telp, { color: colors.mutedForeground }]}>Telp: {p.notelp}</Text>
          ) : null}
        </View>
        {p.urutan != null ? (
          <View style={[styles.pilUrutan, { borderColor: colors.border }]}>
            <Text style={[styles.pilUrutanTeks, { color: colors.mutedForeground }]}>
              #{p.urutan}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.gpsBaris}>
        {posisi == null ? (
          <MapPinOff size={13} color={colors.destructive} />
        ) : (
          <MapPin size={13} color={P.emerald600} />
        )}
        <Text style={[styles.gpsTeks, { color: colors.mutedForeground }]}>
          {posisi == null
            ? 'Menunggu sinyal GPS…'
            : jarak == null
              ? 'Posisi terbaca — titik pelanggan belum dipetakan'
              : `±${jarak} m dari titik pelanggan`}
        </Text>
      </View>
    </GlassPanel>
  );
}

function KartuStand({
  standLalu,
  memuatStand,
  teksStand,
  onUbahStand,
  pemakaian,
  deviasi,
  anomali,
  mundurTanpaKondisiSah,
  pemakaianLalu,
}: {
  standLalu: number | null;
  memuatStand: boolean;
  teksStand: string;
  onUbahStand: (v: string) => void;
  pemakaian: number | null;
  deviasi: number | null;
  anomali: boolean;
  mundurTanpaKondisiSah: boolean;
  pemakaianLalu: number | null;
}) {
  const { colors } = useTheme();
  const warnaDeviasi = anomali ? colors.destructive : colors.mutedForeground;

  return (
    <GlassPanel style={styles.kartu}>
      <Text style={[styles.judulKartu, { color: colors.foreground }]}>Angka Stand</Text>

      <View style={styles.standBaris}>
        <View style={styles.standKolom}>
          <Text style={[styles.labelKecil, { color: colors.mutedForeground }]}>Stand lalu</Text>
          <Text style={[styles.standLalu, { color: colors.foreground }]}>
            {memuatStand ? '…' : (standLalu ?? '—')}
          </Text>
        </View>
        <View style={styles.standKolomLebar}>
          <Text style={[styles.labelKecil, { color: colors.mutedForeground }]}>Stand akhir</Text>
          <Input
            value={teksStand}
            onChangeText={(v) => onUbahStand(v.replace(/[^0-9]/g, ''))}
            placeholder="0"
            keyboardType="number-pad"
            className="h-12 text-lg"
          />
        </View>
      </View>

      <View style={styles.hasilBaris}>
        <Text style={[styles.hasilPemakaian, { color: colors.foreground }]}>
          {pemakaian == null ? '— m³' : `${pemakaian} m³`}
        </Text>
        {deviasi != null ? (
          <Text style={[styles.hasilDeviasi, { color: warnaDeviasi }]}>
            {deviasi >= 0 ? '+' : ''}
            {deviasi.toFixed(0)}% dari bulan lalu ({pemakaianLalu} m³)
          </Text>
        ) : pemakaianLalu != null ? (
          <Text style={[styles.hasilDeviasi, { color: colors.mutedForeground }]}>
            Bulan lalu {pemakaianLalu} m³
          </Text>
        ) : null}
      </View>

      {anomali ? (
        <View style={styles.jarakAtas}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Pemakaian menyimpang jauh</AlertTitle>
            <AlertDescription>
              Selisihnya lebih dari {AMBANG_PERINGATAN}% terhadap bulan lalu. Periksa ulang roda
              angka meter sebelum menyimpan — koreksi di kantor jauh lebih mahal daripada
              melihat sekali lagi sekarang.
            </AlertDescription>
          </Alert>
        </View>
      ) : null}

      {mundurTanpaKondisiSah ? (
        <View style={styles.jarakAtas}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Stand mundur</AlertTitle>
            <AlertDescription>
              Stand akhir lebih kecil dari stand lalu. Ini hanya sah bila meternya bermasalah —
              pilih kondisi yang sesuai di bawah.
            </AlertDescription>
          </Alert>
        </View>
      ) : null}
    </GlassPanel>
  );
}

function KartuRiwayat({ pelanggan }: { pelanggan: PelangganRute }) {
  const { colors } = useTheme();
  return (
    <GlassPanel style={styles.kartu}>
      <Text style={[styles.judulKartu, { color: colors.foreground }]}>
        Riwayat Pembacaan Resmi
      </Text>
      {pelanggan.riwayat.map((r) => (
        <View key={r.periode} style={styles.riwayatBaris}>
          <Text style={[styles.riwayatPeriode, { color: colors.mutedForeground }]}>
            {labelPeriode(r.periode)}
          </Text>
          <Text style={[styles.riwayatStand, { color: colors.mutedForeground }]}>
            {r.standLalu} → {r.standAkhir}
          </Text>
          <Text style={[styles.riwayatPakai, { color: colors.foreground }]}>
            {r.pemakaianM3} m³
          </Text>
        </View>
      ))}
    </GlassPanel>
  );
}

function KartuPilihan({
  kondisi,
  onKondisi,
  kategori,
  onKategori,
  isSegel,
  onSegel,
}: {
  kondisi: string;
  onKondisi: (v: string) => void;
  kategori: string;
  onKategori: (v: string) => void;
  isSegel: boolean | null;
  onSegel: (v: boolean | null) => void;
}) {
  const { colors } = useTheme();
  return (
    <GlassPanel style={styles.kartu}>
      <Text style={[styles.judulKartu, { color: colors.foreground }]}>Keterangan Pembacaan</Text>

      <Text style={[styles.labelKecil, { color: colors.mutedForeground }]}>Kondisi meter</Text>
      <View style={styles.pilihanGrid}>
        {Object.entries(labelKondisiMeter).map(([kode, label]) => (
          <Pilihan
            key={kode}
            label={label}
            aktif={kondisi === kode}
            onPress={() => onKondisi(kode)}
          />
        ))}
      </View>

      <Text style={[styles.labelKecil, styles.jarakAtas, { color: colors.mutedForeground }]}>
        Kategori pembacaan
      </Text>
      <View style={styles.pilihanGrid}>
        {Object.entries(labelKategoriPembacaan).map(([kode, label]) => (
          <Pilihan
            key={kode}
            label={label}
            aktif={kategori === kode}
            onPress={() => onKategori(kode)}
          />
        ))}
      </View>

      <Text style={[styles.labelKecil, styles.jarakAtas, { color: colors.mutedForeground }]}>
        Kondisi segel
      </Text>
      <View style={styles.pilihanGrid}>
        <Pilihan label="Tidak diperiksa" aktif={isSegel == null} onPress={() => onSegel(null)} />
        <Pilihan label="Tersegel" aktif={isSegel === true} onPress={() => onSegel(true)} />
        <Pilihan
          label="Tidak tersegel"
          aktif={isSegel === false}
          onPress={() => onSegel(false)}
        />
      </View>
    </GlassPanel>
  );
}

function Pilihan({
  label,
  aktif,
  onPress,
}: {
  label: string;
  aktif: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pilihan,
        {
          backgroundColor: aktif ? colors.primary : colors.muted,
          borderColor: aktif ? colors.primary : colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[
          styles.pilihanTeks,
          { color: aktif ? colors.primaryForeground : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function KartuBerkas({
  fotoPaths,
  memproses,
  onBukaSlot,
}: {
  fotoPaths: Partial<Record<JenisBerkas, string>>;
  memproses: JenisBerkas | null;
  onBukaSlot: (j: JenisBerkas) => void;
}) {
  const { colors } = useTheme();
  return (
    <GlassPanel style={styles.kartu}>
      <Text style={[styles.judulKartu, { color: colors.foreground }]}>Berkas Bukti</Text>
      <Text style={[styles.keteranganKartu, { color: colors.mutedForeground }]}>
        Foto stand wajib untuk pembacaan Normal — itu bukti yang dilihat verifikator saat
        angkanya dipertanyakan.
      </Text>
      <View style={styles.slotBaris}>
        {SLOT_FOTO.map((jenis) => (
          <SlotBerkas
            key={jenis}
            label={LABEL_SLOT[jenis]}
            uri={fotoPaths[jenis]}
            memproses={memproses === jenis}
            onPress={() => onBukaSlot(jenis)}
          />
        ))}
      </View>
      <Pressable
        onPress={() => onBukaSlot('video')}
        style={({ pressed }) => [
          styles.tombolVideo,
          { borderColor: colors.border, backgroundColor: colors.muted },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={[styles.tombolVideoTeks, { color: colors.foreground }]}>
          {memproses === 'video'
            ? 'Memproses video…'
            : fotoPaths.video != null
              ? 'Video terlampir — ketuk untuk mengganti'
              : 'Tambah video pembacaan (opsional)'}
        </Text>
      </Pressable>
    </GlassPanel>
  );
}

function SlotBerkas({
  label,
  uri,
  memproses,
  onPress,
}: {
  label: string;
  uri?: string;
  memproses: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.slot,
        { borderColor: uri != null ? colors.primary : colors.border, backgroundColor: colors.muted },
        pressed && { opacity: 0.7 },
      ]}
    >
      {memproses ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : uri != null ? (
        <Image source={{ uri }} style={styles.slotGambar} resizeMode="cover" />
      ) : (
        <Camera size={18} color={colors.mutedForeground} />
      )}
      <Text numberOfLines={1} style={[styles.slotLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function KartuTambahan({
  noHp,
  onNoHp,
  usulan,
  onUsulan,
}: {
  noHp: string;
  onNoHp: (v: string) => void;
  usulan: string;
  onUsulan: (v: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <GlassPanel style={styles.kartu}>
      <Text style={[styles.judulKartu, { color: colors.foreground }]}>Perbaikan Data Lapangan</Text>
      <Text style={[styles.keteranganKartu, { color: colors.mutedForeground }]}>
        Diteruskan ke kantor bersama laporan. Nomor HP langsung diperbarui; usulan lain
        diperiksa admin sebelum diterapkan.
      </Text>

      <Text style={[styles.labelKecil, { color: colors.mutedForeground }]}>No. HP pelanggan</Text>
      <Input
        value={noHp}
        onChangeText={onNoHp}
        placeholder="08xxxxxxxxxx"
        keyboardType="phone-pad"
      />

      <Text style={[styles.labelKecil, styles.jarakAtas, { color: colors.mutedForeground }]}>
        Usulan perubahan data
      </Text>
      <Textarea
        value={usulan}
        onChangeText={onUsulan}
        placeholder="Mis. nama penghuni berubah, alamat bergeser, meter dipindah…"
        numberOfLines={3}
      />
    </GlassPanel>
  );
}

function KartuEstimasi({
  estimasiAir,
  biayaTetap,
  estimasiTotal,
}: {
  estimasiAir: number;
  biayaTetap: number | null;
  estimasiTotal: number | null;
}) {
  const { colors } = useTheme();
  return (
    <GlassPanel style={styles.kartu}>
      <Text style={[styles.judulKartu, { color: colors.foreground }]}>Estimasi Tagihan</Text>
      <View style={styles.estimasiBaris}>
        <Text style={[styles.estimasiLabel, { color: colors.mutedForeground }]}>Uang air</Text>
        <Text style={[styles.estimasiNilai, { color: colors.foreground }]}>
          {formatRupiah(estimasiAir)}
        </Text>
      </View>
      {biayaTetap != null ? (
        <>
          <View style={styles.estimasiBaris}>
            <Text style={[styles.estimasiLabel, { color: colors.mutedForeground }]}>
              Beban & admin
            </Text>
            <Text style={[styles.estimasiNilai, { color: colors.foreground }]}>
              {formatRupiah(biayaTetap)}
            </Text>
          </View>
          <View style={styles.estimasiBaris}>
            <Text style={[styles.estimasiLabel, { color: colors.foreground, fontWeight: '600' }]}>
              Perkiraan total
            </Text>
            <Text style={[styles.estimasiTotal, { color: P.emerald600 }]}>
              {formatRupiah(estimasiTotal ?? estimasiAir)}
            </Text>
          </View>
        </>
      ) : null}
      <Text style={[styles.keteranganKartu, { color: colors.mutedForeground }]}>
        Perkiraan untuk menjawab pelanggan di tempat. Angka resmi dihitung sistem saat closing —
        jangan disebut sebagai tagihan final.
      </Text>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  kartu: { marginTop: 12 },
  judulKartu: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  keteranganKartu: { fontSize: 11.5, lineHeight: 17, marginTop: 8 },
  labelKecil: { fontSize: 11.5, marginBottom: 6 },
  jarakAtas: { marginTop: 12 },

  identitasBaris: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  identitasTeks: { flex: 1 },
  nama: { fontSize: 15, fontWeight: '600' },
  rincian: { fontSize: 12, marginTop: 2 },
  alamat: { fontSize: 12, marginTop: 6 },
  telp: { fontSize: 11.5, marginTop: 2 },
  pilUrutan: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pilUrutanTeks: { fontSize: 11, fontWeight: '600' },
  gpsBaris: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  gpsTeks: { flex: 1, fontSize: 11.5 },

  standBaris: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginTop: 6 },
  standKolom: { width: 92 },
  standKolomLebar: { flex: 1 },
  standLalu: { fontSize: 26, fontWeight: '700' },
  hasilBaris: { marginTop: 12 },
  hasilPemakaian: { fontSize: 22, fontWeight: '700' },
  hasilDeviasi: { fontSize: 11.5, marginTop: 2 },

  riwayatBaris: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  riwayatPeriode: { flex: 1, fontSize: 12 },
  riwayatStand: { fontSize: 12 },
  riwayatPakai: { width: 62, textAlign: 'right', fontSize: 12.5, fontWeight: '600' },

  pilihanGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pilihan: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pilihanTeks: { fontSize: 11.5, fontWeight: '500' },

  slotBaris: { flexDirection: 'row', gap: 10, marginTop: 10 },
  slot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  slotGambar: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  slotLabel: { fontSize: 10.5 },
  tombolVideo: {
    marginTop: 10,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  tombolVideoTeks: { fontSize: 12 },

  estimasiBaris: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  estimasiLabel: { fontSize: 12.5 },
  estimasiNilai: { fontSize: 13, fontWeight: '500' },
  estimasiTotal: { fontSize: 16, fontWeight: '700' },

  navUrutan: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
