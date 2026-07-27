/**
 * tokens.ts — token warna tema light/dark. Gabungan dari dua sumber Dart:
 *   - `ShadColorScheme` (core/theme/app_theme.dart) → warna semantik komponen
 *     (button/card/input/badge): background, foreground, primary, muted, dst.
 *   - `IosStyle` (core/theme/ios_style.dart) → token "chrome" gaya iOS untuk
 *     nav bar / tab bar / kartu kaca: iosLabel, iosSeparator, systemBlue, dst.
 *
 * Nilai alpha Dart (mis. 0x99334155 = ARGB) dikonversi ke hex RN 8-digit
 * `#RRGGBBAA` (mis. '#33415599').
 *
 * SATU-satunya sumber warna tema — komponen mengambil lewat `useTheme()`,
 * tidak menuliskan hex sendiri (kecuali menembus langsung ke MasterPalette).
 */
import { MasterPalette as P } from './palette';

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  // ── Semantik komponen (ShadColorScheme) ──────────────────────────────
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  selection: string;
  // ── Status ───────────────────────────────────────────────────────────
  /** Status "berhasil/normal" (badge Lunas, bacaan normal) — rumpun Emerald. */
  success: string;
  // ── Chrome gaya iOS (IosStyle) ────────────────────────────────────────
  iosBackground: string;
  iosSecondaryBackground: string;
  iosTertiaryBackground: string;
  iosLabel: string;
  iosSecondaryLabel: string;
  iosSeparator: string;
  /** Aksi/tautan sistem iOS (dipetakan ke master: biru=Sky, hijau=Emerald, merah=Rose). */
  systemBlue: string;
  systemGreen: string;
  systemRed: string;
}

export interface Theme {
  scheme: ColorScheme;
  isDark: boolean;
  colors: ThemeColors;
  /** Radius baku (px). `card` = sudut kartu, `dialog` = sudut dialog. */
  radius: { sm: number; md: number; card: number; dialog: number; pill: number };
}

const radius = { sm: 8, md: 12, card: 16, dialog: 16, pill: 999 } as const;

const lightColors: ThemeColors = {
  background: '#FFFFFF',
  foreground: P.slate900,
  card: '#FFFFFF',
  cardForeground: P.slate900,
  popover: '#FFFFFF',
  popoverForeground: P.slate900,
  primary: P.emerald,
  primaryForeground: '#FFFFFF',
  secondary: P.slate100,
  secondaryForeground: P.slate900,
  muted: P.slate100,
  mutedForeground: P.slate500,
  accent: P.teal100,
  accentForeground: P.teal700,
  destructive: P.rose,
  destructiveForeground: '#FFFFFF',
  border: P.slate200,
  input: P.slate200,
  ring: P.emerald,
  selection: P.sky200,
  success: P.emerald,
  iosBackground: '#FFFFFF',
  iosSecondaryBackground: P.slate100,
  iosTertiaryBackground: '#FFFFFF',
  iosLabel: P.slate900,
  iosSecondaryLabel: '#33415599', // slate-700 @60%
  iosSeparator: '#4757694A', // slate-600 @29%
  systemBlue: P.sky,
  systemGreen: P.emerald,
  systemRed: P.rose,
};

const darkColors: ThemeColors = {
  background: P.slate950,
  foreground: P.slate50,
  card: P.slate900,
  cardForeground: P.slate50,
  popover: P.slate900,
  popoverForeground: P.slate50,
  // Emerald dicerahkan satu langkah tonal — kontras cukup di atas latar gelap.
  primary: P.emerald400,
  primaryForeground: P.slate950,
  secondary: P.slate800,
  secondaryForeground: P.slate50,
  muted: P.slate800,
  mutedForeground: P.slate,
  accent: P.teal900,
  accentForeground: P.teal,
  destructive: P.rose400,
  destructiveForeground: P.slate950,
  border: P.slate700,
  input: P.slate700,
  ring: P.emerald400,
  selection: P.sky900,
  success: P.emerald400, // kontras mode gelap
  iosBackground: P.slate950,
  iosSecondaryBackground: P.slate900,
  iosTertiaryBackground: P.slate800,
  iosLabel: P.slate50,
  iosSecondaryLabel: '#E2E8F099', // slate-200 @60%
  iosSeparator: '#94A3B85A', // slate-400 @35%
  systemBlue: P.sky,
  systemGreen: P.emerald,
  systemRed: P.rose,
};

export const lightTheme: Theme = { scheme: 'light', isDark: false, colors: lightColors, radius };
export const darkTheme: Theme = { scheme: 'dark', isDark: true, colors: darkColors, radius };

export function themeForScheme(scheme: ColorScheme | null | undefined): Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}
