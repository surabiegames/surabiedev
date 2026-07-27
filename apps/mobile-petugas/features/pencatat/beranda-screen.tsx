/**
 * beranda-screen.tsx — beranda aplikasi Pencatat Meter, tab pertama.
 *
 * TATA LETAK: `features/beranda.md` + varian yang disetujui
 * **H1 R1 M4 S1 L1**, ditambah **C1** (legend cincin) dan **E5** (Akun jadi
 * tombol di header, bukan ubin).
 *
 * TANPA AKSI GANDA — ini aturan, bukan preferensi. Rute, Download, dan Upload
 * sudah jadi tab di dock, jadi ubinnya di sini DIHAPUS; seksi "Aplikasi utama"
 * bubar seluruhnya. Kartu "Antre kirim" dan spanduk penyimpanan sengaja TIDAK
 * bisa diketuk — keduanya menampilkan angka, dan membuatnya bisa ditekan akan
 * menjadikannya pintu kedua ke Upload.
 *
 * MODE GELAP AKTIF. Seluruh permukaan dan teks mengambil `useTheme().colors`;
 * tidak ada hex MasterPalette yang ditulis langsung kecuali untuk hal yang
 * memang berwarna sama di kedua mode: gradasi header dan busur cincin.
 *
 * Portal sudah dihapus, jadi tidak ada tombol kembali — sudut kiri header
 * dipakai tombol Akun (identitas, versi, keluar).
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { File } from 'expo-file-system';
import {
  Bell,
  ChevronRight,
  Clock,
  FileText,
  MapPinOff,
  RotateCw,
  ShieldCheck,
  TriangleAlert,
  User,
  type LucideProps,
} from 'lucide-react-native';
import {
  formatUkuranByte,
  labelPeriode,
  type CatatTertunda,
  type PelangganRute,
  type RuteSaya,
} from '@workspace/mobile-core';
import { MasterPalette as P, Radius, useTheme, type ThemeColors } from '@/components';
import { daftarTertunda, jumlahTertunda, ruteSaya } from '@/features/baca-meter/repository';
import { RingProgresTarget } from '@/features/petugas/ring-progres';
import { LayarGradasi } from '@/features/petugas/layar-gradasi';

/** Ambang peringatan antrean — nilai yang sama dipakai sejak versi Flutter. */
const AMBANG_PERHATIAN = 400;

type Ikon = React.ComponentType<LucideProps>;

