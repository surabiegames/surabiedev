// prisma/seed/steps/04-pencatat.ts — jembatan nama petugas lapangan.
// Sumber: ProgresCater.pencatat (9 nama unik) UNION lapdatameter.kd_petugas
// (9 nama yang SAMA + placeholder "-" untuk 11 baris "petugas tidak
// diketahui" — "-" sengaja tidak dibuatkan row Pencatat, biar
// pencatatId tetap null seperti didesain di skema).

import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { readProgresCater, readLapdatameter } from "../lib/csv"
import { normalizeMerk } from "../lib/normalize"

const STEP = "04-pencatat"

export async function seedPencatat(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const names = new Set<string>()

  for (const row of readProgresCater()) {
    const n = normalizeMerk(row.pencatat) // UPPER+TRIM, sama seperti normalisasi merk
    if (n) names.add(n)
  }
  for (const row of readLapdatameter()) {
    const n = normalizeMerk(row.kd_petugas)
    if (n && n !== "-") names.add(n)
  }

  for (const namaLapangan of names) {
    const existing = await prisma.pencatat.findUnique({ where: { namaLapangan } })
    await prisma.pencatat.upsert({
      where: { namaLapangan },
      create: { namaLapangan },
      update: {},
    })
    existing ? report.unchanged(STEP) : report.created(STEP)
  }
}
