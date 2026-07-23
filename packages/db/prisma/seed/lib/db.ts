// prisma/seed/lib/db.ts — singleton PrismaClient untuk seed script, pola
// sama seperti auth.ts (driver adapter pg, bukan connection string
// bawaan Prisma).
//
// CATATAN PENTING: import PrismaClient dari "@/app/generated/prisma"
// (root package), BUKAN dari "@/app/generated/prisma/client". Sudah
// diverifikasi: import lewat subpath "/client" (re-export "export * from
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
import "dotenv/config"
import { PrismaClient } from "@/app/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL tidak ditemukan di environment — cek file .env di root project.")
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

export const prisma = new PrismaClient({ adapter })

export type PrismaClientLike = typeof prisma
