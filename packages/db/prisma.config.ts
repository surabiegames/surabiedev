import "dotenv/config";
import { defineConfig } from "prisma/config";

// Skema multi-file: seluruh *.prisma di folder "prisma" (auth, operasional,
// pelanggan, dst) digabung Prisma saat generate/migrate. WAJIB menunjuk
// folder — bukan satu file — kalau tidak, hanya schema.prisma (yang cuma
// berisi generator + datasource, tanpa model) yang terbaca, dan client
// ter-generate KOSONG (PrismaClient tanpa delegate model).
export default defineConfig({
  schema: "prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/index.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    // Shadow DB untuk `migrate dev` — WAJIB di-set kalau DATABASE_URL
    // menunjuk Postgres terkelola (Neon) yang tak mengizinkan CREATE
    // DATABASE. Untuk Postgres lokal docker-compose bisa dikosongkan.
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