export function BerandaPencatatScreen({
  onBukaAkun,
  onBukaRiwayat,
  onBukaInfoTagihan,
  onBukaNotifikasi,
  onBukaCadangan,
  onBukaCatat,
}: {
  onBukaAkun: () => void;
  onBukaRiwayat: () => void;
  onBukaInfoTagihan: () => void;
  onBukaNotifikasi: () => void;
  onBukaCadangan: () => void;
  onBukaCatat: (nomorLangganan: string) => void;
}) {
  const { colors } = useTheme();
  const [paket, setPaket] = useState<RuteSaya | null>(null);
  const [tertunda, setTertunda] = useState(0);
  const [byteFoto, setByteFoto] = useState(0);
  const [memuat, setMemuat] = useState(false);

  /**
   * `paksa` true = tarik ulang dari server (pull-to-refresh); false = baca
   * cache lokal. Navigasi biasa TIDAK menembak jaringan: paket rute sudah
   * diunduh, dan menariknya ulang tiap kali berpindah layar adalah persis
   * yang membuat aplikasi terasa berat di sinyal lemah.
   */
  const muat = useCallback(async (paksa = false) => {
    setMemuat(true);
    try {
      const [hasilPaket, hasilAntre, isiAntrean] = await Promise.all([
        ruteSaya({ segarkan: paksa }).catch((): RuteSaya | null => null),
        jumlahTertunda().catch(() => 0),
        daftarTertunda().catch((): CatatTertunda[] => []),
      ]);
      setPaket(hasilPaket);
      setTertunda(hasilAntre);
      setByteFoto(hitungByteFoto(isiAntrean));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat(false);
  }, [muat]);

  useFocusEffect(
    useCallback(() => {
      void muat(false);
    }, [muat]),
  );

  const berikutnya = (paket?.pelanggan ?? []).filter((p) => !p.sudahDicatat);
  const adaRute = paket?.ruteKode != null;

  const subjudul =
    paket == null
      ? 'Memuat rute…'
      : [
          paket.namaPencatat,
          paket.rutes.length > 0 ? `${paket.rutes.length} rute` : null,
          labelPeriode(paket.periode),
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <LayarGradasi
      judul="Pencatat Meter"
      subjudul={subjudul}
      kiri={
        // E5 — menggantikan tombol kembali ke Portal, yang sudah dihapus.
        <Pressable
          onPress={onBukaAkun}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Akun"
          style={({ pressed }) => [gaya.tombolAkun, pressed && gaya.ditekan]}
        >
          <User size={18} color="#FFFFFF" />
        </Pressable>
      }
      kanan={
        <View style={gaya.aksiKanan}>
          {paket?.dariCache ? (
            <View style={[gaya.lencanaOffline, { backgroundColor: colors.nadaBahayaLatar }]}>
              <Text style={[gaya.lencanaOfflineTeks, { color: colors.nadaBahayaTinta }]}>
                Offline
              </Text>
            </View>
          ) : null}
          <Pressable
            onPress={() => void muat(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Segarkan"
            style={({ pressed }) => pressed && gaya.ditekan}
          >
            <RotateCw size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      }
      onSegarkan={() => void muat(true)}
      sedangMuat={memuat}
    >
        {/* ── R1 + C1: cincin progres beserta legend dan kaki target ── */}
        <View style={[gaya.kartuRing, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {paket == null ? (
            <ActivityIndicator color={colors.primary} style={gaya.pemuatRing} />
          ) : !adaRute ? (
            <View style={gaya.kosongRute}>
              <MapPinOff size={34} color={colors.mutedForeground} />
              <Text style={[gaya.kosongJudul, { color: colors.foreground }]}>
                Belum ada rute ditugaskan
              </Text>
              <Text style={[gaya.kosongIsi, { color: colors.mutedForeground }]}>
                Rute pencatatan dipetakan admin ke tiap petugas di dashboard web (menu Pencatat).
                Hubungi admin bila rute Anda belum muncul, lalu tarik-segarkan halaman ini.
              </Text>
            </View>
          ) : (
            <>
              <RingProgresTarget terbaca={paket.terbaca} target={paket.target} />
              <View style={gaya.legend}>
                <ItemLegend
                  warna={P.emerald600}
                  nilai={paket.terbaca}
                  label="Sudah"
                  colors={colors}
                />
                <ItemLegend
                  warna={colors.muted}
                  garisTepi={colors.border}
                  nilai={Math.max(0, paket.target - paket.terbaca)}
                  label="Belum"
                  colors={colors}
                />
              </View>
              <Text style={[gaya.kakiRing, { color: colors.mutedForeground }]}>
                Target rute: {paket.target} sambungan langganan
              </Text>
            </>
          )}
        </View>

        {/* ── M4: kartu metrik blok bernada. Menampilkan angka, TIDAK diketuk. ── */}
        <View style={gaya.metrik}>
          <View style={[gaya.selMetrik, { backgroundColor: colors.nadaHijauLatar }]}>
            <Text style={[gaya.metrikNilai, { color: colors.nadaHijauTinta }]}>
              {paket?.dicatatSaya ?? 0}
            </Text>
            <Text style={[gaya.metrikLabel, { color: colors.nadaHijauRedup }]}>Dicatat saya</Text>
          </View>
          <View style={[gaya.selMetrik, { backgroundColor: colors.nadaBiruLatar }]}>
            <Text style={[gaya.metrikNilai, { color: colors.nadaBiruTinta }]}>{tertunda}</Text>
            <Text style={[gaya.metrikLabel, { color: colors.nadaBiruRedup }]}>Antre kirim</Text>
          </View>
        </View>

        {/* ── S1: spanduk penyimpanan ── */}
        <SpandukPenyimpanan jumlahAntrean={tertunda} totalByteFoto={byteFoto} />

        {/* ── Lainnya: empat tujuan yang TIDAK ada di dock ── */}
        <View>
          <Text style={[gaya.seksiJudul, { color: colors.mutedForeground }]}>Lainnya</Text>
          <View style={gaya.grid}>
            <Ubin ikon={Clock} label="Riwayat" onPress={onBukaRiwayat} />
            <Ubin ikon={FileText} label="Info tagihan" onPress={onBukaInfoTagihan} />
            <Ubin ikon={Bell} label="Notifikasi" onPress={onBukaNotifikasi} />
            <Ubin ikon={ShieldCheck} label="Cadangan" onPress={onBukaCadangan} />
          </View>
        </View>

        {/* ── L1: lanjutkan rute ── */}
        <View>
          <Text style={[gaya.seksiJudul, { color: colors.mutedForeground }]}>Lanjutkan rute</Text>
          {paket == null ? (
            <Text style={[gaya.pesanKosong, { color: colors.mutedForeground }]}>Memuat rute…</Text>
          ) : !adaRute ? (
            <Text style={[gaya.pesanKosong, { color: colors.mutedForeground }]}>
              Rute belum ditugaskan ke akun Anda — penugasan diatur admin di dashboard web.
            </Text>
          ) : berikutnya.length === 0 ? (
            <Text style={[gaya.pesanKosong, { color: colors.mutedForeground }]}>
              Seluruh rute sudah dibaca. Kerja bagus!
            </Text>
          ) : (
            <View style={gaya.daftarRute}>
              {berikutnya.slice(0, 3).map((p) => (
                <BarisRute
                  key={p.nomorLangganan}
                  pelanggan={p}
                  onPress={() => onBukaCatat(p.nomorLangganan)}
                />
              ))}
            </View>
          )}
        </View>
    </LayarGradasi>
  );
}

// ── Kepingan ──────────────────────────────────────────────────────────

function ItemLegend({
  warna,
  garisTepi,
  nilai,
  label,
  colors,
}: {
  warna: string;
  garisTepi?: string;
  nilai: number;
  label: string;
  colors: ThemeColors;
}) {
  return (
    <View style={gaya.legendItem}>
      <View
        style={[
          gaya.legendTitik,
          {
            backgroundColor: warna,
            borderWidth: garisTepi ? StyleSheet.hairlineWidth : 0,
            borderColor: garisTepi,
          },
        ]}
      />
      <Text style={[gaya.legendNilai, { color: colors.foreground }]}>{nilai}</Text>
      <Text style={[gaya.legendLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

/** S1 — blok bernada dengan ikon perisai. Bukan tombol. */
function SpandukPenyimpanan({
  jumlahAntrean,
  totalByteFoto,
}: {
  jumlahAntrean: number;
  totalByteFoto: number;
}) {
  const { colors } = useTheme();
  const aman = jumlahAntrean === 0;
  const perhatian = jumlahAntrean >= AMBANG_PERHATIAN;

  // Nada peringatan memakai rumpun Rose — di palet master, peringatan dan
  // bahaya satu rumpun (tidak ada amber). Lihat catatan di palette.ts.
  const latar = perhatian ? colors.nadaBahayaLatar : colors.nadaHijauLatar;
  const tinta = perhatian ? colors.nadaBahayaTinta : colors.nadaHijauTinta;

  const judul = aman
    ? 'Penyimpanan aman.'
    : perhatian
      ? 'Segera upload — antrean menumpuk.'
      : 'Antrean menunggu upload.';
  const rincian = aman
    ? ' Tidak ada hasil catat yang menunggu diunggah.'
    : ` ${jumlahAntrean} laporan · ${formatUkuranByte(totalByteFoto)} menunggu diunggah.`;

  return (
    <View style={[gaya.spanduk, { backgroundColor: latar }]}>
      {perhatian ? (
        <TriangleAlert size={18} color={tinta} />
      ) : (
        <ShieldCheck size={18} color={tinta} />
      )}
      <Text style={[gaya.spandukTeks, { color: tinta }]}>
        <Text style={gaya.spandukTebal}>{judul}</Text>
        {rincian}
      </Text>
    </View>
  );
}

/** Ubin "Lainnya": ikon netral di sebelah label, grid dua kolom. */
function Ubin({ ikon: IkonUbin, label, onPress }: { ikon: Ikon; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        gaya.ubin,
        { backgroundColor: colors.permukaan, borderColor: colors.border },
        pressed && gaya.ditekan,
      ]}
    >
      <IkonUbin size={18} color={colors.mutedForeground} />
      <Text numberOfLines={1} style={[gaya.ubinNama, { color: colors.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** L1 — baris rute dengan kotak nomor urut. */
function BarisRute({ pelanggan, onPress }: { pelanggan: PelangganRute; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        gaya.barisRute,
        { backgroundColor: colors.permukaan },
        pressed && gaya.ditekan,
      ]}
    >
      <View style={[gaya.kotakUrut, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Text style={[gaya.kotakUrutTeks, { color: colors.foreground }]}>
          {pelanggan.urutan ?? '-'}
        </Text>
      </View>
      <View style={gaya.barisTeks}>
        <Text numberOfLines={1} style={[gaya.barisNama, { color: colors.foreground }]}>
          {pelanggan.nama}
        </Text>
        {pelanggan.alamat != null ? (
          <Text numberOfLines={1} style={[gaya.barisAlamat, { color: colors.mutedForeground }]}>
            {pelanggan.alamat}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

/**
 * Total ukuran foto bukti yang masih tersimpan lokal di seluruh antrean.
 * Berkas yang sudah hilang (cache dibersihkan OS) diabaikan — angka ini
 * menjawab "berapa besar yang menunggu diunggah", bukan "berapa yang pernah
 * ada".
 */
function hitungByteFoto(antrean: CatatTertunda[]): number {
  let total = 0;
  for (const entri of antrean) {
    for (const path of Object.values(entri.fotoPaths)) {
      if (!path) continue;
      try {
        const berkas = new File(path);
        if (berkas.exists) total += berkas.size ?? 0;
      } catch {
        continue;
      }
    }
  }
  return total;
}

// ── Gaya ── Nilai dari features/beranda.md; warna dari useTheme().

const gaya = StyleSheet.create({
  layar: { flex: 1 },
  ditekan: { opacity: 0.7 },
  aksiKanan: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  tombolAkun: {
    width: 32,
    height: 32,
    borderRadius: Radius.bundar,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  lencanaOffline: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  lencanaOfflineTeks: { fontSize: 11, fontWeight: '600' },


  kartuRing: {
    borderRadius: Radius.kartu,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    alignItems: 'center',
  },
  pemuatRing: { height: 160 },
  kosongRute: { alignItems: 'center', gap: 10 },
  kosongJudul: { fontSize: 15, fontWeight: '600' },
  kosongIsi: { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  // C1 — legend dua butir + kaki target.
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendTitik: { width: 11, height: 11, borderRadius: 6 },
  legendNilai: { fontSize: 13, fontWeight: '600' },
  legendLabel: { fontSize: 12 },
  kakiRing: { fontSize: 12, marginTop: 6 },

  metrik: { flexDirection: 'row', gap: 10 },
  selMetrik: { flex: 1, padding: 12, borderRadius: Radius.kontrol },
  metrikNilai: { fontSize: 22, fontWeight: '500' },
  metrikLabel: { fontSize: 12, marginTop: 2 },

  spanduk: {
    borderRadius: Radius.kontrol,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  spandukTeks: { flex: 1, fontSize: 12, lineHeight: 17 },
  spandukTebal: { fontWeight: '600' },

  seksiJudul: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 10,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  ubin: {
    width: '48%',
    padding: 12,
    borderRadius: Radius.kontrol,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ubinNama: { flex: 1, fontSize: 11, fontWeight: '500' },

  daftarRute: { gap: 8 },
  barisRute: {
    padding: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kotakUrut: {
    width: 26,
    height: 26,
    borderRadius: Radius.kecil,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  kotakUrutTeks: { fontSize: 12, fontWeight: '600' },
  barisTeks: { flex: 1, minWidth: 0 },
  barisNama: { fontSize: 13, fontWeight: '500' },
  barisAlamat: { fontSize: 11, marginTop: 1 },

  pesanKosong: { fontSize: 12.5, lineHeight: 18 },
});
