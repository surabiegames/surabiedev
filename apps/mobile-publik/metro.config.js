// metro.config.js — konfigurasi Metro untuk monorepo pnpm + NativeWind.
// Tanpa `withNativeWind` tidak ada pipeline CSS: class `className` TIDAK
// ter-generate di release build (`bundleRelease`) sehingga komponen ter-render
// tanpa style / tak terlihat di HP walau di dev tampak normal.
//
// Dua penyesuaian monorepo:
//   1. watchFolders → sertakan root repo supaya Metro memantau paket bersama.
//   2. nodeModulesPaths → resolusi mencari di node_modules app DAN root.
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

module.exports = withNativeWind(config, { input: './global.css' });
