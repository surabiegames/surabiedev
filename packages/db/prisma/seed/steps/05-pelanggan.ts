// prisma/seed/steps/05-pelanggan.ts — Pelanggan dari ProgresCater (sumber
// utama, ~22.523 baris) + PBPK (pelanggan baru yang belum ada di
// ProgresCater bulan ini, 11 baris, TERVERIFIKASI 0 nolg tumpang-tindih
// dengan ProgresCater).
//
// DUA ATURAN KESELAMATAN DATA yang WAJIB dijaga di file ini:
//
// 1. STATUS PELANGGAN — lihat lib/status.ts. Diresolve lewat
//    resolvePelangganStatus(), TIDAK PERNAH langsung di-set dari mutasinama
//    mentah. Setiap perubahan status dicatat ke report.statusChange().
//
// 2. FIELD YANG TIDAK DIBAWA SUMBER INI TIDAK BOLEH DI-NULL-KAN. Contoh:
//    ProgresCater TIDAK punya kolom jumlahPenghuni/geoLat/geoLong/dmakode
//    kosong-per-baris — kalau field itu di-set eksplisit ke null di setiap
//    update, data yang sudah terisi dari import PBPK sebelumnya akan
//    HILANG. Solusinya: bangun object `update`/`create` Prisma secara
//    DINAMIS, cuma masukkan key yang baris ini benar-benar punya nilainya.
//    Field yang tidak dipunyai baris ini -> key-nya TIDAK DIMASUKKAN sama
//    sekali ke object update (Prisma cuma menyentuh key yang eksplisit
//    ada).

import type { Prisma } from "@/app/generated/prisma"
import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { readProgresCater, readPbpk } from "../lib/csv"
import {
  normalizeNolg,
  normalizeRtRw,
  normalizePhone,
  normalizeGolonganTarif,
  normalizeStatusPasokanAir,
  parseTimeOfDay,
  parseIntOrNull,
  parseExcelSerial,
  trimOrNull,
} from "../lib/normalize"
import { mapMutasiNamaToStatus, resolvePelangganStatus } from "../lib/status"

const STEP = "05-pelanggan"

interface RefCaches {
  tarifGolongan: Map<string, string>
  seksiCater: Map<string, string>
  rute: Map<string, string>
  zona: Map<string, string>
  kecamatan: Map<string, string>
  kelurahan: Map<string, string>
  golonganBesar: Map<string, string>
  dma: Map<string, string>
}

async function loadRefCaches(prisma: PrismaClientLike): Promise<RefCaches> {
  const [tarifGolongan, seksiCater, rute, zona, kecamatan, kelurahan, golonganBesar, dma] =
    await Promise.all([
      prisma.tarifGolongan.findMany({ select: { id: true, kode: true } }),
      prisma.seksiCater.findMany({ select: { id: true, kode: true } }),
      prisma.rute.findMany({ select: { id: true, kode: true } }),
      prisma.zona.findMany({ select: { id: true, kode: true } }),
      prisma.kecamatan.findMany({ select: { id: true, kode: true } }),
      prisma.kelurahan.findMany({ select: { id: true, kode: true } }),
      prisma.golonganBesar.findMany({ select: { id: true, kode: true } }),
      prisma.dma.findMany({ select: { id: true, kode: true } }),
    ])
  const toMap = (rows: { id: string; kode: string }[]) => new Map(rows.map((r) => [r.kode, r.id]))
  return {
    tarifGolongan: toMap(tarifGolongan),
    seksiCater: toMap(seksiCater),
    rute: toMap(rute),
    zona: toMap(zona),
    kecamatan: toMap(kecamatan),
    kelurahan: toMap(kelurahan),
    golonganBesar: toMap(golonganBesar),
    dma: toMap(dma),
  }
}

export async function seedPelanggan(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const caches = await loadRefCaches(prisma)

  await seedFromProgresCater(prisma, report, caches)
  await seedFromPbpk(prisma, report, caches)
}

