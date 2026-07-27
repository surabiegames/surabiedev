// metro.config.js — konfigurasi Metro untuk monorepo pnpm + NativeWind.
// Tanpa `withNativeWind` tidak ada pipeline CSS: class `className` TIDAK
// ter-generate di release build (`bundleRelease`) sehingga komponen ter-render
// tanpa style / tak terlihat di HP walau di dev tampak normal.
//
// Dua penyesuaian monorepo:
//   1. watchFolders → sertakan root repo supaya Metro memantau paket bersama.
//   2. nodeModulesPaths → resolusi mencari di node_modules app DAN root.
//
// Plus dukungan WASM untuk expo-sqlite di web — lihat blok di bawah.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// ── expo-sqlite di web ────────────────────────────────────────────────
//
// Di web, expo-sqlite tidak memakai SQLite native melainkan wa-sqlite yang
// dikompilasi ke WebAssembly: `web/worker.ts` melakukan
// `import wasmModule from './wa-sqlite/wa-sqlite.wasm'`. Metro TIDAK mengenal
// `.wasm` sebagai aset secara bawaan, sehingga bundel web gagal dengan
// "Unable to resolve module ./wa-sqlite/wa-sqlite.wasm" — dan karena aplikasi
// ini menyentuh SQLite sejak layar pertama, kegagalannya menjatuhkan seluruh
// bundel web, bukan satu layar saja.
config.resolver.assetExts.push('wasm');

// wa-sqlite memakai SharedArrayBuffer, yang hanya tersedia pada halaman
// ter-isolasi lintas-origin. Tanpa dua header ini bundelnya berhasil tapi
// database gagal dibuka SAAT DIJALANKAN — kegagalan yang jauh lebih
// membingungkan daripada gagal build. Ini untuk dev server; untuk hosting
// produksi, header yang sama diatur lewat plugin expo-router di app.json.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = withNativeWind(config, { input: './global.css' });
