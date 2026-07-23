// prisma/seed/steps/10-geometri.ts — mengisi kolom geometri PostGIS dari
// dua sumber GeoJSON di prisma/data. Sebelum step ini ada, SEMUA kolom
// geometri kosong (diukur 2026-07-19: 0/21 kelurahan ber-area, 0/22.534
// pelanggan ber-koordinat) sehingga seluruh fitur spasial — auto-tag
// wilayah pengaduan (ST_Contains), /pelanggan/near, peta — tidak punya
// data untuk bekerja.
//
// SUMBER (keduanya arsip imutable, lihat "Filosofi ETL" di prisma/README):
//   1. Area_layanan_Wilayah_5.geojson — 32 MultiPolygon batas kelurahan
//      (properti DESA = nama kelurahan). Dicocokkan ke Kelurahan lewat
//      NAMA (bukan kode: KODE_DESA di file adalah kode Kemendagri
//      3273xxxx, sedangkan Kelurahan.kode di DB adalah kode internal PDAM
//      "KD3" dst — dua sistem kode berbeda tanpa peta silang). Area
//      Kecamatan lalu DITURUNKAN via ST_Union dari kelurahan anggotanya
//      (alasan MultiPolygon: union bagian yang tidak nempel).
//   2. Data_progres_verifikasi_pelanggan_PW_5_2026.geojson — 1.875 titik
//      survei lapangan ber-"Nomor Pelanggan" → Pelanggan.koordinat.
//      INI SATU-SATUNYA sumber koordinat pelanggan: kolom goe_lat/goe_long
//      PBPK terbukti kosong di data sumber (0 baris valid).
//
// Idempoten: update by kode/nomorLangganan; dijalankan ulang aman.
// Geometri ditulis lewat $executeRawUnsafe + parameter posisi (identifier
// dari kode literal di file ini, BUKAN dari input) — aturan yang sama
// dengan server/lib/spatial.ts: JANGAN Prisma.raw().
//
// Wilayah operasional PDAM (WilayahAdm/Dist/SeksiCater/WilayahSeksi/Zona/
// Rute) SENGAJA tidak diisi: tidak ada sumber polygon-nya di prisma/data —
// jangan dikarang; tercatat sebagai warning agar terlihat manusia.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"

const STEP = "10-geometri"
// Pola path sama dengan lib/csv.ts: relatif cwd (seed dijalankan dari root
// repo via pnpm db:seed), bukan __dirname — tsx/ESM tidak menjaminnya.
const DATA_DIR = join(process.cwd(), "prisma", "data")

interface FiturGeoJson {
  geometry: { type: string; coordinates: unknown } | null
  properties: Record<string, unknown>
}

function bacaGeoJson(nama: string): FiturGeoJson[] {
  const raw = JSON.parse(readFileSync(join(DATA_DIR, nama), "utf8")) as {
    features?: FiturGeoJson[]
  }
  return raw.features ?? []
}

/// Nama kelurahan dinormalkan untuk pencocokan: kapital + spasi tunggal.
/// Diverifikasi pada data nyata: 21 kelurahan DB semuanya ketemu di 32
/// fitur file (file mencakup wilayah layanan lebih luas dari data
/// pelanggan yang terimpor — sisanya dilewati dengan catatan skipped).
function kunciNama(nama: string): string {
  return nama.toUpperCase().replace(/\s+/g, " ").trim()
}

