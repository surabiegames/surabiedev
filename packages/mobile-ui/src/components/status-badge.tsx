/**
 * status-badge.tsx — badge status berwarna (padanan `StatusBadge` +
 * helper tone di core/widgets/status_badge.dart). Nada visual dipetakan SEKALI
 * dari kode status API di sini supaya warna konsisten antar layar.
 *
 * Nada `success`/`warning` tidak punya varian shadcn sendiri → memakai warna
 * kustom dari palet master (success = rumpun Emerald; warning = rumpun Rose,
 * dibedakan dari destructive lewat langkah tonal lebih terang).
 */
import { Badge } from './badge';
import { MasterPalette as P } from '../theme/palette';
import { useTheme } from '../theme/theme-context';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export function toneStatusTagihan(kode: string): StatusTone {
  switch (kode) {
    case 'SUDAH_BAYAR':
      return 'success';
    case 'JATUH_TEMPO':
      return 'danger';
    case 'BELUM_BAYAR':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function toneStatusLaporan(kode: string): StatusTone {
  switch (kode) {
    case 'DIVERIFIKASI':
    case 'DIGUNAKAN':
      return 'success';
    case 'DITOLAK':
      return 'danger';
    case 'MENUNGGU':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function toneStatusPengaduan(kode: string): StatusTone {
  switch (kode) {
    case 'SELESAI':
    case 'DITUTUP':
      return 'success';
    case 'DITOLAK':
    case 'DIBUKA_KEMBALI':
      return 'danger';
    case 'BARU':
    case 'TERVERIFIKASI':
    case 'MENUJU_LOKASI':
      return 'info';
    case 'MENUNGGU_PELANGGAN':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function tonePrioritas(kode: string): StatusTone {
  switch (kode) {
    case 'DARURAT':
      return 'danger';
    case 'TINGGI':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  const { isDark, colors } = useTheme();

  switch (tone) {
    case 'danger':
      return <Badge variant="destructive">{label}</Badge>;
    case 'neutral':
      return <Badge variant="secondary">{label}</Badge>;
    case 'info':
      // Padanan `ShadBadge()` default di Flutter (varian primer).
      return <Badge variant="default">{label}</Badge>;
    case 'success':
      return (
        <Badge backgroundColor={colors.success} foregroundColor="#FFFFFF">
          {label}
        </Badge>
      );
    case 'warning':
      return (
        <Badge backgroundColor={isDark ? P.rose600 : P.rose400} foregroundColor="#FFFFFF">
          {label}
        </Badge>
      );
  }
}
