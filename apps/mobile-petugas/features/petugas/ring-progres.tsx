/**
 * ring-progres.tsx — cincin progres target pencatatan.
 *
 * Bentuknya mengikuti opsi **R1** yang disetujui (mockup revisi 3) dan angka
 * di `features/beranda.md`: bingkai 160, jari-jari 68, tebal 14, busur
 * bergradasi Emerald 400 → Emerald 600, persentase 30/500 Slate 900, label 12
 * Slate 400.
 *
 * Chart magnitude bagian-dari-keutuhan: SL yang SUDAH dicatat terhadap total
 * target rute.
 *
 * IDENTITAS TIDAK BERGANTUNG WARNA SEMATA — angka persentase dan kata
 * "terbaca" selalu ada di tengah cincin. Petugas membaca layar ini di bawah
 * matahari, kadang dengan mata yang tidak membedakan hijau dan abu dengan
 * baik; sebuah busur tanpa angka tidak memberi tahu apa pun.
 *
 * Teks tengah sengaja `View` beroverlay DI ATAS `Svg`, bukan `SvgText` di
 * dalamnya: dengan cara ini penskalaan font sistem dan pembaca layar tetap
 * bekerja, dua hal yang hilang begitu teks pindah ke dalam SVG.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Berat, MasterPalette as P } from '@/components';

/** Semua dari beranda.md — jangan diubah tanpa memperbarui spesifikasi. */
const UKURAN = 160;
const JARI = 68;
const TEBAL = 14;

export function RingProgresTarget({
  terbaca,
  target,
}: {
  /** SL yang sudah dicatat pada periode berjalan. */
  terbaca: number;
  /** Total SL target rute. */
  target: number;
}) {
  const rasio = target === 0 ? 0 : Math.min(1, Math.max(0, terbaca / target));
  const persen = Math.round(rasio * 100);

  const keliling = 2 * Math.PI * JARI;
  // strokeDasharray menggambar busur; sisanya dibiarkan kosong. Rotasi -90°
  // memindahkan titik mulai dari jam 3 ke jam 12, searah jarum jam.
  const panjangBusur = keliling * rasio;
  const tengah = UKURAN / 2;

  return (
    <View style={styles.bingkai}>
      <Svg width={UKURAN} height={UKURAN}>
        <Defs>
          <LinearGradient id="isiRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={P.emerald400} />
            <Stop offset="1" stopColor={P.emerald600} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={tengah}
          cy={tengah}
          r={JARI}
          stroke={P.slate200}
          strokeWidth={TEBAL}
          fill="none"
        />
        {rasio > 0 ? (
          <Circle
            cx={tengah}
            cy={tengah}
            r={JARI}
            stroke="url(#isiRing)"
            strokeWidth={TEBAL}
            strokeLinecap="round"
            strokeDasharray={`${panjangBusur} ${keliling}`}
            fill="none"
            transform={`rotate(-90 ${tengah} ${tengah})`}
          />
        ) : null}
      </Svg>
      <View style={styles.tengah} pointerEvents="none">
        <Text style={styles.persen}>{persen}%</Text>
        <Text style={styles.label}>terbaca</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bingkai: { width: UKURAN, height: UKURAN },
  tengah: {
    position: 'absolute',
    width: UKURAN,
    height: UKURAN,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  persen: { fontSize: 30, fontWeight: Berat.medium, color: P.slate900, lineHeight: 34 },
  label: { fontSize: 12, color: P.slate },
});
