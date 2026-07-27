/**
 * ring-progres.tsx — cincin progres target pencatatan. Padanan
 * `RingProgresTarget` (`CustomPainter` Flutter → react-native-svg).
 *
 * Chart magnitude bagian-dari-keutuhan: SL yang SUDAH dicatat terhadap total
 * target rute.
 *
 * IDENTITAS TIDAK BERGANTUNG WARNA SEMATA — angka dan legend teks selalu
 * menyertainya. Petugas membaca layar ini di bawah matahari, kadang dengan
 * mata yang tidak membedakan hijau dan abu dengan baik; sebuah busur tanpa
 * angka tidak memberi tahu apa pun.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { MasterPalette as P, useTheme } from '@/components';

const TEBAL = 16;

export function RingProgresTarget({
  terbaca,
  target,
  ukuran = 172,
}: {
  /** SL yang sudah dicatat pada periode berjalan. */
  terbaca: number;
  /** Total SL target rute. */
  target: number;
  ukuran?: number;
}) {
  const { colors } = useTheme();

  const rasio = target === 0 ? 0 : Math.min(1, Math.max(0, terbaca / target));
  const persen = Math.round(rasio * 100);
  const belum = Math.max(0, target - terbaca);

  const jari = (ukuran - TEBAL) / 2;
  const keliling = 2 * Math.PI * jari;
  // strokeDasharray menggambar busur; sisanya dibiarkan kosong. Rotasi -90°
  // memindahkan titik mulai dari jam 3 ke jam 12, searah jarum jam.
  const panjangBusur = keliling * rasio;

  return (
    <View style={styles.wrap}>
      <View style={{ width: ukuran, height: ukuran }}>
        <Svg width={ukuran} height={ukuran}>
          <Defs>
            <LinearGradient id="isiRing" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={P.emerald} />
              <Stop offset="1" stopColor={P.emerald600} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={ukuran / 2}
            cy={ukuran / 2}
            r={jari}
            stroke={colors.muted}
            strokeWidth={TEBAL}
            fill="none"
          />
          {rasio > 0 ? (
            <Circle
              cx={ukuran / 2}
              cy={ukuran / 2}
              r={jari}
              stroke="url(#isiRing)"
              strokeWidth={TEBAL}
              strokeLinecap="round"
              strokeDasharray={`${panjangBusur} ${keliling}`}
              fill="none"
              transform={`rotate(-90 ${ukuran / 2} ${ukuran / 2})`}
            />
          ) : null}
        </Svg>
        <View style={[styles.tengah, { width: ukuran, height: ukuran }]}>
          <Text style={[styles.persen, { color: P.emerald600 }]}>{persen}%</Text>
          <Text style={[styles.persenLabel, { color: colors.mutedForeground }]}>terbaca</Text>
        </View>
      </View>

      <View style={styles.legend}>
        <LegendRing warna={P.emerald600} label="Sudah Dicatat" nilai={terbaca} />
        <LegendRing
          warna={colors.muted}
          garisTepi={colors.border}
          label="Belum Dicatat"
          nilai={belum}
        />
      </View>
      <Text style={[styles.kaki, { color: colors.mutedForeground }]}>
        Target rute: {target} sambungan langganan (SL)
      </Text>
    </View>
  );
}

function LegendRing({
  warna,
  garisTepi,
  label,
  nilai,
}: {
  warna: string;
  garisTepi?: string;
  label: string;
  nilai: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.titik,
          {
            backgroundColor: warna,
            borderWidth: garisTepi ? StyleSheet.hairlineWidth : 0,
            borderColor: garisTepi,
          },
        ]}
      />
      <Text style={[styles.legendNilai, { color: colors.foreground }]}>{nilai}</Text>
      <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  tengah: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  persen: { fontSize: 40, fontWeight: '700', lineHeight: 44 },
  persenLabel: { fontSize: 11, marginTop: 2 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titik: { width: 11, height: 11, borderRadius: 6 },
  legendNilai: { fontSize: 13, fontWeight: '600' },
  legendLabel: { fontSize: 11.5 },
  kaki: { fontSize: 11.5, marginTop: 6 },
});