async function seedFromProgresCater(
  prisma: PrismaClientLike,
  report: SeedReport,
  caches: RefCaches
): Promise<void> {
  const rows = readProgresCater()

  for (const [i, row] of rows.entries()) {
    const nomorLangganan = normalizeNolg(row.nolg)
    if (!nomorLangganan) {
      report.warn(STEP, `nolg tidak valid: ${JSON.stringify(row.nolg)}, baris dilewati`, {
        row: i,
        key: row.nolg,
      })
      report.skipped(STEP)
      continue
    }

    const nomorPersil = trimOrNull(row.nprs)
    const nama = trimOrNull(row.nama)
    const alamat = trimOrNull(row.almt)
    if (!nomorPersil || !nama || !alamat) {
      report.warn(STEP, `nprs/nama/almt kosong untuk nolg ${nomorLangganan}, baris dilewati`, {
        key: nomorLangganan,
      })
      report.skipped(STEP)
      continue
    }

    const existing = await prisma.pelanggan.findUnique({
      where: { nomorLangganan },
      select: { id: true, status: true },
    })

    const mutasiNamaStatus = mapMutasiNamaToStatus(row.mutasinama)
    const resolution = resolvePelangganStatus({
      existingStatus: existing?.status ?? null,
      mutasiNamaStatus,
    })
    if (resolution.changed) {
      report.statusChange({
        nomorLangganan,
        from: existing?.status ?? null,
        to: resolution.status,
        reason: resolution.reason,
      })
    }
    if (!existing && mutasiNamaStatus === null) {
      report.warn(
        STEP,
        `mutasinama "${row.mutasinama}" tidak dikenali untuk pelanggan baru ${nomorLangganan} -> default AKTIF`,
        { key: nomorLangganan }
      )
    }

    // Field yang SELALU ada di tiap baris ProgresCater -> aman selalu di-set.
    const alwaysPresent: Prisma.PelangganUncheckedUpdateInput = {
      nomorPersil,
      nama,
      alamat,
      status: resolution.status,
    }

    const rt = normalizeRtRw(row.rt)
    if (rt !== null) alwaysPresent.rt = rt
    const rw = normalizeRtRw(row.rw)
    if (rw !== null) alwaysPresent.rw = rw
    const notelp = normalizePhone(row.notelp)
    if (notelp !== null) alwaysPresent.notelp = notelp

    const golonganTarifKode = normalizeGolonganTarif(row.trp)
    if (golonganTarifKode) {
      const id = caches.tarifGolongan.get(golonganTarifKode)
      if (id) alwaysPresent.tarifGolonganId = id
    }
    const seksiCaterId = caches.seksiCater.get(row.caterseksikode.trim())
    if (seksiCaterId) alwaysPresent.seksiCaterId = seksiCaterId
    const ruteId = caches.rute.get(row.rute_kode.trim())
    if (ruteId) alwaysPresent.ruteId = ruteId
    const zonaId = caches.zona.get(row.zonakode.trim())
    if (zonaId) alwaysPresent.zonaId = zonaId
    const kecamatanId = caches.kecamatan.get(row.kdkec.trim())
    if (kecamatanId) alwaysPresent.kecamatanId = kecamatanId
    const kelurahanId = caches.kelurahan.get(row.kdkel.trim())
    if (kelurahanId) alwaysPresent.kelurahanId = kelurahanId

    // isMBR/kodeMBR: ProgresCater selalu punya kolom ismbr ("t"/"f"), aman
    // di-set tiap kali.
    alwaysPresent.isMBR = row.ismbr.trim().toLowerCase() === "t"
    const kodeMBR = trimOrNull(row.mbr)
    if (kodeMBR) alwaysPresent.kodeMBR = kodeMBR

    // Field yang CUMA ADA kalau baris ini punya nilainya -> jangan
    // pernah di-null-kan kalau kosong (lihat komentar atas file).
    const golonganBesarKode = trimOrNull(row.gbid)
    if (golonganBesarKode) {
      const id = caches.golonganBesar.get(golonganBesarKode)
      if (id) alwaysPresent.golonganBesarId = id
    }
    const objekBayarRaw = trimOrNull(row.obnama)
    if (objekBayarRaw === "SIPIL" || objekBayarRaw === "AUTODEBET" || objekBayarRaw === "HANKAM") {
      alwaysPresent.objekBayar = objekBayarRaw
    }
    const dmaKode = trimOrNull(row.dmakode)
    if (dmaKode && dmaKode !== "-") {
      const id = caches.dma.get(dmaKode)
      if (id) alwaysPresent.dmaId = id
    }
    const statusPasokanAir = normalizeStatusPasokanAir(row.durasi)
    if (statusPasokanAir) alwaysPresent.statusPasokanAir = statusPasokanAir
    const jamMulai = parseTimeOfDay(row.jamgilirstart)
    if (jamMulai) alwaysPresent.jamGilirMulai = jamMulai
    const jamSelesai = parseTimeOfDay(row.jamgilirend)
    if (jamSelesai) alwaysPresent.jamGilirSelesai = jamSelesai
    const polaGilir = trimOrNull(row.waktugilir)
    if (polaGilir) alwaysPresent.polaGilir = polaGilir

    // ProgresCater TIDAK punya kolom jumlahPenghuni sama sekali (cuma
    // ada di PBPK) — sengaja tidak disentuh di sini, lihat komentar atas
    // file soal "jangan null-kan field yang tidak dibawa sumber ini".

    try {
      await prisma.pelanggan.upsert({
        where: { nomorLangganan },
        create: { nomorLangganan, ...alwaysPresent } as Prisma.PelangganUncheckedCreateInput,
        update: alwaysPresent,
      })
      existing ? report.updated(STEP) : report.created(STEP)
    } catch (err) {
      report.error(STEP, `Gagal upsert Pelanggan ${nomorLangganan}: ${(err as Error).message}`, {
        key: nomorLangganan,
      })
    }
  }
}

