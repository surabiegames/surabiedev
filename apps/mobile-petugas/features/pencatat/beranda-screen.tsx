/**
 * beranda-screen.tsx — ruang kerja PENCATAT METER. Padanan
 * `features/staff/dashboard/pencatat_home_screen.dart`.
 *
 * Pusatnya adalah CHART PROGRES rute yang DITUGASKAN ke akun ini (rute
 * dipetakan admin di dashboard web — pencatat tidak memilih sendiri): berapa
 * SL target sudah dicatat, berapa belum. Di bawahnya Launchpad aplikasi kerja
 * dan tiga pelanggan berikutnya yang harus dikunjungi.
 *
 * Verifikasi laporan TIDAK ada di sini — itu ranah supervisor/kantor.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { File } from 'expo-file-system';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  CloudDownload,
  CloudUpload,
  FileText,
  Gauge,
  Inbox,
  MapPinOff,
  ShieldCheck,
  TriangleAlert,
  WifiOff,
} from 'lucide-react-native';
import {
  labelPeriode,
  type CatatTertunda,
  type PelangganRute,
  type RuteSaya,
} from '@workspace/mobile-core';
import { GlassPanel, MasterPalette as P, useTheme } from '@/components';
import { daftarTertunda, jumlahTertunda, ruteSaya } from '@/features/baca-meter/repository';
import { RingProgresTarget } from '@/features/petugas/ring-progres';
import {
  CompactStat,
  IndikatorPenyimpanan,
  LaunchpadItem,
  WorkspaceScaffold,
  WorkspaceSection,
} from '@/features/petugas/workspace';

export function BerandaPencatatScreen({
  onBack,
  onBukaBacaMeter,
  onBukaUnduh,
  onBukaUpload,
  onBukaRiwayat,
  onBukaInfoTagihan,
  onBukaNotifikasi,
  onBukaCadangan,
  onBukaCatat,
}: {
  onBack: () => void;
  onBukaBacaMeter: () => void;
  onBukaUnduh: () => void;
  onBukaUpload: () => void;
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

  return (
    <WorkspaceScaffold
      judul="Pencatat Meter"
      subjudul="Progres rute yang ditugaskan ke Anda"
      onBack={onBack}
      onSegarkan={() => void muat(true)}
      sedangMuat={memuat}
    >
      <KartuTargetRute paket={paket} tertunda={tertunda} />

      <View style={styles.jarakKecil} />
      <IndikatorPenyimpanan
        jumlahAntrean={tertunda}
        totalByteFoto={byteFoto}
        ikonAman={ShieldCheck}
        ikonAntre={Inbox}
        ikonBahaya={TriangleAlert}
      />

      <WorkspaceSection judul="Aplikasi" />
      <GlassPanel padding={0} style={styles.launchpadPanel}>
        <View style={styles.grid}>
          <LaunchpadItem
            ikon={Gauge}
            label="Baca Meter"
            gradasi={[P.teal, P.teal600]}
            onPress={onBukaBacaMeter}
          />
          <LaunchpadItem
            ikon={CloudDownload}
            label="Download"
            gradasi={[P.emerald400, P.emerald700]}
            onPress={onBukaUnduh}
          />
          <LaunchpadItem
            ikon={CloudUpload}
            label="Upload"
            gradasi={[P.rose400, P.rose700]}
            badge={tertunda > 0 ? String(tertunda) : null}
            onPress={onBukaUpload}
          />
          <LaunchpadItem
            ikon={Clock}
            label="Riwayat"
            gradasi={[P.slate, P.slate600]}
            onPress={onBukaRiwayat}
          />
          <LaunchpadItem
            ikon={FileText}
            label="Info Tagihan"
            gradasi={[P.sky300, P.sky700]}
            onPress={onBukaInfoTagihan}
          />
          <LaunchpadItem
            ikon={Bell}
            label="Notifikasi"
            gradasi={[P.teal, P.sky700]}
            onPress={onBukaNotifikasi}
          />
          <LaunchpadItem
            ikon={ShieldCheck}
            label="Cadangan"
            gradasi={[P.emerald400, P.teal600]}
            onPress={onBukaCadangan}
          />
          {/* Dua slot kosong menjaga grid tetap sejajar tiga kolom. */}
          <View style={styles.slotKosong} />
          <View style={styles.slotKosong} />
        </View>
      </GlassPanel>

      <WorkspaceSection
        judul="Lanjutkan Rute"
        aksi={
          paket?.ruteKode != null ? (
            <Text onPress={onBukaBacaMeter} style={[styles.tautan, { color: colors.primary }]}>
              Lihat semua
            </Text>
          ) : null
        }
      />

      {paket == null ? (
        <GlassPanel>
          <Text style={{ color: colors.mutedForeground }}>Memuat rute…</Text>
        </GlassPanel>
      ) : paket.ruteKode == null ? (
        <GlassPanel>
          <View style={styles.baris}>
            <MapPinOff size={18} color={colors.mutedForeground} />
            <Text style={[styles.pesan, { color: colors.mutedForeground }]}>
              Rute belum ditugaskan ke akun Anda — penugasan diatur admin di dashboard web (menu
              Pencatat).
            </Text>
          </View>
        </GlassPanel>
      ) : berikutnya.length === 0 ? (
        <GlassPanel>
          <View style={styles.baris}>
            <CheckCircle2 size={18} color={colors.success} />
            <Text style={[styles.pesan, { color: colors.mutedForeground }]}>
              Seluruh rute sudah dibaca. Kerja bagus!
            </Text>
          </View>
        </GlassPanel>
      ) : (
        berikutnya
          .slice(0, 3)
          .map((p) => (
            <BarisBerikutnya
              key={p.nomorLangganan}
              pelanggan={p}
              onPress={() => onBukaCatat(p.nomorLangganan)}
            />
          ))
      )}
    </WorkspaceScaffold>
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

