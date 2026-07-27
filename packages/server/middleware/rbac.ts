// server/middleware/rbac.ts — role-based access control di atas session
// yang sudah diverifikasi oleh @hono/auth-js verifyAuth() (dipasang blanket
// di server/app.ts, jadi middleware ini TIDAK perlu cek "apakah login" lagi
// — getSessionUser() sudah lempar 401 kalau somehow belum ada session).
import type { MiddlewareHandler } from "hono"
import type { Role } from "@workspace/db"
import { ForbiddenError } from "../lib/errors"
import { getSessionUser } from "../lib/session"

/// Grup role kumulatif dari atas ke bawah struktur organisasi (lihat
/// enum Role di prisma/auth.prisma). SUPER_ADMIN selalu ikut semua grup.
export const ROLE_GROUPS = {
  ADMIN: ["SUPER_ADMIN"],
  SENIOR_UP: ["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER"],
  MANAGEMENT_UP: ["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER", "MANAGER"],
  SUPERVISOR_UP: ["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER", "MANAGER", "SUPERVISOR"],
  STAFF_UP: ["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER", "MANAGER", "SUPERVISOR", "STAFF"],
  /// Petugas lapangan. PELAKSANA SENGAJA TIDAK ADA di STAFF_UP: jenjangnya
  /// bukan lebih rendah dari STAFF, melainkan LAIN — ia tidak boleh masuk
  /// layar dashboard/verifikasi/closing/data induk yang dijaga STAFF_UP.
  /// Grup ini untuk endpoint yang memang miliknya: rute-saya, setor
  /// pencatatan, unggah bukti. Atasannya ikut disertakan supaya supervisor
  /// bisa membuka layar yang sama saat mendampingi petugas.
  LAPANGAN: ["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER", "MANAGER", "SUPERVISOR", "STAFF", "PELAKSANA"],
  ANY: ["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER", "MANAGER", "SUPERVISOR", "STAFF", "PELAKSANA", "USER"],
} as const satisfies Record<string, readonly Role[]>

export function requireRole(...roles: readonly Role[]): MiddlewareHandler {
  return async (c, next) => {
    const user = getSessionUser(c)
    if (!roles.includes(user.role)) {
      throw new ForbiddenError(`Aksi ini memerlukan salah satu role: ${roles.join(", ")}`)
    }
    await next()
  }
}
