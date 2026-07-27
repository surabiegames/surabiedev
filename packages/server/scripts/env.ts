// packages/server/scripts/env.ts — memuat .env ROOT MONOREPO untuk skrip CLI
// di folder ini. Pola & alasannya sama seperti apps/web/scripts/env.ts:
// `import "dotenv/config"` hanya melihat cwd, sedangkan .env-nya ada di root
// repo — gejalanya bukan "env tidak ada" melainkan error koneksi database
// yang membingungkan.

import { config as loadEnv } from "dotenv"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const dirIni = resolve(fileURLToPath(import.meta.url), "..")
// packages/server/scripts -> packages/server -> packages -> root monorepo
loadEnv({ path: resolve(dirIni, "../../../.env") })
loadEnv()
