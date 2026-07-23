// app/api/[[...route]]/route.ts — mount Hono app (@workspace/server) di dalam
// apps/web supaya frontend memanggil /api/* SAME-ORIGIN. Ini yang membuat
// fetch("/api/public/...") & fetch("/api/v1/...") di features/** bekerja
// (cookie sesi Auth.js ikut otomatis, rate-limit per-IP benar, tanpa CORS) —
// persis perilaku monolit lama. apps/api me-mount app yang SAMA untuk klien
// eksternal/mobile.
import { handle } from "hono/vercel"
import { app } from "@workspace/server"

// Butuh Prisma (driver adapter pg) -> wajib Node runtime, bukan edge.
export const runtime = "nodejs"

export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const PATCH = handle(app)
export const DELETE = handle(app)
// OPTIONS wajib ikut: tanpa ini Next menjawab preflight sendiri tanpa header
// CORS dan request lintas-origin gagal sebelum menyentuh middleware Hono.
export const OPTIONS = handle(app)
