// server/modules/pelanggan/pelanggan.router.ts — endpoint HTTP tipis di
// atas pelanggan.service.ts. Route statis (/near) didaftarkan SEBELUM
// route param (/:id) supaya Hono tidak mencoba mencocokkan "near" sebagai
// :id lebih dulu.
import { Hono } from "hono"
import { validate } from "../../lib/validate"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { ok, created, paginated } from "../../lib/response"
import { createPelangganSchema, updatePelangganSchema, listPelangganQuerySchema, nearPelangganQuerySchema } from "./pelanggan.schema"
import * as service from "./pelanggan.service"

export const pelangganRouter = new Hono()

pelangganRouter.get("/near", requireRole(...ROLE_GROUPS.STAFF_UP), validate("query", nearPelangganQuerySchema), async (c) => {
  const query = c.req.valid("query")
  const data = await service.findPelangganNear(query)
  return ok(c, data)
})

pelangganRouter.get("/", requireRole(...ROLE_GROUPS.STAFF_UP), validate("query", listPelangganQuerySchema), async (c) => {
  const query = c.req.valid("query")
  const requester = getSessionUser(c)
  const { data, meta } = await service.listPelanggan(query, requester)
  return paginated(c, data, meta)
})

pelangganRouter.get("/:id", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  const requester = getSessionUser(c)
  const row = await service.getPelangganById(c.req.param("id"), requester)
  return ok(c, row)
})

pelangganRouter.post("/", requireRole(...ROLE_GROUPS.SUPERVISOR_UP), validate("json", createPelangganSchema), async (c) => {
  const requester = getSessionUser(c)
  const row = await service.createPelanggan(c.req.valid("json"), requester, c.req.raw)
  return created(c, row)
})

pelangganRouter.patch("/:id", requireRole(...ROLE_GROUPS.SUPERVISOR_UP), validate("json", updatePelangganSchema), async (c) => {
  const requester = getSessionUser(c)
  const row = await service.updatePelanggan(c.req.param("id"), c.req.valid("json"), requester, c.req.raw)
  return ok(c, row)
})

pelangganRouter.delete("/:id", requireRole(...ROLE_GROUPS.MANAGEMENT_UP), async (c) => {
  const requester = getSessionUser(c)
  const row = await service.softDeletePelanggan(c.req.param("id"), requester, c.req.raw)
  return ok(c, row)
})

pelangganRouter.post("/:id/restore", requireRole(...ROLE_GROUPS.MANAGEMENT_UP), async (c) => {
  const requester = getSessionUser(c)
  const row = await service.restorePelanggan(c.req.param("id"), requester, c.req.raw)
  return ok(c, row)
})
