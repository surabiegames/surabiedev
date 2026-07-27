// components — komponen custom & tema app publik "Tirtawening" (dulu paket
// @workspace/mobile-ui, kini menyatu di app). SATU sumber tema (palet master)
// + komponen chrome iOS. Primitif Button/Card/TextField/Alert sudah PINDAH ke
// react-native-reusables (shadcn) di ./ui/*, jadi tidak diekspor dari sini.

export * from './theme';

export { PremiumBackground } from './premium-background';
export { GlassPanel, type GlassPanelProps } from './glass-panel';
export { AppScaffold, type AppScaffoldProps } from './app-scaffold';
export { BottomDock, type DockItem, type BottomDockProps } from './bottom-dock';

export {
  StatusBadge,
  type StatusTone,
  toneStatusTagihan,
  toneStatusLaporan,
  toneStatusPengaduan,
  tonePrioritas,
} from './status-badge';
export { IconButton, type IconButtonProps } from './icon-button';
export { PhotoBox, type PhotoBoxProps } from './photo-box';
export { SectionHeader } from './section-header';
