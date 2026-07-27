// .env-nya ada di ROOT monorepo, sedangkan perintah prisma dijalankan
// dengan cwd packages/db — `import "dotenv/config"` saja (yang hanya
// melihat cwd) TIDAK menemukannya, dan gagalnya menyesatkan: "The
// datasource.url property is required in your Prisma config file".
// Path root dihitung eksplisit dari lokasi file ini, bukan dari cwd.
// Pola yang sama dipakai di prisma/seed/lib/db.ts.
// Ditelusuri NAIK dari cwd (bukan `import.meta.url`/`__dirname`) supaya file
// ini aman dimuat baik sebagai CJS maupun ESM — prisma CLI memuatnya
// sendiri, dan menebak format modulnya salah bikin gagal di salah satu sisi.
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig } from "prisma/config";

function cariEnvKeAtas(): string | undefined {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const kandidat = resolve(dir, ".env");
    if (existsSync(kandidat)) return kandidat;
    const induk = dirname(dir);
    if (induk === dir) break;
    dir = induk;
  }
  return undefined;
}

const berkasEnv = cariEnvKeAtas();
if (berkasEnv) loadEnv({ path: berkasEnv });

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
