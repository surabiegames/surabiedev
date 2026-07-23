/**
 * kartu-langganan.tsx — "kartu pelanggan" satu nomor langganan (padanan
 * widgets/kartu_langganan.dart): gradien navy sekeluarga dengan hero,
 * disusun seperti kartu resmi (kop berlogo, nomor sebagai tokoh utama,
 * identitas & status di kaki).
 *
 * Watermark logo besar & sapuan cahaya di versi Flutter disederhanakan —
 * gradien + hairline sudah membawa identitas visual yang sama tanpa aset
 * tambahan.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MasterPalette as P } from '@workspace/mobile-ui';
import { formatRupiah, labelStatusPelanggan } from '@workspace/mobile-core';

import type { LanggananWargaModel } from './repository';

// Gradien hero (pdam_palette.dart heroGradient 1/2/4).
const HERO = [P.slate900, '#12324E', P.sky800] as const;

function nomorTerformat(nomor: string): string {
  if (nomor.length !== 11) return nomor;
  return `${nomor.slice(0, 5)} ${nomor.slice(5, 8)} ${nomor.slice(8)}`;
}

export function KartuLangganan({ langganan: l, onPress }: { langganan: LanggananWargaModel; onPress?: () => void }) {
  const adaTunggakan = l.totalTunggakan > 0;

  return (
    <Pressable onPress={onPress}>
      <LinearGradient colors={HERO} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.kartu}>
        {/* Kop: brand + Utama */}
        <View style={styles.kop}>
          <View style={styles.brandBadge}>
            <Ionicons name="water" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.kopTeks}>
            <Text style={styles.kopKecil}>PERUMDA TIRTAWENING</Text>
            <Text style={styles.kopJudul}>Kartu Langganan</Text>
          </View>
          {l.isUtama ? (
            <View style={styles.chip}>
              <Text style={styles.chipTeks}>Utama</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.hairline} />

        {/* Nomor langganan — tokoh utama */}
        <Text style={styles.nomorLabel}>NOMOR LANGGANAN</Text>
        <Text style={styles.nomor} numberOfLines={1}>{nomorTerformat(l.nomorLangganan)}</Text>

        {/* Identitas */}
        <Text style={styles.nama} numberOfLines={1}>{l.nama}</Text>
        <Text style={styles.alamat} numberOfLines={1}>{l.alamatLengkap}</Text>

        {/* Kaki: status + golongan + tunggakan */}
        <View style={styles.kakiChips}>
          <View style={[styles.chip, l.status === 'AKTIF' ? styles.chipAktif : styles.chipNonaktif]}>
            <Text style={styles.chipTeks}>{labelStatusPelanggan[l.status] ?? l.status}</Text>
          </View>
          {l.golonganKode != null ? (
            <View style={styles.chip}>
              <Text style={styles.chipTeks}>Gol. {l.golonganKode}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.kakiTunggakan}>
          <Text style={styles.tunggakanLabel} numberOfLines={1}>
            {adaTunggakan ? `Tunggakan · ${l.jumlahTagihanBelumBayar} tagihan` : 'Tunggakan'}
          </Text>
          <Text style={[styles.tunggakanNilai, { color: adaTunggakan ? P.rose300 : P.emerald300 }]} numberOfLines={1}>
            {adaTunggakan ? formatRupiah(l.totalTunggakan) : 'Tidak ada'}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kartu: { borderRadius: 28, padding: 18, overflow: 'hidden' },
  kop: { flexDirection: 'row', alignItems: 'center' },
  brandBadge: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#FFFFFF1F', alignItems: 'center', justifyContent: 'center' },
  kopTeks: { flex: 1, marginLeft: 10 },
  kopKecil: { fontSize: 9.5, fontWeight: '600', color: '#FFFFFF8C', letterSpacing: 1.3 },
  kopJudul: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2, marginTop: 1 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: '#FFFFFF2E', marginVertical: 14 },
  nomorLabel: { fontSize: 9, fontWeight: '600', color: '#E0F2FE8C', letterSpacing: 1.4 },
  nomor: { fontSize: 20, letterSpacing: 2.6, fontWeight: '700', color: '#FFFFFF', marginTop: 4 },
  nama: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginTop: 12 },
  alamat: { fontSize: 11.5, color: '#E0F2FE99', marginTop: 2 },
  kakiChips: { flexDirection: 'row', gap: 6, marginTop: 14 },
  kakiTunggakan: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#FFFFFF1F', borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF24' },
  chipAktif: { backgroundColor: '#10B98129' },
  chipNonaktif: { backgroundColor: '#F43F5E29' },
  chipTeks: { fontSize: 10.5, fontWeight: '600', color: P.sky100 },
  tunggakanLabel: { flex: 1, fontSize: 10.5, color: '#E0F2FE99' },
  tunggakanNilai: { fontSize: 15, fontWeight: '700', marginLeft: 8 },
});
