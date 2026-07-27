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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Images,
  MapPin,
  MapPinOff,
  PencilLine,
  Receipt,
  Trash2,
  TriangleAlert,
  type LucideProps,
} from 'lucide-react-native';
import {
  ApiConfig,
  ApiException,
  formatRupiah,
  kondisiSahMundur,
  labelDari,
  labelKategoriPembacaan,
  labelKondisiMeter,
  labelBulanPendek,
  type JenisBerkas,
  type PelangganRute,
} from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Text as UIText } from '@/components/ui/text';
import { AppDialog } from '@/components/ui/app-dialog';
import { SelectField } from '@/components/ui/select-field';
import {
  Radius,
  Berat,
  GlassPanel,
  Kelas,
  Spasi,
  Teks,
  TinggiBaris,
  TinggiKontrol,
  UkuranIkon,
  useTheme,
} from '@/components';
import { IsiStrip, LayarGradasi } from '@/features/petugas/layar-gradasi';
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
  /** Bagian jarang-pakai mulai TERTUTUP — itu inti peringkasan (varian K5). */
  const [bukaTambahan, setBukaTambahan] = useState(false);
  const [bukaEstimasi, setBukaEstimasi] = useState(false);

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
      // LANGSUNG LANJUT ke rumah berikutnya yang belum dibaca — tanpa dialog
      // "lanjut?" di antaranya. Rute berisi 184 rumah; satu ketukan tambahan
      // per rumah berarti 184 ketukan sehari yang jawabannya selalu "ya".
      // Kalau rutenya habis, kembali ke daftar.
      const berikut = berikutnyaBelumDibaca();
      if (berikut != null) {
        onPindah(berikut.nomorLangganan);
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

  /**
   * Kapan tombol simpan menyala. Cermin dari `periksaLaluKonfirmasi`, bukan
   * aturan kedua — kalau keduanya berbeda, petugas akan melihat tombol hidup
   * lalu ditolak, yang jauh lebih membingungkan daripada tombol mati.
   *
   * Kondisi kelainan (rumah kosong, meter rusak) TIDAK menuntut angka maupun
   * foto, jadi tombolnya menyala lebih awal — itu memang keadaan yang sah.
   */
  const bolehSimpan =
    standLalu != null &&
    !mundurTanpaKondisiSah &&
    (kondisi !== 'NORMAL' ||
      (standAkhir != null && (ApiConfig.isDemo || fotoPaths.stand != null)));


  return (
    <LayarGradasi
      // Nama pelanggan MENGGANTIKAN judul layar (varian I5): "Catat Meter"
      // tidak memberi tahu apa pun yang belum jelas dari isinya, sedangkan
      // nama + nomor mencegah kesalahan paling mahal di layar ini — mencatat
      // rumah yang salah. Keduanya di header, jadi tidak ikut tergulir.
      judul={pelanggan.nama}
      subjudul={pelanggan.nomorLangganan}
      kiri={
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          style={({ pressed }) => pressed && styles.ditekan}
        >
          <ChevronLeft size={22} color="#FFFFFF" />
        </Pressable>
      }
      kanan={<PenandaGps jarak={jarakKePelanggan} adaPosisi={posisi != null} />}
      strip={
        <IsiStrip
          kiri={pelanggan.alamat ?? 'Alamat belum tercatat'}
          kanan={pelanggan.urutan != null ? `#${pelanggan.urutan}` : null}
        />
      }
      mengambang={
        <TombolSimpanMengambang
          aktif={bolehSimpan && !mengirim}
          mengirim={mengirim}
          onPress={periksaLaluKonfirmasi}
        />
      }
    >
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
        riwayat={pelanggan.riwayat}
      />

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
        fotoStandWajib={kondisi === 'NORMAL'}
      />

      {/*
        K5 — dua bagian yang TIDAK ada di jalur harian dilipat jadi baris
        tipis. Nilai pentingnya tetap terbaca di kanan tanpa membukanya, jadi
        sebagian besar hari petugas tidak perlu menyentuhnya sama sekali.
      */}
      <View style={styles.lipatan}>
        <BarisLipat
          ikon={PencilLine}
          judul="Perbaikan data lapangan"
          nilai={ringkasTambahan(noHp, pelanggan.notelp, usulan)}
          terbuka={bukaTambahan}
          onToggle={() => setBukaTambahan((b) => !b)}
        >
          <IsiTambahan noHp={noHp} onNoHp={setNoHp} usulan={usulan} onUsulan={setUsulan} />
        </BarisLipat>

        {estimasiAir != null ? (
          <BarisLipat
            ikon={Receipt}
            judul="Estimasi tagihan"
            nilai={formatRupiah(estimasiTotal ?? estimasiAir)}
            terbuka={bukaEstimasi}
            onToggle={() => setBukaEstimasi((b) => !b)}
          >
            <IsiEstimasi
              estimasiAir={estimasiAir}
              biayaTetap={biayaTetap}
              estimasiTotal={estimasiTotal}
            />
          </BarisLipat>
        ) : null}
      </View>

      {galat != null ? (
        <View style={styles.jarakAtas}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Belum bisa disimpan</AlertTitle>
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      {/* Ruang supaya kartu terakhir tidak tertutup tombol mengambang. */}
      <View style={styles.ruangBawah} />

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
            <Button onPress={() => slotDialog && ambilBerkas(slotDialog, 'kamera')} className={Kelas.tombol}>
              <Camera size={UkuranIkon.kecil} color={colors.primaryForeground} />
              <UIText className={Kelas.tombolTeks}>Kamera</UIText>
            </Button>
            <Button
              variant="outline"
              onPress={() => slotDialog && ambilBerkas(slotDialog, 'galeri')}
              className={Kelas.tombol}
            >
              <Images size={UkuranIkon.kecil} color={colors.foreground} />
              <UIText className={Kelas.tombolTeks}>Galeri</UIText>
            </Button>
            {slotDialog != null && fotoPaths[slotDialog] != null ? (
              <Button
                variant="destructive"
                onPress={() => slotDialog && hapusBerkas(slotDialog)}
                className={Kelas.tombol}
              >
                <Trash2 size={UkuranIkon.kecil} color={colors.destructiveForeground} />
                <UIText className={Kelas.tombolTeks}>Hapus</UIText>
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
              className={Kelas.tombol}
            >
              <UIText className={Kelas.tombolTeks}>Aktifkan Dulu</UIText>
            </Button>
            <Button
              variant="outline"
              onPress={() => {
                setTanyaGps(false);
                setKonfirmasi(susunRingkasan());
              }}
              className={Kelas.tombol}
            >
              <UIText className={Kelas.tombolTeks}>Lanjut Tanpa GPS</UIText>
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
            <Button onPress={simpan} className={Kelas.tombol}>
              <UIText className={Kelas.tombolTeks}>Simpan</UIText>
            </Button>
            <Button variant="outline" onPress={() => setKonfirmasi(null)} className={Kelas.tombol}>
              <UIText className={Kelas.tombolTeks}>Periksa Lagi</UIText>
            </Button>
          </>
        }
      />

    </LayarGradasi>
  );
}

// ── Bagian tampilan ───────────────────────────────────────────────────

/**
 * Penanda GPS di sudut kanan header — varian **P2**: ikon lokasi + jarak.
 *
 * Angkanya punya guna nyata, bukan hiasan: kalau tertulis 150 m, petugas
 * kemungkinan berdiri di rumah yang salah — dan itu ketahuan SEBELUM
 * menyimpan, bukan saat verifikasi mempertanyakannya sebulan kemudian.
 *
 * Tiga keadaan: terkunci dengan jarak, terkunci tanpa titik pelanggan
 * (pelanggan belum dipetakan), dan belum dapat sinyal.
 */
function PenandaGps({ jarak, adaPosisi }: { jarak: number | null; adaPosisi: boolean }) {
  const teks = !adaPosisi ? '—' : jarak == null ? 'aktif' : `${jarak} m`;
  return (
    <View style={styles.gps}>
      {adaPosisi ? (
        <MapPin size={UkuranIkon.sedang} color="#FFFFFF" />
      ) : (
        <MapPinOff size={UkuranIkon.sedang} color="rgba(255,255,255,0.55)" />
      )}
      <Text style={[styles.gpsTeks, !adaPosisi && styles.gpsRedup]}>{teks}</Text>
    </View>
  );
}

/**
 * Tombol simpan MENGAMBANG (varian F2): lingkaran 56, hanya ikon ceklis.
 *
 * Mengambang, bukan menempel di bar bawah, supaya tidak memakan tinggi tetap
 * di layar yang justru ingin diringkas. Mati sampai isian sah — aturannya
 * `bolehSimpan` di komponen induk, yang mencerminkan guard penyimpanan
 * sesungguhnya. Tombol yang menyala lalu ditolak lebih membingungkan daripada
 * tombol yang jelas belum bisa ditekan.
 *
 * Menekannya TIDAK langsung mengirim: dialog ringkasan tetap muncul. Itu
 * guard yang lahir dari kenyataan bahwa satu baris tersimpan langsung menjadi
 * hasil kerja yang diverifikasi kantor.
 */
function TombolSimpanMengambang({
  aktif,
  mengirim,
  onPress,
}: {
  aktif: boolean;
  mengirim: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.dudukanFab, { bottom: insets.bottom + Spasi.xl }]} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        disabled={!aktif}
        accessibilityRole="button"
        accessibilityLabel="Simpan hasil baca"
        accessibilityState={{ disabled: !aktif }}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: aktif ? colors.primary : colors.muted,
            borderColor: colors.background,
          },
          aktif && styles.fabAktif,
          pressed && aktif && styles.ditekan,
        ]}
      >
        {mengirim ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <Check
            size={26}
            strokeWidth={2.6}
            color={aktif ? colors.primaryForeground : colors.mutedForeground}
          />
        )}
      </Pressable>
    </View>
  );
}

