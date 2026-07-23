import "server-only"

// features/dashboard/lib/geo-queries.ts — pengambilan data spasial untuk
// halaman peta wilayah. Server component membaca DB langsung (pola
// queries.ts), hasilnya GeoJSON FeatureCollection siap dimakan MapLibre.
//
// Kolom geometry bertipe Unsupported di Prisma — HARUS lewat raw SQL
// (ST_AsGeoJSON). Mengikuti aturan server/lib/spatial.ts: $queryRawUnsafe
// dengan identifier tetap (bukan input), tanpa Prisma.raw().
import { prisma } from "@workspace/db"

export interface FC {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    geometry: unknown
    properties: Record<string, unknown>
  }>
}

function keFC(rows: Array<{ geom: unknown } & Record<string, unknown>>): FC {
  return {
    type: "FeatureCollection",
    features: rows.map(({ geom, ...properties }) => ({ type: "Feature", geometry: geom, properties })),
  }
}

/** Poligon batas kelurahan yang punya geometri. */
export async function batasKelurahanFC(): Promise<FC> {
  const rows = await prisma.$queryRawUnsafe<Array<{ geom: unknown; id: string; nama: string }>>(
    `SELECT id, nama, ST_AsGeoJSON(area)::json AS geom FROM kelurahan WHERE area IS NOT NULL`
  )
  return keFC(rows)
}

/** Titik sambungan pelanggan berkoordinat (di-cap supaya payload RSC tidak
 *  meledak — 20rb titik ≈ 2 MB; kalau kelak lebih, pindahkan ke endpoint
 *  vektor-tile / bbox query). */
export async function titikPelangganFC(limit = 25000): Promise<FC> {
  const rows = await prisma.$queryRawUnsafe<Array<{ geom: unknown; id: string; nama: string; nomor: string; status: string }>>(
    `SELECT id, nama, "nomorLangganan" AS nomor, status::text AS status, ST_AsGeoJSON(koordinat)::json AS geom
     FROM pelanggan
     WHERE koordinat IS NOT NULL AND "deletedAt" IS NULL
     LIMIT $1`,
    limit
  )
  return keFC(rows)
}

/** Titik pengaduan yang masih aktif (belum selesai/ditolak) dan berlokasi. */
export async function titikPengaduanFC(): Promise<FC> {
  const rows = await prisma.$queryRawUnsafe<Array<{ geom: unknown; id: string; tiket: string; jenis: string; status: string }>>(
    `SELECT id, "nomorTiket" AS tiket, jenis::text AS jenis, status::text AS status, ST_AsGeoJSON(koordinat)::json AS geom
     FROM pengaduan
     WHERE koordinat IS NOT NULL AND status NOT IN ('SELESAI', 'DITOLAK')`
  )
  return keFC(rows)
}
