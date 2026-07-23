// prisma/seed/bootstrap-admin.ts — membuat akun SUPER_ADMIN pertama.
// Jalankan: pnpm db:bootstrap-admin
//
// KENAPA SCRIPT INI ADA (jangan dihapus): tanpa satu pun baris User, sistem
// TERKUNCI TOTAL dan tidak ada jalan masuk sama sekali —
//   - login Google ditolak kalau email-nya belum terdaftar sebagai User
//     (auth.ts: callbacks.signIn mengembalikan false untuk user baru),
//   - login Credentials butuh User yang sudah ada (query by username),
//   - POST /api/v1/users butuh session SUPER_ADMIN yang sudah login.
// Ketiganya melingkar. Script ini satu-satunya pemutus lingkaran itu, dan
// SENGAJA di luar alur `pnpm db:seed` (yang khusus impor CSV) supaya
// pembuatan akun istimewa selalu jadi tindakan manual yang disadari, bukan
// efek samping impor data.
//
// EMAIL adalah satu-satunya yang wajib: halaman login memakai Google OAuth,
// dan yang dicocokkan Auth.js saat login Google adalah email. PASSWORD
// opsional — hanya perlu kalau ingin akun ini juga bisa login lewat
// provider Credentials (mis. cadangan saat Google bermasalah).
//
// Idempoten: dijalankan berkali-kali hanya memperbarui akun yang sama
// (dicocokkan lewat email), tidak membuat duplikat.
// CATATAN: script ini WAJIB dijalankan lewat `pnpm db:bootstrap-admin`, yang
// memakai `tsx --conditions=react-server`. Sebabnya @/lib/password mengimpor
// "server-only" — penjaga khusus Next yang sengaja MELEDAK bila dimuat di
// luar konteks server. Flag itu membuat Node me-resolve "server-only" ke
// modul kosong, sama seperti yang dilakukan Next untuk kode servernya.
// Menjalankan `npx tsx prisma/seed/bootstrap-admin.ts` langsung akan gagal.
import "dotenv/config"
import { hashPassword } from "@/lib/password"
import { prisma } from "./lib/db"


function fail(pesan: string): never {
  console.error(pesan)
  process.exit(1)
}

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()
  const nama = process.env.BOOTSTRAP_ADMIN_NAME ?? "Super Admin"
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim()
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD

  if (!email) {
    fail(
      [
        "BOOTSTRAP_ADMIN_EMAIL wajib diisi. Contoh:",
        "",
        "  BOOTSTRAP_ADMIN_EMAIL=nama.anda@gmail.com pnpm db:bootstrap-admin",
        "",
        "Email HARUS sama persis dengan akun Google yang akan dipakai login —",
        "itulah yang dicocokkan Auth.js saat login Google.",
        "",
        "Opsional:",
        "  BOOTSTRAP_ADMIN_NAME='Super Admin'",
        "  BOOTSTRAP_ADMIN_USERNAME=admin       # + PASSWORD, bila ingin login Credentials juga",
        "  BOOTSTRAP_ADMIN_PASSWORD=<min 8 karakter>",
      ].join("\n")
    )
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`Email tidak valid: ${email}`)
  if (password && password.length < 8) fail("BOOTSTRAP_ADMIN_PASSWORD minimal 8 karakter.")
  if (password && !username) fail("BOOTSTRAP_ADMIN_USERNAME wajib diisi bila BOOTSTRAP_ADMIN_PASSWORD diberikan.")

  const passwordHash = password ? await hashPassword(password) : undefined

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "SUPER_ADMIN", status: "ACTIVE", ...(username ? { username } : {}), ...(passwordHash ? { passwordHash } : {}) },
    create: { email, name: nama, role: "SUPER_ADMIN", status: "ACTIVE", username: username ?? null, passwordHash: passwordHash ?? null },
  })

  console.log(`OK — SUPER_ADMIN siap`)
  console.log(`   email : ${user.email}`)
  console.log(`   nama  : ${user.name}`)
  console.log(`   login : Google OAuth${user.passwordHash ? ` + Credentials (username: ${user.username})` : ""}`)
  console.log("")
  console.log("Buka /login lalu masuk dengan akun Google di atas.")
  console.log("Setelah itu buat akun lain lewat POST /api/v1/users, dan hapus variabel BOOTSTRAP_ADMIN_* dari environment.")

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error("Gagal membuat admin:", err)
  await prisma.$disconnect()
  process.exitCode = 1
})