/** Kartu pusat: identitas rute + cincin progres + hitungan pendukung. */
function KartuTargetRute({ paket, tertunda }: { paket: RuteSaya | null; tertunda: number }) {
  const { colors } = useTheme();

  if (paket == null) {
    return (
      <GlassPanel padding={0} style={styles.kartuMemuat}>
        <ActivityIndicator color={colors.primary} />
      </GlassPanel>
    );
  }

  if (paket.ruteKode == null) {
    return (
      <GlassPanel padding={18}>
        <View style={styles.kosongTengah}>
          <MapPinOff size={34} color={colors.mutedForeground} />
          <Text style={[styles.kosongJudul, { color: colors.foreground }]}>
            Belum ada rute ditugaskan
          </Text>
          <Text style={[styles.kosongIsi, { color: colors.mutedForeground }]}>
            Rute pencatatan dipetakan admin ke tiap petugas di dashboard web (menu Pencatat).
            Hubungi admin bila rute Anda belum muncul, lalu tarik-segarkan halaman ini.
          </Text>
        </View>
      </GlassPanel>
    );
  }

  const banyakRute = paket.rutes.length > 1;

  return (
    <GlassPanel padding={0} style={styles.kartuTarget}>
      <View style={styles.baris}>
        <View style={[styles.pilRute, { backgroundColor: P.emerald600 }]}>
          <Text style={styles.pilRuteTeks}>
            {banyakRute ? `${paket.rutes.length} rute` : paket.ruteKode}
          </Text>
        </View>
        <View style={styles.identitasRute}>
          <Text numberOfLines={1} style={[styles.ruteJudul, { color: colors.foreground }]}>
            {banyakRute
              ? `${paket.rutes.length} rute · ${paket.target} SL`
              : (paket.seksiCater ?? 'Rute pencatatan Anda')}
          </Text>
          <Text style={[styles.rutePeriode, { color: colors.mutedForeground }]}>
            {labelPeriode(paket.periode)}
          </Text>
        </View>
        {paket.dariCache ? (
          <View style={styles.offline}>
            <WifiOff size={12} color={colors.destructive} />
            <Text style={[styles.offlineTeks, { color: colors.destructive }]}>Offline</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.jarakRing}>
        <RingProgresTarget terbaca={paket.terbaca} target={paket.target} />
      </View>

      <View style={styles.statBaris}>
        <CompactStat
          label="Dicatat Saya (periode)"
          nilai={String(paket.dicatatSaya)}
          ikon={ClipboardCheck}
        />
        <CompactStat
          label="Antre Kirim"
          nilai={String(tertunda)}
          ikon={CloudUpload}
          bahaya={tertunda > 0}
        />
      </View>
    </GlassPanel>
  );
}

function BarisBerikutnya({
  pelanggan,
  onPress,
}: {
  pelanggan: PelangganRute;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <GlassPanel padding={0} onPress={onPress} style={styles.barisBerikutnya}>
      <View
        style={[styles.bulatUrut, { backgroundColor: colors.muted, borderColor: colors.border }]}
      >
        <Text style={[styles.bulatUrutTeks, { color: colors.foreground }]}>
          {pelanggan.urutan ?? '-'}
        </Text>
      </View>
      <View style={styles.identitasPelanggan}>
        <Text numberOfLines={1} style={[styles.namaPelanggan, { color: colors.foreground }]}>
          {pelanggan.nama}
        </Text>
        {pelanggan.alamat != null ? (
          <Text numberOfLines={1} style={[styles.alamat, { color: colors.mutedForeground }]}>
            {pelanggan.alamat}
          </Text>
        ) : null}
      </View>
      {pelanggan.standLalu != null ? (
        <Text style={[styles.standLalu, { color: colors.mutedForeground }]}>
          Lalu {pelanggan.standLalu}
        </Text>
      ) : null}
      <ChevronRight size={15} color={colors.mutedForeground} />
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  jarakKecil: { height: 10 },
  launchpadPanel: { paddingVertical: 16, paddingHorizontal: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  slotKosong: { width: '33.333%' },
  tautan: { fontSize: 11.5, fontWeight: '600' },

  kartuMemuat: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  kartuTarget: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pilRute: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7 },
  pilRuteTeks: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  identitasRute: { flex: 1 },
  ruteJudul: { fontSize: 13, fontWeight: '600' },
  rutePeriode: { fontSize: 11.5, marginTop: 1 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  offlineTeks: { fontSize: 10.5 },
  jarakRing: { marginTop: 18, marginBottom: 18 },
  statBaris: { flexDirection: 'row', gap: 10 },

  kosongTengah: { alignItems: 'center', gap: 10 },
  kosongJudul: { fontSize: 15, fontWeight: '600' },
  kosongIsi: { fontSize: 12, textAlign: 'center' },
  pesan: { flex: 1, fontSize: 12.5, lineHeight: 18 },

  barisBerikutnya: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 8,
  },
  bulatUrut: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  bulatUrutTeks: { fontSize: 12, fontWeight: '700' },
  identitasPelanggan: { flex: 1 },
  namaPelanggan: { fontSize: 13, fontWeight: '500' },
  alamat: { fontSize: 11, marginTop: 1 },
  standLalu: { fontSize: 11 },
});
