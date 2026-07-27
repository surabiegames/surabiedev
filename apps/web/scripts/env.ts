// apps/web/scripts/env.ts — memuat .env ROOT MONOREPO untuk skrip CLI di
// folder ini.
//
// `import "dotenv/config"` saja TIDAK cukup: ia hanya melihat cwd, sedangkan
// skrip ini dijalankan dari apps/web sementara .env-nya ada di root repo.
// Gejalanya menyesatkan — bukan "env tidak ada", melainkan error koneksi
// database yang membingungkan ("SASL: client password must be a string").
// Path dihitung dari lokasi file ini, bukan dari cwd, supaya skrip tetap
// jalan dari direktori mana pun.

import { config as loadEnv } from "dotenv"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const dirIni = resolve(fileURLToPath(import.meta.url), "..")
// apps/web/scripts -> apps/web -> apps -> root monorepo
loadEnv({ path: resolve(dirIni, "../../../.env") })
// .env lokal app (kalau ada) tidak menimpa yang sudah terisi di atas.
loadEnv()
