// @workspace/db — sumber tunggal PrismaClient + seluruh tipe Prisma untuk
// semua workspace (apps/web, apps/api, dst). Satu pool koneksi
// (@prisma/adapter-pg) per proses, di-cache lewat globalThis di dev supaya
// hot-reload Next.js tidak membuka pool baru setiap file berubah.
//
// PENTING: PrismaClient diimpor dari folder generated ("./generated/client"),
// yaitu ROOT package hasil generate — BUKAN subpath "/client"-nya. Subpath
// itu merusak inferensi tipe delegate model (lihat catatan di prisma/README).
// Output client sengaja di LUAR folder "prisma" supaya tidak ikut terpindai
// saat generate/migrate (skema salinan di dalam output = generator ganda).
import { PrismaClient } from "./generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Mengekspor ulang semua tipe data Prisma (enum Role, model, dll) agar bisa
// dipakai lintas workspace lewat `import { ... } from "@workspace/db"`.
export * from "./generated/client";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL tidak ditemukan di environment — cek file .env di root project.",
  );
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
