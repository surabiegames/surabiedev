// prisma/seed/lib/db.ts — singleton PrismaClient untuk seed script, pola
// sama seperti auth.ts (driver adapter pg, bukan connection string
// bawaan Prisma).
//
// CATATAN PENTING: import PrismaClient dari "../../../generated/client",
// yaitu ROOT package hasil generate (folder `generated/client` memang nama
// foldernya — di dalamnya ada package.json sendiri), BUKAN dari subpath
// "/client"-nya. Sudah diverifikasi: import lewat subpath "/client"
// (re-export "export * from
// './index'") membuat TypeScript GAGAL meng-infer generic ClientOptions
// dengan benar — 33 dari 37 getter model (semua KECUALI user/account/
// session/spatial_ref_sys) hilang dari tipe hasil ("Property 'x' does not
// exist on type PrismaClient<never, ...>"), walau constructor dipanggil
// benar dengan `{ adapter }`. Import dari root package tidak kena masalah
// ini sama sekali. auth.ts juga sudah disamakan ke pola ini.
// Dijalankan lewat `tsx` langsung (pnpm db:seed), bukan lewat `prisma`
// CLI — tsx TIDAK auto-load .env seperti prisma.config.ts, jadi tanpa
// baris ini DATABASE_URL bakal undefined dan @prisma/adapter-pg gagal
// dengan pesan error yang menyesatkan ("SASL: ... client password must
// be a string") alih-alih "env var tidak ada".
//
// .env-nya ada di ROOT monorepo, sedangkan seed dijalankan dengan cwd
// packages/db — `import "dotenv/config"` saja (yang cuma melihat cwd)
// TIDAK menemukannya. Karena itu path root dihitung eksplisit dari lokasi
// file ini, bukan dari cwd, supaya seed tetap jalan dari direktori mana pun.
import { config as loadEnv } from "dotenv"
import { resolve } from "node:path"
import { PrismaClient } from "../../../generated/client"
import { PrismaPg } from "@prisma/adapter-pg"

// lib -> seed -> prisma -> db -> packages -> root monorepo
loadEnv({ path: resolve(__dirname, "../../../../../.env") })
// .env lokal paket (kalau ada) TIDAK menimpa yang sudah terisi di atas —
// perilaku bawaan dotenv: variabel yang sudah ada tidak ditimpa.
loadEnv()

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL tidak ditemukan di environment — cek file .env di root monorepo (/home/.../surabiedev/.env)."
  )
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

export const prisma = new PrismaClient({ adapter })

export type PrismaClientLike = typeof prisma