/**
 * Kartu Angka Stand — varian **S4**: kotak isian besar di atas, lalu tiga chip
 * berukuran sama.
 *
 * URUTAN CHIP DISENGAJA: Stand lalu → Bulan lalu → Pemakaian. Dua yang kiri
 * adalah bahan, yang kanan hasilnya — dibaca seperti kalimat, dan hasilnya
 * diberi nada hijau supaya mata berhenti di situ.
 *
 * Riwayat tiga periode ikut di sini sebagai SATU BARIS (varian K5), bukan
 * kartu tersendiri. Tempatnya memang di sini: ia dibaca sebagai pembanding
 * angka yang baru diketik, bukan sebagai bagian terpisah.
 */
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
  riwayat,
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
  riwayat: PelangganRute['riwayat'];
}) {
  const { colors } = useTheme();

  return (
    <GlassPanel padding={Spasi.lg}>
      <Text style={[styles.labelKecil, { color: colors.mutedForeground }]}>Stand akhir</Text>
      <Input
        value={teksStand}
        onChangeText={(v) => onUbahStand(v.replace(/[^0-9]/g, ''))}
        placeholder="0"
        keyboardType="number-pad"
        className="h-14 text-[28px] font-bold"
      />

      <View style={styles.chipBaris}>
        <ChipAngka label="Stand lalu" nilai={memuatStand ? '…' : (standLalu?.toString() ?? '—')} />
        <ChipAngka label="Bulan lalu" nilai={pemakaianLalu != null ? `${pemakaianLalu} m³` : '—'} />
        <ChipAngka
          label="Pemakaian"
          nilai={pemakaian == null ? '—' : `${pemakaian} m³`}
          hasil
          bahaya={anomali}
        />
      </View>

      {deviasi != null ? (
        <Text
          style={[
            styles.deviasi,
            { color: anomali ? colors.destructive : colors.mutedForeground },
          ]}
        >
          {deviasi >= 0 ? '+' : ''}
          {deviasi.toFixed(0)}% dari bulan lalu
        </Text>
      ) : null}

      {anomali ? (
        <View style={styles.jarakAtas}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Pemakaian menyimpang jauh</AlertTitle>
            <AlertDescription>
              Selisihnya lebih dari {AMBANG_PERINGATAN}% terhadap bulan lalu. Periksa ulang roda
              angka meter sebelum menyimpan — koreksi di kantor jauh lebih mahal daripada melihat
              sekali lagi sekarang.
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

      {riwayat.length > 0 ? (
        <Text style={[styles.riwayatBaris, { color: colors.mutedForeground }]} numberOfLines={1}>
          {/*
            Nama bulan PENDEK (Jan · Des · Nov) tanpa tahun dan tanpa satuan
            berulang. Baris ini hanya pembanding sekilas terhadap angka yang
            baru diketik; "Januari 2026 5 m³ · Desember 2025 7 m³ · …" tidak
            muat di 390 px dan memaksa mata membaca yang sudah jelas.
          */}
          {riwayat.map((r) => `${labelBulanPendek(r.periode)} ${r.pemakaianM3}`).join(' · ')} m³
        </Text>
      ) : null}
    </GlassPanel>
  );
}

function ChipAngka({
  label,
  nilai,
  hasil = false,
  bahaya = false,
}: {
  label: string;
  nilai: string;
  hasil?: boolean;
  bahaya?: boolean;
}) {
  const { colors } = useTheme();
  const latar = bahaya ? colors.nadaBahayaLatar : hasil ? colors.nadaHijauLatar : colors.permukaan;
  const tinta = bahaya ? colors.nadaBahayaTinta : hasil ? colors.nadaHijauTinta : colors.foreground;
  const tintaLabel = hasil || bahaya ? tinta : colors.mutedForeground;

  return (
    <View style={[styles.chip, { backgroundColor: latar, borderColor: colors.border }]}>
      <Text numberOfLines={1} style={[styles.chipLabel, { color: tintaLabel }]}>
        {label}
      </Text>
      <Text numberOfLines={1} style={[styles.chipNilai, { color: tinta }]}>
        {nilai}
      </Text>
    </View>
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

  /*
   * DROPDOWN, bukan deretan pil — mengembalikan bentuk versi Flutter
   * (`ShadSelect` di catat_meter_screen.dart:927, 949, 970) sekaligus
   * menyamai `Select` dashboard web.
   *
   * Deretan pil yang sempat dipakai punya dua masalah nyata di lapangan:
   * `labelKondisiMeter` berisi belasan kondisi, jadi pilnya membungkus jadi
   * empat-lima baris dan mendorong tombol simpan jauh ke bawah; dan pilihan
   * yang artinya berjauhan ("Normal" vs "Rumah Kosong") berdempetan sehingga
   * salah tekan tidak terlihat. Dropdown menampilkan SATU nilai terpilih —
   * yang justru selalu terbaca — dan tingginya tidak berubah-ubah.
   *
   * Tata letaknya juga mengikuti Flutter: kondisi selebar kartu, lalu
   * kategori dan segel bersanding dua kolom.
   */
  const opsiKondisi = Object.entries(labelKondisiMeter).map(([value, label]) => ({ value, label }));
  const opsiKategori = Object.entries(labelKategoriPembacaan).map(([value, label]) => ({
    value,
    label,
  }));
  const nilaiSegel = isSegel == null ? 'belum' : isSegel ? 'ya' : 'tidak';

  return (
    <GlassPanel style={styles.kartu}>
      <Text style={[styles.judulKartu, { color: colors.foreground }]}>Keterangan Pembacaan</Text>

      <View style={styles.jarakAtas}>
        <SelectField
          label="Kondisi Meter"
          options={opsiKondisi}
          value={kondisi}
          onValueChange={onKondisi}
        />
      </View>

      <View style={[styles.duaKolom, styles.jarakAtas]}>
        <SelectField
          label="Kategori"
          options={opsiKategori}
          value={kategori}
          onValueChange={onKategori}
          containerClassName="flex-1"
        />
        <SelectField
          label="Kondisi Segel"
          options={[
            { value: 'belum', label: 'Tidak diperiksa' },
            { value: 'ya', label: 'Tersegel' },
            { value: 'tidak', label: 'Tidak tersegel' },
          ]}
          value={nilaiSegel}
          onValueChange={(v) => onSegel(v === 'belum' ? null : v === 'ya')}
          containerClassName="flex-1"
        />
      </View>
    </GlassPanel>
  );
}

/**
 * Berkas bukti — varian **B1**: tiga slot persegi sama besar, video sebagai
 * tombol memanjang di bawahnya.
 *
 * Slot "Stand Meter" bergaris PUTUS-PUTUS selama belum terisi ketika kondisi
 * Normal, karena hanya foto itu yang wajib. Bentuknya sendiri yang memberi
 * tahu, tanpa perlu tanda bintang atau kalimat tambahan — dan begitu terisi,
 * garisnya menjadi utuh.
 */
function KartuBerkas({
  fotoPaths,
  memproses,
  onBukaSlot,
  fotoStandWajib,
}: {
  fotoPaths: Partial<Record<JenisBerkas, string>>;
  memproses: JenisBerkas | null;
  onBukaSlot: (j: JenisBerkas) => void;
  fotoStandWajib: boolean;
}) {
  const { colors } = useTheme();
  return (
    <GlassPanel padding={Spasi.lg} style={styles.kartu}>
      <Text style={[styles.judulKartu, { color: colors.foreground }]}>Berkas Bukti</Text>
      <View style={styles.slotBaris}>
        {SLOT_FOTO.map((jenis) => (
          <SlotBerkas
            key={jenis}
            label={LABEL_SLOT[jenis]}
            uri={fotoPaths[jenis]}
            memproses={memproses === jenis}
            wajibKosong={jenis === 'stand' && fotoStandWajib && fotoPaths.stand == null}
            onPress={() => onBukaSlot(jenis)}
          />
        ))}
      </View>
      <Pressable
        onPress={() => onBukaSlot('video')}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.tombolVideo,
          { borderColor: colors.border, backgroundColor: colors.permukaan },
          pressed && styles.ditekan,
        ]}
      >
        <Text style={[styles.tombolVideoTeks, { color: colors.foreground }]}>
          {memproses === 'video'
            ? 'Memproses video…'
            : fotoPaths.video != null
              ? 'Video terlampir — ketuk untuk mengganti'
              : 'Tambah video (opsional)'}
        </Text>
      </Pressable>
    </GlassPanel>
  );
}

function SlotBerkas({
  label,
  uri,
  memproses,
  wajibKosong,
  onPress,
}: {
  label: string;
  uri?: string;
  memproses: boolean;
  wajibKosong: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const terisi = uri != null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={terisi ? `Ganti foto ${label}` : `Ambil foto ${label}`}
      style={({ pressed }) => [
        styles.slot,
        {
          borderColor: terisi ? colors.primary : wajibKosong ? colors.primary : colors.border,
          borderStyle: wajibKosong ? 'dashed' : 'solid',
          backgroundColor: terisi ? colors.nadaHijauLatar : colors.permukaan,
        },
        pressed && styles.ditekan,
      ]}
    >
      {memproses ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : terisi ? (
        <Image source={{ uri }} style={styles.slotGambar} resizeMode="cover" />
      ) : (
        <Camera size={UkuranIkon.besar} color={colors.mutedForeground} />
      )}
      <Text numberOfLines={1} style={[styles.slotLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Bagian jarang-pakai, dilipat (K5) ─────────────────────────────────

/**
 * Baris tipis yang bisa dibuka. Nilai ringkasnya tampil di kanan SELAGI
 * tertutup — itu inti gagasannya: sebagian besar hari petugas cukup membaca
 * "Rp 113.800" tanpa pernah membuka isinya.
 */
function BarisLipat({
  ikon: IkonBaris,
  judul,
  nilai,
  terbuka,
  onToggle,
  children,
}: {
  ikon: React.ComponentType<LucideProps>;
  judul: string;
  nilai: string;
  terbuka: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.lipat, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: terbuka }}
        style={({ pressed }) => [styles.lipatKepala, pressed && styles.ditekan]}
      >
        <IkonBaris size={UkuranIkon.sedang} color={colors.mutedForeground} />
        <Text style={[styles.lipatJudul, { color: colors.foreground }]}>{judul}</Text>
        <Text numberOfLines={1} style={[styles.lipatNilai, { color: colors.mutedForeground }]}>
          {nilai}
        </Text>
        {terbuka ? (
          <ChevronUp size={UkuranIkon.sedang} color={colors.mutedForeground} />
        ) : (
          <ChevronDown size={UkuranIkon.sedang} color={colors.mutedForeground} />
        )}
      </Pressable>
      {terbuka ? (
        <View style={[styles.lipatIsi, { borderTopColor: colors.border }]}>{children}</View>
      ) : null}
    </View>
  );
}

/** Ringkasan yang tampil di kanan baris "Perbaikan data lapangan". */
function ringkasTambahan(noHp: string, notelpAsal: string | null, usulan: string): string {
  const gantiHp = noHp.trim().length > 0 && noHp.trim() !== (notelpAsal ?? '');
  const adaUsulan = usulan.trim().length > 0;
  if (gantiHp && adaUsulan) return 'HP & usulan';
  if (gantiHp) return 'No. HP diubah';
  if (adaUsulan) return 'Ada usulan';
  return 'kosong';
}

function IsiTambahan({
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
    <>
      <Text style={[styles.labelKecil, { color: colors.mutedForeground }]}>No. HP pelanggan</Text>
      <Input
        value={noHp}
        onChangeText={onNoHp}
        placeholder="08xxxxxxxxxx"
        keyboardType="phone-pad"
        className={Kelas.input}
      />
      <Text style={[styles.labelKecil, styles.jarakAtas, { color: colors.mutedForeground }]}>
        Usulan perubahan data
      </Text>
      <Textarea
        value={usulan}
        onChangeText={onUsulan}
        placeholder="Mis. nama penghuni berubah, meter dipindah…"
        numberOfLines={3}
        className={Kelas.areaTeks}
      />
    </>
  );
}

function IsiEstimasi({
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
    <>
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
              Beban &amp; admin
            </Text>
            <Text style={[styles.estimasiNilai, { color: colors.foreground }]}>
              {formatRupiah(biayaTetap)}
            </Text>
          </View>
          <View style={styles.estimasiBaris}>
            <Text style={[styles.estimasiLabel, { color: colors.foreground, fontWeight: Berat.semi }]}>
              Perkiraan total
            </Text>
            <Text style={[styles.estimasiTotal, { color: colors.nadaHijauTinta }]}>
              {formatRupiah(estimasiTotal ?? estimasiAir)}
            </Text>
          </View>
        </>
      ) : null}
      <Text style={[styles.keteranganKartu, { color: colors.mutedForeground }]}>
        Perkiraan untuk menjawab pelanggan di tempat. Angka resmi dihitung sistem saat closing.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  kartu: { marginTop: Spasi.md },
  judulKartu: { fontSize: Teks.base, fontWeight: Berat.medium, marginBottom: Spasi.md },
  keteranganKartu: {
    fontSize: Teks.xs,
    lineHeight: TinggiBaris.xs,
    marginTop: Spasi.sm,
  },
  labelKecil: { fontSize: Teks.xs, marginBottom: Spasi.sm },
  jarakAtas: { marginTop: Spasi.md },
  ditekan: { opacity: 0.7 },
  ruangBawah: { height: 72 },
  duaKolom: { flexDirection: 'row', gap: Spasi.md },
  gps: { flexDirection: 'row', alignItems: 'center', gap: Spasi.xs + 1 },
  gpsTeks: { fontSize: Teks.xs, fontWeight: Berat.semi, color: '#FFFFFF' },
  gpsRedup: { color: 'rgba(255,255,255,0.55)' },

  // ── S4: chip Stand lalu · Bulan lalu · Pemakaian ──
  chipBaris: { flexDirection: 'row', gap: Spasi.sm, marginTop: Spasi.md },
  chip: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: Spasi.sm,
    paddingHorizontal: Spasi.xs,
    borderRadius: Radius.kecil,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: { fontSize: Teks.xs },
  chipNilai: { fontSize: Teks.base, fontWeight: Berat.tebal, marginTop: 2 },
  deviasi: { fontSize: Teks.xs, marginTop: Spasi.sm, textAlign: 'center' },
  riwayatBaris: { fontSize: Teks.xs, marginTop: Spasi.md, textAlign: 'center' },

  // ── Berkas ──
  slotBaris: { flexDirection: 'row', gap: Spasi.md },
  slot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Radius.kecil,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spasi.sm,
    overflow: 'hidden',
  },
  slotGambar: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  slotLabel: { fontSize: Teks.xs },
  tombolVideo: {
    marginTop: Spasi.md,
    height: TinggiKontrol.kecil,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.kecil,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tombolVideoTeks: { fontSize: Teks.xs },

  // ── Bagian dilipat ──
  lipatan: { marginTop: Spasi.md, gap: Spasi.sm },
  lipat: { borderRadius: Radius.kartu, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  lipatKepala: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.md,
    paddingHorizontal: Spasi.lg,
    paddingVertical: Spasi.md,
  },
  lipatJudul: { fontSize: Teks.sm, fontWeight: Berat.medium },
  lipatNilai: { flex: 1, fontSize: Teks.xs, textAlign: 'right' },
  lipatIsi: { paddingHorizontal: Spasi.lg, paddingBottom: Spasi.lg, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spasi.md },

  estimasiBaris: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spasi.xs,
  },
  estimasiLabel: { fontSize: Teks.sm },
  estimasiNilai: { fontSize: Teks.sm, fontWeight: Berat.medium },
  estimasiTotal: { fontSize: Teks.base, fontWeight: Berat.tebal },

  // ── Tombol simpan mengambang (F2) ──
  dudukanFab: { position: 'absolute', right: Spasi.xl, alignItems: 'flex-end' },
  fab: {
    width: 56,
    height: 56,
    borderRadius: Radius.bundar,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  fabAktif: { boxShadow: '0px 8px 20px rgba(5, 150, 105, 0.36)' },
});
