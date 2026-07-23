// @workspace/auth — barrel Node-only. Mengumpulkan konfigurasi Auth.js
// LENGKAP (Prisma adapter + argon2) beserta instance NextAuth
// (auth/signIn/signOut/handlers) dan helper password.
//
// PENTING soal batas runtime:
//   - Import "@workspace/auth" (barrel ini) HANYA dari kode Node
//     (RSC/server action apps/web, server Hono apps/api). Ia menyeret Prisma,
//     @node-rs/argon2, dan "server-only" — akan meledak di edge/klien.
//   - Untuk edge runtime (proxy.ts / middleware) pakai "@workspace/auth/config"
//     yang edge-safe (tanpa Prisma).
//   - Untuk sekadar hashing/verifikasi password pakai "@workspace/auth/password".
export * from "./auth";
export * from "./auth.config";
export * from "./password";
