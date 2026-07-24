// tailwind.config.js — konfigurasi Tailwind untuk app. Tema (warna, radius,
// preset NativeWind) diwarisi dari @workspace/mobile-ui via `presets`. Yang
// wajib berbeda di sini: `content` HARUS mencakup file app INI sekaligus
// source paket bersama, supaya class yang dipakai lintas paket ikut dipindai.
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    '../../packages/mobile-ui/src/**/*.{ts,tsx}',
  ],
  presets: [require('@workspace/mobile-ui/tailwind.config')],
};
