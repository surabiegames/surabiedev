// prisma/seed/reset-pencatat-password.ts — set ULANG password SEMUA akun
// pencatat aktif ke satu nilai (default "1234", override lewat
// RESET_PENCATAT_PASSWORD). Untuk pengujian lapangan: tiap petugas login
// dengan username = nama pencatat + password ini.
//
// Berbeda dari bootstrap-pencatat (yang MEMBUAT akun baru & melewati yang
// sudah ada), script ini menimpa passwordHash akun yang SUDAH tertaut —
// tindakan istimewa yang sengaja dipisah agar tidak jadi efek samping.
//
// PERINGATAN: "1234" adalah password lemah untuk pengujian. Sebelum dipakai
// di lapangan sungguhan, minta tiap petugas menggantinya (dashboard web:
// Pengguna → reset), atau jalankan ulang dengan RESET_PENCATAT_PASSWORD yang
// kuat.
//
// WAJIB via pnpm (tsx --conditions=react-server) — @/lib/password mengimpor
// "server-only".
import "dotenv/config"
import { hashPassword } from "@/lib/password"
import { prisma } from "./lib/db"

async function main() {
  const password = process.env.RESET_PENCATAT_PASSWORD ?? "1234"
  const pencatat = await prisma.pencatat.findMany({
    where: { isAktif: true, userId: { not: null } },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { namaLapangan: "asc" },
  })
  if (pencatat.length === 0) {
    console.log("Tidak ada akun pencatat tertaut — jalankan pnpm db:bootstrap-pencatat dulu.")
    return
  }

  const passwordHash = await hashPassword(password)
  const diubah: string[] = []
  for (const p of pencatat) {
    if (!p.user) continue
    await prisma.user.update({
      where: { id: p.user.id },
      // Sekaligus pastikan ACTIVE — akun nonaktif ditolak saat login.
      data: { passwordHash, status: "ACTIVE" },
    })
    diubah.push(p.user.username ?? p.namaLapangan)
  }

  console.log(`Password direset untuk ${diubah.length} akun pencatat → "${password}"`)
  for (const u of diubah) console.log(`  - ${u}`)
  console.log("Login mobile: username = nama di atas, password = " + password)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
