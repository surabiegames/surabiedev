// app/api/[[...route]]/route.ts — satu-satunya Next.js route file untuk
// seluruh API. Cuma re-export `app` dari @/server/app (Hono app
// sesungguhnya, termasuk /api/auth/* via @hono/auth-js) lewat adapter
// hono/vercel — semua logic ada di server/**, bukan di sini, supaya file di
// dalam app/ tidak dicoba di-treat sebagai route/page tambahan oleh
// Next.js app-router.
import { handle } from "hono/vercel"
import { app } from "@workspace/server"

// Route ini butuh Prisma (driver adapter pg) -> wajib Node runtime, bukan
// edge. Dibuat eksplisit supaya tidak diam-diam berubah kalau default
// Next.js berubah di versi mendatang.
export const runtime = "nodejs"

export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const PATCH = handle(app)
export const DELETE = handle(app)
// OPTIONS wajib ikut: tanpa ini Next menjawab preflight CORS sendiri
// (204 TANPA header Access-Control-*) dan request lintas-origin dari
// browser (mis. Flutter Web) gagal sebelum menyentuh middleware cors Hono.
export const OPTIONS = handle(app)
