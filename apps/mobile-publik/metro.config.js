// metro.config.js — konfigurasi Metro untuk monorepo pnpm. Tanpa ini Metro
// tidak "melihat" paket workspace (@workspace/mobile-ui) yang di-symlink dan
// tidak menelusuri node_modules di root repo.
//
// Dua penyesuaian wajib untuk monorepo:
//   1. watchFolders → sertakan root repo supaya Metro memantau paket bersama.
//   2. nodeModulesPaths → resolusi mencari di node_modules app DAN root.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
