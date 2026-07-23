import "server-only"

// features/dashboard/lib/queries.ts — pengambilan data untuk halaman
// dashboard (server component).
//
// KENAPA MEMANGGIL SERVICE/PRISMA LANGSUNG, BUKAN fetch KE /api/v1/dashboard:
// halaman ini dirender di server yang SAMA dengan API-nya. Memanggil API
// sendiri lewat HTTP berarti: satu perjalanan jaringan sia-sia, harus
// meneruskan cookie sesi secara manual, dan butuh URL absolut (yang berbeda
// antara dev/produksi) — semuanya tanpa manfaat. Endpoint /api/v1/dashboard/*
// tetap ada dan berguna untuk pemanggil LUAR (aplikasi mobile, widget client
// yang perlu refresh tanpa reload).
//
// Bandingkan dengan features/publik: di sana komponen memang client dan
// memanggil /api/public lewat fetch — karena rate limit-nya berbasis IP
// pemakai, bukan IP server.
import { prisma } from "@workspace/db"
import { dateToPeriode } from "@workspace/domain/periode"

async function periodeTerakhir(): Promise<Date | null> {
  const baris = await prisma.tagihan.findFirst({ orderBy: { periode: "desc" }, select: { periode: true } })
  return baris?.periode ?? null
}

/// Semua lewat agregasi database — tabel pelanggan & tagihan >22.000 baris,
/// menariknya ke JS lalu menghitung di sana akan menyeret puluhan ribu baris
/// setiap halaman dibuka.
export async function ambilRingkasan() {
  const periode = await periodeTerakhir()

  const [pelangganAktif, pelangganNonAktif, tagihanPeriode, tunggakan, pengaduanBelumSelesai, pengaduanDarurat, laporanMenunggu] =
    await Promise.all([
      prisma.pelanggan.count({ where: { deletedAt: null, status: "AKTIF" } }),
      prisma.pelanggan.count({ where: { deletedAt: null, status: { not: "AKTIF" } } }),
      periode
        ? prisma.tagihan.aggregate({ where: { periode }, _count: true, _sum: { totalTagihan: true, pemakaianM3: true } })
        : null,
      prisma.tagihan.aggregate({
        where: { status: { in: ["BELUM_BAYAR", "JATUH_TEMPO"] } },
        _count: true,
        _sum: { totalTagihan: true },
      }),
      prisma.pengaduan.count({ where: { status: { in: ["BARU", "DITUGASKAN", "DIPROSES"] } } }),
      prisma.pengaduan.count({ where: { status: { notIn: ["SELESAI", "DITOLAK"] }, prioritas: "DARURAT" } }),
      prisma.laporanMandiri.count({ where: { status: "MENUNGGU" } }),
    ])

  return {
    periode: periode ? dateToPeriode(periode) : null,
    pelanggan: { aktif: pelangganAktif, nonAktif: pelangganNonAktif },
    tagihanPeriode: {
      jumlah: tagihanPeriode?._count ?? 0,
      nilai: tagihanPeriode?._sum.totalTagihan ?? 0,
      pemakaianM3: tagihanPeriode?._sum.pemakaianM3 ?? 0,
    },
    tunggakan: { jumlah: tunggakan._count, nilai: tunggakan._sum.totalTagihan ?? 0 },
    pengaduan: { belumSelesai: pengaduanBelumSelesai, darurat: pengaduanDarurat },
    laporanMandiriMenunggu: laporanMenunggu,
  }
}

export async function ambilTren() {
  const terakhir = await periodeTerakhir()
  if (!terakhir) return []
  const mulai = new Date(Date.UTC(terakhir.getUTCFullYear(), terakhir.getUTCMonth() - 5, 1))

  const baris = await prisma.tagihan.groupBy({
    by: ["periode"],
    where: { periode: { gte: mulai, lte: terakhir } },
    _sum: { totalTagihan: true, pemakaianM3: true },
    _count: true,
    orderBy: { periode: "asc" },
  })

  return baris.map((b) => ({
    periode: dateToPeriode(b.periode),
    jumlahTagihan: b._count,
    nilai: b._sum.totalTagihan ?? 0,
    pemakaianM3: b._sum.pemakaianM3 ?? 0,
  }))
}

export async function ambilPerluTindakan() {
  const [pengaduan, laporanMandiri] = await Promise.all([
    prisma.pengaduan.findMany({
      where: { status: { in: ["BARU", "DITUGASKAN", "DIPROSES"] } },
      orderBy: [{ prioritas: "desc" }, { createdAt: "asc" }],
      take: 5,
      select: { id: true, nomorTiket: true, jenis: true, judul: true, status: true, prioritas: true, createdAt: true },
    }),
    prisma.laporanMandiri.findMany({
      where: { status: "MENUNGGU" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: {
        id: true,
        nomorLangganan: true,
        periode: true,
        standDilaporkan: true,
        createdAt: true,
        pelanggan: { select: { nama: true } },
      },
    }),
  ])
  return { pengaduan, laporanMandiri }
}
