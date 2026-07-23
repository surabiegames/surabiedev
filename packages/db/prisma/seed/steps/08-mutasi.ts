// prisma/seed/steps/08-mutasi.ts — MutasiPelanggan dari PBPK (pasang
// baru/pindah kontrak). Pelanggan-nya sendiri sudah dibuat di step 05;
// step ini murni mencatat EVENT mutasinya.

import type { Prisma } from "@/app/generated/prisma"
import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { readPbpk, getPbpkPeriode } from "../lib/csv"
import {
  normalizeNolg,
  normalizeMerk,
  normalizeUkuranMeter,
  normalizeGolonganTarif,
  parseExcelSerial,
  parseIntOrNull,
  trimOrNull,
} from "../lib/normalize"

const STEP = "08-mutasi"

export async function seedMutasi(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const rows = readPbpk()
  const periode = getPbpkPeriode()

  for (const row of rows) {
    const nomorLangganan = normalizeNolg(row.nolg)
    if (!nomorLangganan) continue // sudah di-log di step 05

    const jenisRaw = row.mutasian.trim().toUpperCase()
    if (jenisRaw !== "PB" && jenisRaw !== "PK") {
      report.warn(STEP, `mutasian "${row.mutasian}" bukan PB/PK untuk ${nomorLangganan}, baris dilewati`, {
        key: nomorLangganan,
      })
      report.skipped(STEP)
      continue
    }

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { nomorLangganan },
      select: { id: true },
    })
    if (!pelanggan) {
      report.warn(STEP, `Pelanggan ${nomorLangganan} tidak ditemukan (mestinya sudah dibuat step 05), baris dilewati`, {
        key: nomorLangganan,
      })
      report.skipped(STEP)
      continue
    }

    const data: Prisma.MutasiPelangganUncheckedCreateInput = {
      pelangganId: pelanggan.id,
      jenis: jenisRaw,
      periode,
    }
    const nomorMeterBaru = trimOrNull(row.nometer)
    if (nomorMeterBaru) data.nomorMeterBaru = nomorMeterBaru
    const merkMeterBaru = normalizeMerk(row.kd_merkmeter)
    if (merkMeterBaru) data.merkMeterBaru = merkMeterBaru
    const ukuranMeterBaru = normalizeUkuranMeter(row.kd_ukmeter)
    if (ukuranMeterBaru) data.ukuranMeterBaru = ukuranMeterBaru
    const tarifBaru = normalizeGolonganTarif(row.kd_goltarif)
    if (tarifBaru) data.tarifBaru = tarifBaru
    const ruteBaru = trimOrNull(row.kd_rute)
    if (ruteBaru) data.ruteBaru = ruteBaru
    const kodeWilayahBaru = trimOrNull(row.kode_wilayah)
    if (kodeWilayahBaru) data.kodeWilayahBaru = kodeWilayahBaru
    const noUrut = parseIntOrNull(row.no_urutrute)
    if (noUrut !== null) data.noUrut = noUrut
    const jumlahPenghuni = parseIntOrNull(row.jmlpenghuni)
    if (jumlahPenghuni !== null) data.jumlahPenghuni = jumlahPenghuni
    const tanggalAktif = parseExcelSerial(row.tglaktif)
    if (tanggalAktif) data.tanggalAktif = tanggalAktif
    const statusAktif = parseIntOrNull(row.sta_aktif)
    if (statusAktif !== null) data.statusAktif = statusAktif
    const updaterKode = trimOrNull(row.updater)
    if (updaterKode) data.updaterKode = updaterKode

    try {
      const existing = await prisma.mutasiPelanggan.findUnique({
        where: { pelangganId_periode_jenis: { pelangganId: pelanggan.id, periode, jenis: jenisRaw } },
        select: { id: true },
      })
      await prisma.mutasiPelanggan.upsert({
        where: { pelangganId_periode_jenis: { pelangganId: pelanggan.id, periode, jenis: jenisRaw } },
        create: data,
        update: data,
      })
      existing ? report.updated(STEP) : report.created(STEP)
    } catch (err) {
      report.error(STEP, `Gagal upsert MutasiPelanggan ${nomorLangganan}: ${(err as Error).message}`, {
        key: nomorLangganan,
      })
    }
  }
}
