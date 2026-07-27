// apps/web/scripts/bootstrap-pencatat.ts — membuat akun login (role STAFF) untuk
// SETIAP Pencatat aktif yang belum tertaut akun User, lalu menautkannya
// (Pencatat.userId). Jalankan: pnpm db:bootstrap-pencatat
//
// Kenapa script terpisah (pola yang sama dengan bootstrap-admin): pembuatan
// akun login adalah tindakan istimewa yang harus disadari, bukan efek
// samping impor data. Idempoten — pencatat yang sudah tertaut dilewati,
// dijalankan ulang tidak membuat duplikat.
//
// Kredensial yang dihasilkan:
//   username = namaLapangan huruf kecil, non-alfanumerik jadi titik
//              (mis. "IWAN" -> iwan); bila bentrok diberi angka (iwan2).
//   email    = <username>@pencatat.tirtawening.local — placeholder internal
//              (BUKAN mailbox nyata): kolom email wajib unik, dan login
//              mobile memakai username. Login Google tidak akan pernah cocok
//              dengan domain ini — memang bukan untuk itu.
//   password = env BOOTSTRAP_PENCATAT_PASSWORD, default "Pencatat#2026".
//              SATU password untuk semua akun baru — segera minta tiap
//              petugas menggantinya (dashboard web: menu Pengguna → reset).
//
// WAJIB dijalankan lewat pnpm (tsx --conditions=react-server) — alasan sama
// dengan bootstrap-admin: @workspace/auth/password mengimpor "server-only".
import "./env"
import { hashPassword } from "@workspace/auth/password"
import { prisma } from "@workspace/db"

function usernameDari(namaLapangan: string): string {
  return (
    namaLapangan
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "") || "pencatat"
  )
}

async function main() {
  const password = process.env.BOOTSTRAP_PENCATAT_PASSWORD ?? "Pencatat#2026"
  const tanpaAkun = await prisma.pencatat.findMany({
    where: { isAktif: true, userId: null },
    orderBy: { namaLapangan: "asc" },
  })
  if (tanpaAkun.length === 0) {
    console.log("Semua pencatat aktif sudah punya akun — tidak ada yang dibuat.")
    return
  }

  // PENEMPATAN WAJIB. Petugas pencatat adalah anggota SubBagian "Pencatatan
  // Meter" pada Bagian pelayanan wilayahnya — tanpa ini akunnya mengambang
  // tanpa induk, dan tidak ada yang bisa menjawab "petugas ini bagian mana".
  // Default SUB-PW5-CATER karena seluruh data operasional kita Wilayah 5;
  // wilayah lain tinggal menimpanya lewat env.
  const kodeSubBagian = process.env.BOOTSTRAP_PENCATAT_SUBBAGIAN ?? "SUB-PW5-CATER"
  const subBagian = await prisma.subBagian.findUnique({
    where: { kode: kodeSubBagian },
    include: { bagian: { include: { divisi: true } } },
  })
  if (!subBagian) {
    console.error(
      [
        `SubBagian "${kodeSubBagian}" tidak ada di database.`,
        "Jalankan seed step 01 lebih dulu (hierarki organisasi dibuat di sana),",
        "atau tentukan yang lain lewat BOOTSTRAP_PENCATAT_SUBBAGIAN=<kode>.",
      ].join("\n"),
    )
    process.exit(1)
  }
  console.log(
    `Penempatan: ${subBagian.bagian.divisi.nama} > ${subBagian.bagian.nama} > ${subBagian.nama}\n`,
  )

  const passwordHash = await hashPassword(password)
  const dibuat: string[] = []

  for (const pencatat of tanpaAkun) {
    const dasar = usernameDari(pencatat.namaLapangan)
    // Hindari bentrok username/email dengan akun yang sudah ada.
    let username = dasar
    for (let n = 2; ; n++) {
      const ada = await prisma.user.findFirst({
        where: { OR: [{ username }, { email: `${username}@pencatat.tirtawening.local` }] },
        select: { id: true },
      })
      if (!ada) break
      username = `${dasar}${n}`
    }

    const user = await prisma.user.create({
      data: {
        email: `${username}@pencatat.tirtawening.local`,
        name: pencatat.namaLengkap ?? pencatat.namaLapangan,
        username,
        passwordHash,
        // PELAKSANA, bukan STAFF: petugas lapangan bukan staf kantor dan
        // aksesnya memang berbeda — lihat catatan enum Role di auth.prisma
        // dan grup LAPANGAN di middleware/rbac.ts.
        role: "PELAKSANA",
        status: "ACTIVE",
        divisiId: subBagian.bagian.divisiId,
        bagianId: subBagian.bagianId,
        subBagianId: subBagian.id,
        // divisiKode & subBagianKode DENORMALISASI — dibaca langsung dari JWT
        // oleh middleware edge, wajib ikut diisi (lihat auth.prisma).
        divisiKode: subBagian.bagian.divisi.kode,
        subBagianKode: subBagian.kode,
      },
    })
    await prisma.pencatat.update({ where: { id: pencatat.id }, data: { userId: user.id } })
    dibuat.push(username)
  }

  console.log(`Akun dibuat & ditautkan: ${dibuat.length}`)
  for (const u of dibuat) console.log(`  - ${u}`)
  console.log(
    `Password awal semua akun di atas: "${password}" — minta tiap petugas menggantinya.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
