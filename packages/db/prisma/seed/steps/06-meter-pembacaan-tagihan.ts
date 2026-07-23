// prisma/seed/steps/06-meter-pembacaan-tagihan.ts — Meter, PembacaanMeter,
// Tagihan dari ProgresCater (satu baris = satu closing meter + satu
// tagihan air periode itu).
//
// HISTORI PENGGANTIAN METER: `Meter.pelangganId` sudah diubah dari @unique
// jadi relasi 1:banyak (lihat tagihan.prisma) supaya baris histori meter
// lama tidak tertimpa. Logikanya di bawah: cari meter AKTIF pelanggan ini
// (isAktif=true) — kalau nomorMeter-nya SAMA, itu meter fisik yang sama,
// cukup update baris itu. Kalau nomorMeter BEDA, meter fisik sudah
// diganti: baris lama ditandai isAktif=false (disimpan sebagai histori,
// TIDAK dihapus/ditimpa), baris BARU dibuat dengan isAktif=true.
//
// STATUS TAGIHAN: tanggalJatuhTempo TIDAK ADA di sumber CSV manapun —
// tetap dihitung sebagai placeholder (periode + 1 bulan), WAJIB
// dikonfirmasi ke aturan bisnis PDAM yang sebenarnya. TAPI kolom
// `jmlreknunggak` (jumlah rekening menunggak) ADALAH data asli dan
// dipakai sebagai sinyal nyata: kalau pelanggan ini punya rekening
// menunggak (jmlreknunggak > 0), tagihan periode ini di-set JATUH_TEMPO
// alih-alih BELUM_BAYAR — itu bukti nyata dari data bahwa akun ini dalam
// keadaan menunggak, bukan tebakan dari placeholder tanggal.

import type { Prisma } from "@/app/generated/prisma"
import type { PrismaClientLike } from "../lib/db"
import type { SeedReport } from "../lib/report"
import { readProgresCater } from "../lib/csv"
import {
  normalizeNolg,
  normalizeMerk,
  normalizeUkuranMeter,
  normalizeKondisiCatat,
  parseIsoDate,
  parseIntOrNull,
  parseBigIntOrNull,
  periodeToDate,
  trimOrNull,
} from "../lib/normalize"

const STEP = "06-meter-pembacaan-tagihan"

function addMonthsUTC(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()))
}

