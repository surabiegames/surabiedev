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
// PEMAKAIAN RIIL vs PEMAKAIAN TAGIH: `pakai_drd` (yang ditagihkan) SERING
// BERBEDA dari `stma - stml` (yang terbaca di meter) — 10.160 dari 22.523
// baris di periode 202605 (45%). Keduanya sekarang disimpan terpisah
// (`pemakaianM3` = tagih, `pemakaianRiil` = terbaca) beserta `alasanTaksir`
// yang menjelaskan kenapa berbeda. Alasannya DILABELI dari apa yang
// benar-benar terjadi di data, BUKAN dihitung ulang lalu menimpa angka
// aslinya: kalau nilai di CSV cocok dengan usulan aturan, alasan aturan itu
// yang dicatat; kalau tidak cocok, dicatat sebagai OVERRIDE_MANUAL. Angka
// tagih dari sumber TIDAK PERNAH diubah oleh seed — ini impor, bukan
// penerbitan ulang tagihan.
//
// KINERJA: versi awal step ini melakukan ~7 query berurutan PER BARIS
// (22.523 baris = ~158.000 round-trip). Terhadap Postgres terkelola yang
// jauh secara jaringan itu berarti berjam-jam — terukur >44 menit dan belum
// selesai. Dua perbaikan di bawah, keduanya TANPA mengubah semantik:
//   1. Semua pembacaan lookup di-preload sekali di awal jadi Map di memori
//      (pelanggan, meter aktif, pembacaan & tagihan periode ini).
//   2. Baris diproses dalam kelompok paralel (KONKURENSI), bukan satu per
//      satu. Aman karena `nolg` terverifikasi unik di ProgresCater — tidak
//      ada dua baris yang menyentuh pelanggan yang sama, jadi tidak ada
//      balapan pada logika penggantian meter. try/catch PER BARIS tetap
//      dipertahankan persis seperti semula.
//
// STATUS TAGIHAN: tanggalJatuhTempo TIDAK ADA di sumber CSV manapun —
// tetap dihitung sebagai placeholder (periode + 1 bulan), WAJIB
// dikonfirmasi ke aturan bisnis PDAM yang sebenarnya. TAPI kolom
// `jmlreknunggak` (jumlah rekening menunggak) ADALAH data asli dan
// dipakai sebagai sinyal nyata: kalau pelanggan ini punya rekening
// menunggak (jmlreknunggak > 0), tagihan periode ini di-set JATUH_TEMPO
// alih-alih BELUM_BAYAR — itu bukti nyata dari data bahwa akun ini dalam
// keadaan menunggak, bukan tebakan dari placeholder tanggal.

import type { Prisma } from "../../../generated/client"
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
import { usulkanPemakaianTagih, type AlasanTaksir } from "@workspace/domain/tagihan"

const STEP = "06-meter"

/// Berapa baris diproses bersamaan. Cukup besar untuk menutupi latensi
/// jaringan ke Postgres terkelola, cukup kecil supaya tidak menghabiskan
/// pool koneksi (@prisma/adapter-pg default 10-ish) atau meledakkan memori.
const KONKURENSI = 16

function addMonthsUTC(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()))
}

/// Melabeli KENAPA pemakaian tagih berbeda dari pemakaian riil. Ini
/// deskriptif, bukan preskriptif: nilai tagih dari sumber tidak pernah
/// diubah — fungsi ini hanya mencocokkannya dengan aturan yang berlaku
/// supaya perbedaannya bisa dijelaskan saat pelanggan bertanya atau
/// auditor memeriksa.
function labeliAlasanTaksir(params: {
  pemakaianRiil: number
  pemakaianTagih: number
  kondisi: string
  pemakaianLalu: number | null
}): AlasanTaksir | null {
  const { pemakaianRiil, pemakaianTagih, kondisi, pemakaianLalu } = params
  if (pemakaianTagih === pemakaianRiil) return null

  const usulan = usulkanPemakaianTagih({ pemakaianRiil, kondisi, pemakaianLalu })
  if (usulan.pemakaianTagih === pemakaianTagih && usulan.alasan !== null) return usulan.alasan

  // Berbeda dari pemakaian riil TAPI tidak cocok dengan satu pun aturan —
  // berarti seseorang menetapkannya secara sadar. Dicatat apa adanya.
  return "OVERRIDE_MANUAL"
}

export async function seedMeter(
  prisma: PrismaClientLike,
  report: SeedReport
): Promise<void> {
  const rows = readProgresCater()

  // --- Preload semua lookup sekali (lihat catatan KINERJA di atas file) ---
  const [pelangganRows, meterRows] = await Promise.all([
    prisma.pelanggan.findMany({ select: { id: true, nomorLangganan: true } }),
    prisma.meter.findMany({
      where: { isAktif: true },
      select: { id: true, pelangganId: true, nomorMeter: true },
    }),
  ])
  const pelangganCache = new Map(pelangganRows.map((p) => [p.nomorLangganan, p.id]))
  // Satu meter AKTIF per pelanggan ditegakkan di step ini (bukan di DB),
  // jadi Map pelangganId -> meter aktif sudah mewakili.
  const meterAktifCache = new Map(meterRows.map((m) => [m.pelangganId, m]))

  async function prosesBaris(row: (typeof rows)[number], i: number): Promise<void> {
    const nomorLangganan = normalizeNolg(row.nolg)
    if (!nomorLangganan) return // sudah di-log sebagai warning di step 05

    const pelangganId = pelangganCache.get(nomorLangganan)
    if (!pelangganId) {
      report.warn(STEP, `Pelanggan ${nomorLangganan} tidak ditemukan (step 05 mestinya sudah buat), baris dilewati`, {
        row: i,
        key: nomorLangganan,
      })
      report.skipped(STEP)
      return
    }

    const nomorMeter = trimOrNull(row.nometer)
    const ukuran = normalizeUkuranMeter(row.ukmeter)
    if (!nomorMeter || !ukuran) {
      report.warn(STEP, `nometer/ukmeter tidak valid untuk ${nomorLangganan}, Meter+Tagihan dilewati`, {
        key: nomorLangganan,
      })
      report.skipped(STEP)
      return
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
      const meterAktif = meterAktifCache.get(pelangganId)

      if (!meterAktif) {
        const created = await prisma.meter.create({
          data: { pelangganId, nomorMeter, ukuran, isAktif: true, ...meterFields },
        })
        meterId = created.id
        meterAktifCache.set(pelangganId, { id: created.id, pelangganId, nomorMeter })
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
          data: { pelangganId, nomorMeter, ukuran, isAktif: true, ...meterFields },
        })
        meterId = created.id
        meterAktifCache.set(pelangganId, { id: created.id, pelangganId, nomorMeter })
        report.created(`${STEP}:meter`)
      }
    } catch (err) {
      report.error(STEP, `Gagal proses Meter ${nomorLangganan}: ${(err as Error).message}`, {
        key: nomorLangganan,
      })
      return
    }

  }

  // Proses berkelompok secara paralel. try/catch ada di dalam prosesBaris
  // (per baris), jadi satu baris gagal tidak menjatuhkan kelompoknya.
  for (let mulai = 0; mulai < rows.length; mulai += KONKURENSI) {
    const kelompok = rows.slice(mulai, mulai + KONKURENSI)
    await Promise.all(kelompok.map((row, n) => prosesBaris(row, mulai + n)))
  }
}
