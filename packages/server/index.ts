// @workspace/server — Hono app (seluruh /api/*) yang di-mount oleh KEDUA
// aplikasi Next:
//   - apps/web  : agar frontend memanggil /api/* SAME-ORIGIN (cookie auth +
//                 rate-limit per-IP benar, tanpa CORS) — persis seperti
//                 monolit lama.
//   - apps/api  : endpoint yang sama untuk klien eksternal/mobile (Bearer).
//
// Semua logic hidup di ./app, ./lib, ./modules. Route Next tiap app cuma
// membungkus `app` ini lewat hono/vercel.
export { app } from "./app"
