// prisma/seed/steps/09-pemutusan.ts — Pemutusan dari r-nomor.csv.
//
// ATURAN KESELAMATAN PALING PENTING DI SELURUH SEED SCRIPT INI: file ini
// TIDAK PERNAH menulis Pelanggan.status, dalam kondisi apa pun. Mencatat
// baris Pemutusan (fakta historis: "ada proses pemutusan tercatat") itu
// beda dengan memutuskan "makanya status pelanggan ini harus diubah" —
// yang kedua adalah keputusan bisnis yang perlu konfirmasi manusia, bukan
// inferensi otomatis dari satu file CSV. Kalau pelanggan yang baris
// Pemutusan-nya match TERNYATA masih berstatus AKTIF di database, itu
// di-flag ke report.flagPemutusanReview() supaya ditinjau manusia lewat
// dashboard — BUKAN diproses lebih lanjut oleh kode ini.

import type { Prisma } from "@/app/generated/prisma"
import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { readRNomor } from "../lib/csv"
import { normalizeNolg, parseUsDate, parseIntOrNull, trimOrNull } from "../lib/normalize"

const STEP = "09-pemutusan"

export async function seedPemutusan(prisma: PrismaClientLike, report: SeedReport): Promise<void> {
  const rows = readRNomor()

  for (const [i, row] of rows.entries()) {
    const periode = parseIntOrNull(row.periode)
    const jenisRaw = row.jenis_pemutusan.trim().toUpperCase()
    if (periode === null || (jenisRaw !== "TSM" && jenisRaw !== "SPT")) {
      report.warn(STEP, `periode/jenis_pemutusan tidak valid di baris ${i}, dilewati`, { row: i })
      report.skipped(STEP)
      continue
    }

    const nomorLangganan = normalizeNolg(row.nomor_pelanggan)
    const nomorSurat = trimOrNull(row.no_surat)
    const nomorSPT = trimOrNull(row.no_spt)
    const sumberKey = `RNOMOR:${periode}:${jenisRaw}:${nomorSurat ?? nomorSPT ?? `row${i}`}`

    let pelangganId: string | null = null
    if (nomorLangganan) {
      const pelanggan = await prisma.pelanggan.findUnique({
        where: { nomorLangganan },
        select: { id: true, status: true },
      })
      if (pelanggan) {
        pelangganId = pelanggan.id
        if (pelanggan.status === "AKTIF") {
          report.flagPemutusanReview(nomorLangganan, jenisRaw, periode)
        }
      }
    }

    const data: Prisma.PemutusanUncheckedCreateInput = {
      jenis: jenisRaw,
      periode,
      sumberData: "RNOMOR_CSV",
      sumberKey,
    }
    if (pelangganId) data.pelangganId = pelangganId
    if (nomorLangganan) data.nomorLangganan = nomorLangganan
    const namaPelanggan = trimOrNull(row.nama)
    if (namaPelanggan) data.namaPelanggan = namaPelanggan
    if (nomorSurat) data.nomorSurat = nomorSurat
    if (nomorSPT) data.nomorSPT = nomorSPT
    const tanggalPermohonan = parseUsDate(row.tgl_permohonan)
    if (tanggalPermohonan) data.tanggalPermohonan = tanggalPermohonan
    const tanggalTutup = parseUsDate(row.tgl_tutup)
    if (tanggalTutup) data.tanggalTutup = tanggalTutup
    const tanggalSPT = parseUsDate(row.tgl_spt)
    if (tanggalSPT) data.tanggalSPT = tanggalSPT
    const tanggalCabut = parseUsDate(row.tgl_cabut)
    if (tanggalCabut) data.tanggalCabut = tanggalCabut

    try {
      const existing = await prisma.pemutusan.findUnique({
        where: { sumberKey },
        select: { id: true },
      })
      await prisma.pemutusan.upsert({
        where: { sumberKey },
        create: data,
        update: data,
      })
      existing ? report.updated(STEP) : report.created(STEP)
    } catch (err) {
      report.error(STEP, `Gagal upsert Pemutusan (${sumberKey}): ${(err as Error).message}`, {
        key: sumberKey,
      })
    }
  }
}
