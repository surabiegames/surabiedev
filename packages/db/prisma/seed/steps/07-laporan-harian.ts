// prisma/seed/steps/07-laporan-harian.ts — LaporanHarianPetugas dari
// lapdatametertes.csv (hasil pencatatan aplikasi baca meter, pra-
// verifikasi). Kalau baris ini punya padanan PembacaanMeter resmi (dari
// step 06, closing ProgresCater periode yang sama), di-link + ditandai
// terverifikasi — mewakili alur asli: laporan lapangan mentah -> closing
// resmi.

import type { Prisma } from "@/app/generated/prisma"
import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { readLapdatameter } from "../lib/csv"
import {
  normalizeNolg,
  normalizeMerk,
  normalizeKondisiCatat,
  parseIsoDate,
  parseIntOrNull,
  periodeToDate,
  trimOrNull,
} from "../lib/normalize"

const STEP = "07-laporan-harian"

export async function seedLaporanHarian(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const rows = readLapdatameter()
  const pencatatCache = new Map(
    (await prisma.pencatat.findMany({ select: { id: true, namaLapangan: true } })).map((p) => [
      p.namaLapangan,
      p.id,
    ])
  )

  for (const [i, row] of rows.entries()) {
    const nomorLangganan = normalizeNolg(row["No Pel"])
    const periode = parseIntOrNull(row.Periode)
    const standAwal = parseIntOrNull(row["St AWAL"])
    const standAkhir = parseIntOrNull(row["St Akhir"])
    const pemakaian = parseIntOrNull(row.Pakai)

    if (!nomorLangganan || periode === null || standAwal === null || standAkhir === null || pemakaian === null) {
      report.warn(
        STEP,
        `Data wajib tidak lengkap/nolg tidak valid (${JSON.stringify(row["No Pel"])}), baris dilewati`,
        { row: i, key: row["No Pel"] }
      )
      report.skipped(STEP)
      continue
    }

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { nomorLangganan },
      select: { id: true },
    })

    // Kalau pelanggan sudah dikenal dan punya Meter, cek apakah periode ini
    // sudah ada PembacaanMeter RESMI (dari step 06) — kalau ada, link +
    // tandai verified (laporan lapangan ini SUDAH jadi closing resmi).
    let pembacaanId: string | undefined
    if (pelanggan) {
      // Meter.pelangganId bukan unique (1:banyak, histori penggantian) —
      // ambil yang AKTIF saat ini.
      const meter = await prisma.meter.findFirst({
        where: { pelangganId: pelanggan.id, isAktif: true },
        select: { id: true },
      })
      if (meter) {
        const pembacaan = await prisma.pembacaanMeter.findUnique({
          where: { meterId_periode: { meterId: meter.id, periode: periodeToDate(periode) } },
          select: { id: true },
        })
        if (pembacaan) pembacaanId = pembacaan.id
      }
    }

    const data: Prisma.LaporanHarianPetugasUncheckedCreateInput = {
      nomorLangganan,
      periode,
      standAwal,
      standAkhir,
      pemakaian,
      kondisi: normalizeKondisiCatat(row.Kd_kel) ?? "NORMAL",
    }
    if (pelanggan) data.pelangganId = pelanggan.id
    const namaPelanggan = trimOrNull(row.Nama)
    if (namaPelanggan) data.namaPelanggan = namaPelanggan
    const alamatPelanggan = trimOrNull(row.Alamat)
    if (alamatPelanggan) data.alamatPelanggan = alamatPelanggan
    const pemakaianLalu = parseIntOrNull(row["Pakai Lau"])
    if (pemakaianLalu !== null) data.pemakaianLalu = pemakaianLalu
    const persentase = parseIntOrNull(row.persentase)
    if (persentase !== null) data.persentase = persentase
    const nomorMeter = trimOrNull(row.kd_wm)
    if (nomorMeter) data.nomorMeter = nomorMeter
    const petugasNama = normalizeMerk(row.kd_petugas)
    if (petugasNama && petugasNama !== "-") {
      const pencatatId = pencatatCache.get(petugasNama)
      if (pencatatId) data.pencatatId = pencatatId
    }
    const tanggalCatat = parseIsoDate(row.tgl_catat)
    if (tanggalCatat) data.tanggalCatat = tanggalCatat
    const tanggalUpload = parseIsoDate(row.tgl_upload)
    if (tanggalUpload) data.tanggalUpload = tanggalUpload
    if (pembacaanId) {
      data.pembacaanId = pembacaanId
      data.isVerified = true
      data.verifiedAt = tanggalUpload ?? tanggalCatat ?? new Date()
    }

    try {
      const existing = await prisma.laporanHarianPetugas.findUnique({
        where: { nomorLangganan_periode: { nomorLangganan, periode } },
        select: { id: true },
      })
      await prisma.laporanHarianPetugas.upsert({
        where: { nomorLangganan_periode: { nomorLangganan, periode } },
        create: data,
        update: data,
      })
      existing ? report.updated(STEP) : report.created(STEP)
    } catch (err) {
      report.error(STEP, `Gagal upsert LaporanHarianPetugas ${nomorLangganan}/${periode}: ${(err as Error).message}`, {
        key: `${nomorLangganan}:${periode}`,
      })
    }
  }
}
