// server/modules/laporan/laporan-mandiri.router.ts — laporan stand meter
// mandiri oleh pelanggan (self-service, wajib foto bukti). Alur status:
// MENUNGGU -> DIVERIFIKASI/DITOLAK, lalu DIGUNAKAN begitu dipakai jadi
// PembacaanMeter resmi.
import { Hono } from "hono"
import { z } from "zod"
import { StatusLaporanMandiri } from "@workspace/db"
import { prisma } from "@workspace/db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok, created, paginated } from "../../lib/response"
import { NotFoundError, ConflictError } from "../../lib/errors"
import { paginationQuerySchema, buildSkipTake, buildMeta, buildOrderBy, sortQuery } from "../../lib/pagination"
import { periodeToDate } from "../../lib/periode"

export const laporanMandiriRouter = new Hono()

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery(["createdAt", "periode", "standDilaporkan", "status", "nomorLangganan", "namaPelapor"]),
  q: z.string().trim().min(1).optional(),
  status: z.enum(StatusLaporanMandiri).optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
  pelangganId: z.string().optional(),
})

laporanMandiriRouter.get("/", requireRole(...ROLE_GROUPS.STAFF_UP), validate("query", listQuerySchema), async (c) => {
  const query = c.req.valid("query")
  const { skip, take } = buildSkipTake(query)
  const where = {
    status: query.status,
    periode: query.periode,
    pelangganId: query.pelangganId,
    ...(query.q
      ? {
          OR: [
            { nomorLangganan: { contains: query.q } },
            { namaPelapor: { contains: query.q, mode: "insensitive" as const } },
            { pelanggan: { nama: { contains: query.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  }
  const [data, total] = await Promise.all([
    prisma.laporanMandiri.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy(query, { createdAt: "desc" }),
      include: { pelanggan: { select: { id: true, nomorLangganan: true, nama: true } } },
    }),
    prisma.laporanMandiri.count({ where }),
  ])
  return paginated(c, data, buildMeta(total, query))
})

/// Ringkasan untuk halaman verifikasi: hitungan per status + daftar periode
/// yang punya data. Terdaftar SEBELUM /:id supaya "stats" tidak tertelan
/// param id.
const statsQuerySchema = z.object({
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
})

laporanMandiriRouter.get("/stats", requireRole(...ROLE_GROUPS.STAFF_UP), validate("query", statsQuerySchema), async (c) => {
  const { periode } = c.req.valid("query")
  const where = periode ? { periode } : {}
  const [perStatus, periodes] = await Promise.all([
    prisma.laporanMandiri.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.laporanMandiri.groupBy({ by: ["periode"], orderBy: { periode: "desc" }, take: 24 }),
  ])
  const hitung = Object.fromEntries(perStatus.map((s) => [s.status, s._count._all])) as Partial<
    Record<StatusLaporanMandiri, number>
  >
  const total = perStatus.reduce((acc, s) => acc + s._count._all, 0)
  return ok(c, {
    total,
    menunggu: hitung.MENUNGGU ?? 0,
    diverifikasi: (hitung.DIVERIFIKASI ?? 0) + (hitung.DIGUNAKAN ?? 0),
    ditolak: hitung.DITOLAK ?? 0,
    periodes: periodes.map((p) => p.periode),
  })
})

laporanMandiriRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const row = await prisma.laporanMandiri.findUnique({
    where: { id: c.req.param("id") },
    include: { pelanggan: true, pembacaan: true, verifiedBy: { select: { id: true, name: true } } },
  })
  if (!row) throw new NotFoundError("LaporanMandiri")
  return ok(c, row)
})

const createSchema = z.object({
  pelangganId: z.string().min(1),
  periode: z.coerce.number().int().min(190001).max(999912),
  standDilaporkan: z.coerce.number().int().min(0),
  fotoUrl: z.url(),
  fotoPublicId: z.string().trim().min(1),
  nomorPelapor: z.string().trim().min(1).max(30),
  namaPelapor: z.string().trim().min(1).max(150),
})

// Tanpa requireRole: pelanggan (role USER) memang pengirim utama laporan ini.
// @@unique([pelangganId, periode]) -> kirim dua kali utk periode sama = 409.
laporanMandiriRouter.post("/", validate("json", createSchema), async (c) => {
  const body = c.req.valid("json")
  const pelanggan = await prisma.pelanggan.findUnique({ where: { id: body.pelangganId } })
  if (!pelanggan || pelanggan.deletedAt) throw new NotFoundError("Pelanggan")

  const row = await prisma.laporanMandiri.create({
    data: { ...body, nomorLangganan: pelanggan.nomorLangganan },
  })
  return created(c, row)
})

const verifySchema = z.object({
  meterId: z.string().min(1),
  standLalu: z.coerce.number().int().min(0),
  blokTarif: z.coerce.number().int().min(1).max(4),
  /// Koreksi angka stand bila pelapor salah ketik (verifikator membandingkan
  /// dengan foto). Bila diisi, angka ini menimpa `standDilaporkan` di laporan
  /// SEKALIGUS jadi standAkhir pembacaan resmi — sengaja satu angka, bukan
  /// "dilaporkan" vs "dicatat resmi" yang ambigu dibaca di tabel maupun panel.
  standDilaporkan: z.coerce.number().int().min(0).optional(),
})

/// Verifikasi + langsung jadikan PembacaanMeter resmi (status DIGUNAKAN).
/// kategori OFFSITE — stand dilaporkan pelanggan, bukan dibaca petugas di
/// lokasi.
laporanMandiriRouter.patch("/:id/verify", requireRole(...ROLE_GROUPS.STAFF_UP), validate("json", verifySchema), async (c) => {
  const id = c.req.param("id")
  const { meterId, standLalu, blokTarif, standDilaporkan } = c.req.valid("json")
  const requester = getSessionUser(c)

  const laporan = await prisma.laporanMandiri.findUnique({ where: { id } })
  if (!laporan) throw new NotFoundError("LaporanMandiri")
  if (laporan.status !== "MENUNGGU") throw new ConflictError(`Laporan sudah diproses sebelumnya (status: ${laporan.status})`)

  const meter = await prisma.meter.findUnique({ where: { id: meterId } })
  if (!meter) throw new NotFoundError("Meter")

  const standAkhir = standDilaporkan ?? laporan.standDilaporkan

  const row = await prisma.$transaction(async (tx) => {
    const pembacaan = await tx.pembacaanMeter.create({
      data: {
        meterId,
        periode: periodeToDate(laporan.periode),
        standLalu,
        standAkhir,
        pemakaianM3: Math.max(0, standAkhir - standLalu),
        blokTarif,
        kategori: "OFFSITE",
        fotoBukti: laporan.fotoUrl,
      },
    })
    return tx.laporanMandiri.update({
      where: { id },
      data: {
        status: "DIGUNAKAN",
        verifiedAt: new Date(),
        verifiedById: requester.id,
        pembacaanId: pembacaan.id,
        // Laporan ikut dikoreksi supaya tabel /laporan-mandiri (yang membaca
        // standDilaporkan) tidak memperlihatkan angka lama yang sudah ditolak
        // verifikator.
        standDilaporkan: standAkhir,
      },
      include: { pembacaan: true },
    })
  })

  return ok(c, row)
})

const rejectSchema = z.object({ alasanDitolak: z.string().trim().min(1).max(500) })

laporanMandiriRouter.patch("/:id/reject", requireRole(...ROLE_GROUPS.STAFF_UP), validate("json", rejectSchema), async (c) => {
  const id = c.req.param("id")
  const requester = getSessionUser(c)
  const laporan = await prisma.laporanMandiri.findUnique({ where: { id } })
  if (!laporan) throw new NotFoundError("LaporanMandiri")
  if (laporan.status !== "MENUNGGU") throw new ConflictError(`Laporan sudah diproses sebelumnya (status: ${laporan.status})`)

  const row = await prisma.laporanMandiri.update({
    where: { id },
    data: { status: "DITOLAK", alasanDitolak: c.req.valid("json").alasanDitolak, verifiedAt: new Date(), verifiedById: requester.id },
  })
  return ok(c, row)
})

/// "Unverifikasi": membatalkan hasil proses — DIGUNAKAN/DIVERIFIKASI maupun
/// DITOLAK kembali ke MENUNGGU. Pembatalan laporan yang sudah jadi
/// PembacaanMeter resmi ikut menghapus pembacaannya, dan ditolak bila
/// pembacaan itu sudah dipakai Tagihan (angka penagihan tidak boleh berubah
/// diam-diam).
laporanMandiriRouter.patch("/:id/unverify", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const id = c.req.param("id")
  const laporan = await prisma.laporanMandiri.findUnique({ where: { id } })
  if (!laporan) throw new NotFoundError("LaporanMandiri")
  if (laporan.status === "MENUNGGU") throw new ConflictError("Laporan masih menunggu — belum ada hasil verifikasi untuk dibatalkan")

  if (laporan.pembacaanId) {
    const tagihan = await prisma.tagihan.findUnique({ where: { pembacaanId: laporan.pembacaanId } })
    if (tagihan) throw new ConflictError("Pembacaan resmi laporan ini sudah dipakai tagihan — tidak bisa dibatalkan")

    const pembacaanId = laporan.pembacaanId
    const row = await prisma.$transaction(async (tx) => {
      const diperbarui = await tx.laporanMandiri.update({
        where: { id },
        data: { status: "MENUNGGU", verifiedAt: null, verifiedById: null, alasanDitolak: null, pembacaanId: null },
      })
      await tx.pembacaanMeter.delete({ where: { id: pembacaanId } })
      return diperbarui
    })
    return ok(c, row)
  }

  const row = await prisma.laporanMandiri.update({
    where: { id },
    data: { status: "MENUNGGU", verifiedAt: null, verifiedById: null, alasanDitolak: null },
  })
  return ok(c, row)
})