async function isiAreaKelurahan(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const fitur = bacaGeoJson("Area_layanan_Wilayah_5.geojson")
  const kelurahan = await prisma.kelurahan.findMany({ select: { id: true, nama: true } })
  const byNama = new Map(kelurahan.map((k) => [kunciNama(k.nama), k.id]))

  for (const f of fitur) {
    const nama = kunciNama(String(f.properties["DESA"] ?? f.properties["DESA_KELUR"] ?? ""))
    if (!nama || !f.geometry) {
      report.skipped(STEP)
      continue
    }
    const id = byNama.get(nama)
    if (!id) {
      // Fitur di luar cakupan pelanggan terimpor — bukan error; kelurahan
      // barunya akan otomatis kebagian area saat suatu saat ikut terimpor.
      report.skipped(STEP)
      continue
    }
    // ST_Multi: 29/32 fitur memang MultiPolygon, tapi jaga-jaga bila
    // sumber berikutnya mengirim Polygon tunggal. ST_MakeValid: polygon
    // hasil digitasi kerap punya self-intersection kecil yang membuat
    // ST_Contains diam-diam salah.
    await prisma.$executeRawUnsafe(
      `UPDATE kelurahan
         SET area = ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)))
       WHERE id = $2`,
      JSON.stringify(f.geometry),
      id
    )
    report.updated(STEP)
  }

  // Prisma tidak bisa memfilter kolom Unsupported — hitung via SQL.
  const sisa = await prisma.$queryRawUnsafe<{ kode: string; nama: string }[]>(
    `SELECT kode, nama FROM kelurahan WHERE area IS NULL`
  )
  for (const k of sisa) {
    report.warn(STEP, `Kelurahan ${k.kode} (${k.nama}) tidak ketemu di GeoJSON area layanan — area tetap kosong`, {
      key: k.kode,
    })
  }
}

/// Kecamatan = ST_Union area kelurahan anggotanya (bukan dari file — file
/// hanya menyediakan level kelurahan).
async function turunkanAreaKecamatan(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const jumlah = await prisma.$executeRawUnsafe(
    `UPDATE kecamatan kc
        SET area = sub.gabungan
       FROM (
         SELECT "kecamatanId", ST_Multi(ST_Union(area)) AS gabungan
           FROM kelurahan
          WHERE area IS NOT NULL
          GROUP BY "kecamatanId"
       ) sub
      WHERE sub."kecamatanId" = kc.id`
  )
  for (let i = 0; i < jumlah; i++) report.updated(STEP)
}

async function isiKoordinatPelanggan(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const fitur = bacaGeoJson("Data_progres_verifikasi_pelanggan_PW_5_2026.geojson")

  for (const f of fitur) {
    const nomorMentah = String(f.properties["Nomor Pelanggan"] ?? "").replace(/\D/g, "")
    if (!nomorMentah) {
      // Titik survei non-pelanggan (calon/eks) — bukan error.
      report.skipped(STEP)
      continue
    }
    const nomor = nomorMentah.padStart(11, "0")
    const koordinat = f.geometry?.type === "Point" ? (f.geometry.coordinates as number[]) : null
    const lng = koordinat?.[0]
    const lat = koordinat?.[1]
    // Kota Bandung ± sekitarnya — titik di luar kotak ini pasti salah entri
    // GPS (0,0 dsb), jangan ditulis.
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      lat < -8 ||
      lat > -6 ||
      lng < 106 ||
      lng > 109
    ) {
      report.skipped(STEP)
      continue
    }

    const jumlah = await prisma.$executeRawUnsafe(
      `UPDATE pelanggan
          SET koordinat = ST_SetSRID(ST_MakePoint($1, $2), 4326)
        WHERE "nomorLangganan" = $3`,
      lng,
      lat,
      nomor
    )
    if (jumlah > 0) report.updated(STEP)
    else {
      // Nomor survei yang tidak ada di master pelanggan — pola yang sama
      // dengan CSV lapangan lain (referensi di luar jendela impor).
      report.skipped(STEP)
    }
  }
}

export async function seedGeometri(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  await isiAreaKelurahan(prisma, report)
  await turunkanAreaKecamatan(prisma, report)
  await isiKoordinatPelanggan(prisma, report)

  report.warn(
    STEP,
    "Area wilayah operasional PDAM (WilayahAdm/Dist/SeksiCater/WilayahSeksi/Zona/Rute) belum ada sumber polygon-nya di prisma/data — tetap kosong sampai file batasnya tersedia"
  )
}