async function seedFromPbpk(
  prisma: PrismaClientLike,
  report: SeedReport,
  caches: RefCaches
): Promise<void> {
  const rows = readPbpk()

  for (const row of rows) {
    const nomorLangganan = normalizeNolg(row.nolg)
    if (!nomorLangganan) {
      report.warn(STEP, `PBPK: nolg tidak valid ${JSON.stringify(row.nolg)}, baris dilewati`, {
        key: row.nolg,
      })
      report.skipped(STEP)
      continue
    }

    const existing = await prisma.pelanggan.findUnique({
      where: { nomorLangganan },
      select: { id: true },
    })
    if (existing) {
      // Sudah ada dari ProgresCater — PBPK cuma sumber untuk pelanggan
      // BARU. Jangan overwrite data yang sudah lebih lengkap dari
      // ProgresCater dengan data PBPK yang lebih minim.
      report.unchanged(STEP)
      continue
    }

    const nama = trimOrNull(row.nama)
    const alamat = trimOrNull(row.alamat)
    const nomorPersil = trimOrNull(row.nolangganan) ?? nomorLangganan
    if (!nama || !alamat) {
      report.warn(STEP, `PBPK: nama/alamat kosong untuk nolg ${nomorLangganan}, baris dilewati`, {
        key: nomorLangganan,
      })
      report.skipped(STEP)
      continue
    }

    const data: Prisma.PelangganUncheckedCreateInput = {
      nomorLangganan,
      nomorPersil,
      nama,
      alamat,
      status: "AKTIF", // pelanggan baru pasang, belum ada sinyal status lain
    }

    const rt = normalizeRtRw(row.rt)
    if (rt !== null) data.rt = rt
    const rw = normalizeRtRw(row.rw)
    if (rw !== null) data.rw = rw
    const notelp = normalizePhone(row.notelp)
    if (notelp !== null) data.notelp = notelp
    const jumlahPenghuni = parseIntOrNull(row.jmlpenghuni)
    if (jumlahPenghuni !== null) data.jumlahPenghuni = jumlahPenghuni

    const golonganTarifKode = normalizeGolonganTarif(row.kd_goltarif)
    if (golonganTarifKode) {
      const id = caches.tarifGolongan.get(golonganTarifKode)
      if (id) data.tarifGolonganId = id
    }
    const ruteId = caches.rute.get(row.kd_rute.trim())
    if (ruteId) data.ruteId = ruteId

    // kd_kecamatan/kd_kelurahan di PBPK pakai format kode yang SAMA
    // dengan kdkec/kdkel ProgresCater (terverifikasi pola "XX"/"XXn").
    const kecamatanId = caches.kecamatan.get(row.kd_kecamatan.trim())
    if (kecamatanId) data.kecamatanId = kecamatanId
    const kelurahanId = caches.kelurahan.get(row.kd_kelurahan.trim())
    if (kelurahanId) data.kelurahanId = kelurahanId

    const geoLong = Number(row.geo_long)
    const geoLat = Number(row.goe_lat)
    if (row.geo_long.trim() && Number.isFinite(geoLong)) data.geoLong = geoLong
    if (row.goe_lat.trim() && Number.isFinite(geoLat)) data.geoLat = geoLat

    try {
      await prisma.pelanggan.create({ data })
      report.created(STEP)
      report.statusChange({
        nomorLangganan,
        from: null,
        to: "AKTIF",
        reason: "pelanggan baru dari PBPK (pasang baru/pindah kontrak)",
      })
    } catch (err) {
      report.error(STEP, `Gagal create Pelanggan (PBPK) ${nomorLangganan}: ${(err as Error).message}`, {
        key: nomorLangganan,
      })
      continue
    }

    // tglaktif (Excel serial) dipakai di step Mutasi (08), bukan di sini
    // — cukup validasi bisa diparse supaya kalau gagal ketahuan sejak awal.
    if (!parseExcelSerial(row.tglaktif)) {
      report.warn(STEP, `PBPK: tglaktif ${row.tglaktif} tidak bisa diparse untuk ${nomorLangganan}`, {
        key: nomorLangganan,
      })
    }
  }
}
