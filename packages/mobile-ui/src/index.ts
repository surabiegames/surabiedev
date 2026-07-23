// @workspace/mobile-ui — design system React Native bersama app publik &
// petugas (padanan peran `shadcn_ui` + core/theme + core/widgets di proyek
// Flutter lama). SATU sumber tema (palet master) + komponen chrome iOS.

export * from './theme';

export { PremiumBackground } from './components/premium-background';
export { GlassPanel, type GlassPanelProps } from './components/glass-panel';
export { AppScaffold, type AppScaffoldProps } from './components/app-scaffold';
export { BottomDock, type DockItem, type BottomDockProps } from './components/bottom-dock';

// ── Primitif (padanan shadcn_ui) ────────────────────────────────────────
export { Card, type CardProps } from './components/card';
export { Button, type ButtonProps, type ButtonVariant } from './components/button';
export { TextField, type TextFieldProps } from './components/text-field';
export { Badge, type BadgeProps, type BadgeVariant } from './components/badge';
export { Alert, type AlertProps, type AlertVariant } from './components/alert';
export {
  StatusBadge,
  type StatusTone,
  toneStatusTagihan,
  toneStatusLaporan,
  toneStatusPengaduan,
  tonePrioritas,
} from './components/status-badge';
export { Dialog, type DialogProps } from './components/dialog';
export { Select, type SelectProps, type SelectOption } from './components/select';
export { IconButton, type IconButtonProps } from './components/icon-button';
export { PhotoBox, type PhotoBoxProps } from './components/photo-box';
export { SectionHeader } from './components/section-header';
