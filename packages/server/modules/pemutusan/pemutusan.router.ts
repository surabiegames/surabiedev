// server/modules/pemutusan/pemutusan.router.ts — riwayat pemutusan
// sambungan (TSM/SPT dari closing resmi, LAINNYA dari survei lapangan).
//
// KEPUTUSAN PENTING (konsisten dengan seed, lihat prisma/README.md):
// endpoint ini TIDAK PERNAH mengubah `Pelanggan.status` secara otomatis.
// Pencatatan pemutusan dan perubahan status pelanggan adalah dua keputusan
// bisnis terpisah — status pelanggan diubah eksplisit lewat PATCH
// /pelanggan/:id supaya tidak ada efek samping tersembunyi di data billing.
//
// `pelangganId` opsional: 219 titik "Eks Pelanggan" dari survei geojson
// adalah histori cabut lama yang nolg-nya kerap tidak ada di tabel
// Pelanggan. Snapshot `nomorLangganan`/`namaPelanggan` tetap diisi supaya
// baris orphan tidak kehilangan identitas.
import { Hono } from "hono"
import { z } from "zod"
import { JenisPemutusan } from "@workspace/db"
import { prisma } from "@workspace/db"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok, created, paginated } from "../../lib/response"
import { NotFoundError } from "../../lib/errors"
import { recordAudit, auditMetaFromRequest } from "../../lib/audit"
import { paginationQuerySchema, buildSkipTake, buildMeta, buildOrderBy, sortQuery } from "../../lib/pagination"
import { GEO, setPoint, getPointGeoJson, getPointGeoJsonMany } from "../../lib/spatial"

export const pemutusanRouter = new Hono()

const listQuerySchema = paginationQuerySchema.extend({
  ...sortQuery(["createdAt", "periode", "jenis", "nomorLangganan", "namaPelanggan", "tanggalSPT"]),
  q: z.string().trim().min(1).optional(),
  pelangganId: z.string().optional(),
  jenis: z.enum(JenisPemutusan).optional(),
  periode: z.coerce.number().int().min(190001).max(999912).optional(),
  sumberData: z.string().optional(),
})

pemutusanRouter.get("/", requireRole(...ROLE_GROUPS.STAFF_UP), validate("query", listQuerySchema), async (c) => {
  const query = c.req.valid("query")
  const { skip, take } = buildSkipTake(query)
  const where = {
    pelangganId: query.pelangganId,
    jenis: query.jenis,
    periode: query.periode,
    sumberData: query.sumberData,
    ...(query.q
      ? { OR: [{ nomorLangganan: { contains: query.q } }, { namaPelanggan: { contains: query.q, mode: "insensitive" as const } }] }
      : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.pemutusan.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy(query, { createdAt: "desc" }),
      include: {
        pelanggan: { select: { id: true, nomorLangganan: true, nama: true } },
        kelurahan: { select: { id: true, nama: true } },
      },
    }),
    prisma.pemutusan.count({ where }),
  ])
  const koord = await getPointGeoJsonMany(prisma, GEO.pemutusan, rows.map((r) => r.id))
  return paginated(c, rows.map((r) => ({ ...r, koordinatVerifikasi: koord.get(r.id) ?? null })), buildMeta(total, query))
})

pemutusanRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const id = c.req.param("id")
  const row = await prisma.pemutusan.findUnique({ where: { id }, include: { pelanggan: true, kelurahan: true, kecamatan: true } })
  if (!row) throw new NotFoundError("Pemutusan")
  return ok(c, { ...row, koordinatVerifikasi: await getPointGeoJson(prisma, GEO.pemutusan, id) })
})

const createSchema = z.object({
  pelangganId: z.string().min(1).nullable().optional(),
  kelurahanId: z.string().min(1).nullable().optional(),
  kecamatanId: z.string().min(1).nullable().optional(),
  nomorLangganan: z.string().trim().max(20).nullable().optional(),
  namaPelanggan: z.string().trim().max(200).nullable().optional(),
  jenis: z.enum(JenisPemutusan),
  periode: z.coerce.number().int().min(190001).max(999912),
  nomorSurat: z.string().trim().max(100).nullable().optional(),
  tanggalPermohonan: z.coerce.date().nullable().optional(),
  nomorSPT: z.string().trim().max(100).nullable().optional(),
  tanggalSPT: z.coerce.date().nullable().optional(),
  tanggalTutup: z.coerce.date().nullable().optional(),
  tanggalCabut: z.coerce.date().nullable().optional(),
  koordinatVerifikasi: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable().optional(),
  catatanSurveiAsli: z.string().max(1000).nullable().optional(),
  catatan: z.string().max(500).nullable().optional(),
})

pemutusanRouter.post("/", requireRole(...ROLE_GROUPS.SUPERVISOR_UP), validate("json", createSchema), async (c) => {
  const { koordinatVerifikasi, ...body } = c.req.valid("json")
  const requester = getSessionUser(c)
  const { ipAddress, userAgent } = auditMetaFromRequest(c.req.raw)

  const row = await prisma.$transaction(async (tx) => {
    const row = await tx.pemutusan.create({
      data: { ...body, sumberData: "API", prosesOlehId: requester.id },
    })
    if (koordinatVerifikasi) await setPoint(tx, GEO.pemutusan, row.id, koordinatVerifikasi.lat, koordinatVerifikasi.lng)
    await recordAudit(tx, {
      userId: requester.id,
      aksi: `PEMUTUSAN_${body.jenis}`,
      entitas: "Pemutusan",
      entitasId: row.id,
      perubahan: { after: row },
      ipAddress,
      userAgent,
    })
    return row
  })

  return created(c, {
    ...row,
    koordinatVerifikasi: koordinatVerifikasi ? { type: "Point", coordinates: [koordinatVerifikasi.lng, koordinatVerifikasi.lat] } : null,
  })
})