export async function seedMeterPembacaanTagihan(
  prisma: PrismaClientLike,
  report: SeedReport
): Promise<void> {
  const rows = readProgresCater()
  const pencatatCache = new Map(
    (await prisma.pencatat.findMany({ select: { id: true, namaLapangan: true } })).map((p) => [
      p.namaLapangan,
      p.id,
    ])
  )

  for (const [i, row] of rows.entries()) {
    const nomorLangganan = normalizeNolg(row.nolg)
    if (!nomorLangganan) continue // sudah di-log sebagai warning di step 05

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { nomorLangganan },
      select: { id: true },
    })
    if (!pelanggan) {
      report.warn(STEP, `Pelanggan ${nomorLangganan} tidak ditemukan (step 05 mestinya sudah buat), baris dilewati`, {
        row: i,
        key: nomorLangganan,
      })
      report.skipped(STEP)
      continue
    }

    const nomorMeter = trimOrNull(row.nometer)
    const ukuran = normalizeUkuranMeter(row.ukmeter)
    if (!nomorMeter || !ukuran) {
      report.warn(STEP, `nometer/ukmeter tidak valid untuk ${nomorLangganan}, Meter+Tagihan dilewati`, {
        key: nomorLangganan,
      })
      report.skipped(STEP)
      continue
    }

    // --- Meter (histori penggantian, lihat catatan atas file) ---
    // Tipe plain object (bukan Prisma.MeterUncheckedUpdateInput) supaya
    // bisa dipakai untuk create MAUPUN update tanpa konflik tipe —
    // UpdateInput mengizinkan wrapper operasi (mis. { set: ... }) yang
    // tidak valid untuk CreateInput.
    const meterFields: {
      nomorSegel?: string
      merkKode?: string
      tanggalPasang?: Date
      umurTahun?: number
      umurBulan?: number
      umurHari?: number
    } = {}
    const nomorSegel = trimOrNull(row.nosegelmeter)
    if (nomorSegel) meterFields.nomorSegel = nomorSegel
    const merkKode = normalizeMerk(row.kd_merkmeter)
    if (merkKode) meterFields.merkKode = merkKode
    const tanggalPasang = parseIsoDate(row.tglpasangmeter)
    if (tanggalPasang) meterFields.tanggalPasang = tanggalPasang
    const umurTahun = parseIntOrNull(row.umurmeterthn)
    if (umurTahun !== null) meterFields.umurTahun = umurTahun
    const umurBulan = parseIntOrNull(row.umurmeterbln)
    if (umurBulan !== null) meterFields.umurBulan = umurBulan
    const umurHari = parseIntOrNull(row.umurmeterhari)
    if (umurHari !== null) meterFields.umurHari = umurHari

    let meterId: string
    try {
      const meterAktif = await prisma.meter.findFirst({
        where: { pelangganId: pelanggan.id, isAktif: true },
        select: { id: true, nomorMeter: true },
      })

      if (!meterAktif) {
        const created = await prisma.meter.create({
          data: { pelangganId: pelanggan.id, nomorMeter, ukuran, isAktif: true, ...meterFields },
        })
        meterId = created.id
        report.created(`${STEP}:meter`)
      } else if (meterAktif.nomorMeter === nomorMeter) {
        const updated = await prisma.meter.update({
          where: { id: meterAktif.id },
          data: { ukuran, ...meterFields },
        })
        meterId = updated.id
        report.updated(`${STEP}:meter`)
      } else {
        // Meter fisik berganti: nonaktifkan baris lama (histori tetap
        // ada), buat baris baru sebagai meter aktif.
        await prisma.meter.update({
          where: { id: meterAktif.id },
          data: { isAktif: false },
        })
        report.warn(
          STEP,
          `Meter pelanggan ${nomorLangganan} berganti (${meterAktif.nomorMeter} -> ${nomorMeter}) — baris lama disimpan sebagai histori (isAktif=false), baris baru dibuat`,
          { key: nomorLangganan }
        )
        const created = await prisma.meter.create({
          data: { pelangganId: pelanggan.id, nomorMeter, ukuran, isAktif: true, ...meterFields },
        })
        meterId = created.id
        report.created(`${STEP}:meter`)
      }
    } catch (err) {
      report.error(STEP, `Gagal proses Meter ${nomorLangganan}: ${(err as Error).message}`, {
        key: nomorLangganan,
      })
      continue
    }

    // --- PembacaanMeter ---
    const periode = periodeToDate(Number(row.thbl))
    const standLalu = parseIntOrNull(row.stml)
    const standAkhir = parseIntOrNull(row.stma)
    const pemakaianM3 = parseIntOrNull(row.pakai_drd)
    const blokTarif = parseIntOrNull(row.blok_m3)
    if (standLalu === null || standAkhir === null || pemakaianM3 === null || blokTarif === null) {
      report.warn(STEP, `Data stand/pemakaian tidak lengkap untuk ${nomorLangganan}, PembacaanMeter+Tagihan dilewati`, {
        key: nomorLangganan,
      })
      report.skipped(STEP)
      continue
    }

    const pembacaanData: Prisma.PembacaanMeterUncheckedCreateInput = {
      meterId,
      periode,
      standLalu,
      standAkhir,
      pemakaianM3,
      blokTarif,
      kondisi: normalizeKondisiCatat(row.tmss) ?? "NORMAL",
      kategori: row.kategorialnama.trim().toUpperCase() === "OFFSITE" ? "OFFSITE" : "ONSITE",
    }
    const pemakaianLalu = parseIntOrNull(row.pakailalu)
    if (pemakaianLalu !== null) pembacaanData.pemakaianLalu = pemakaianLalu
    const blokTarifLalu = parseIntOrNull(row.blok_m3lalu)
    if (blokTarifLalu !== null) pembacaanData.blokTarifLalu = blokTarifLalu
    const pencatatNama = normalizeMerk(row.pencatat)
    if (pencatatNama) {
      const pencatatId = pencatatCache.get(pencatatNama)
      if (pencatatId) pembacaanData.pencatatId = pencatatId
    }
    const tanggalCatat = parseIsoDate(row.tglcatat)
    if (tanggalCatat) pembacaanData.tanggalCatat = tanggalCatat

    let pembacaanId: string
    try {
      const existingPembacaan = await prisma.pembacaanMeter.findUnique({
        where: { meterId_periode: { meterId, periode } },
        select: { id: true },
      })
      const pembacaan = await prisma.pembacaanMeter.upsert({
        where: { meterId_periode: { meterId, periode } },
        create: pembacaanData,
        update: pembacaanData,
      })
      pembacaanId = pembacaan.id
      existingPembacaan ? report.updated(`${STEP}:pembacaan`) : report.created(`${STEP}:pembacaan`)
    } catch (err) {
      report.error(STEP, `Gagal upsert PembacaanMeter ${nomorLangganan}: ${(err as Error).message}`, {
        key: nomorLangganan,
      })
      continue
    }

    // --- Tagihan ---
    const jmlHargaAir = parseIntOrNull(row.jmlhargaair)
    const beaBeban = parseIntOrNull(row.beabeban)
    const beaAdmin = parseIntOrNull(row.beaadmin)
    const airKotor = parseIntOrNull(row.airkotor)
    const lainLain = parseIntOrNull(row.lainlain)
    const totalTagihan = parseIntOrNull(row.tjtg)
    if (
      jmlHargaAir === null ||
      beaBeban === null ||
      beaAdmin === null ||
      airKotor === null ||
      lainLain === null ||
      totalTagihan === null
    ) {
      report.warn(STEP, `Komponen tagihan tidak lengkap untuk ${nomorLangganan}, Tagihan dilewati`, {
        key: nomorLangganan,
      })
      report.skipped(STEP)
      continue
    }

    const jumlahRekTunggak = parseIntOrNull(row.jmlreknunggak)
    const nominalTunggak = parseBigIntOrNull(row.tagnunggak)

    const tagihanData: Prisma.TagihanUncheckedCreateInput = {
      pelangganId: pelanggan.id,
      pembacaanId,
      periode,
      pemakaianM3,
      jmlHargaAir,
      beaBeban,
      beaAdmin,
      airKotor,
      lainLain,
      totalTagihan,
      // Due date TIDAK ADA di sumber CSV — placeholder periode+1 bulan,
      // WAJIB dikonfirmasi ke aturan bisnis nyata (lihat catatan atas file).
      tanggalJatuhTempo: addMonthsUTC(periode, 1),
      // jmlreknunggak ADALAH data asli (bukan placeholder) — dipakai
      // sebagai sinyal nyata bahwa akun ini menunggak, bukan tebakan.
      status: jumlahRekTunggak && jumlahRekTunggak > 0 ? "JATUH_TEMPO" : "BELUM_BAYAR",
    }
    if (jumlahRekTunggak !== null) tagihanData.jumlahRekTunggak = jumlahRekTunggak
    if (nominalTunggak !== null) tagihanData.nominalTunggak = nominalTunggak

    try {
      const existingTagihan = await prisma.tagihan.findUnique({
        where: { pembacaanId },
        select: { id: true },
      })
      await prisma.tagihan.upsert({
        where: { pembacaanId },
        create: tagihanData,
        // status TIDAK disentuh saat update — kalau tagihan ini sudah
        // diproses (dibayar/dihapuskan) lewat aplikasi, re-import tidak
        // boleh mengembalikannya ke BELUM_BAYAR/JATUH_TEMPO.
        update: (({ pelangganId: _p, pembacaanId: _pb, status: _s, ...rest }) => rest)(tagihanData),
      })
      existingTagihan ? report.updated(`${STEP}:tagihan`) : report.created(`${STEP}:tagihan`)
    } catch (err) {
      report.error(STEP, `Gagal upsert Tagihan ${nomorLangganan}: ${(err as Error).message}`, {
        key: nomorLangganan,
      })
    }
  }
}
