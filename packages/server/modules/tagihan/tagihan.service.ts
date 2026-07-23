// server/modules/tagihan/tagihan.service.ts — pembentukan tagihan air.
//
// PRINSIP: nominal tagihan SELALU dihitung ulang di server dari TarifBlok
// yang berlaku pada periode ybs — client tidak pernah bisa mengirim
// jmlHargaAir/totalTagihan. Perhitungan air memakai tarif PROGRESIF: tiap
// blok konsumsi punya harga/m3 sendiri dan yang dikenakan adalah harga
// masing-masing blok untuk porsi pemakaian yang jatuh di blok itu (bukan
// satu harga flat untuk seluruh pemakaian).
import type { Prisma } from "@workspace/db"
import { prisma } from "@workspace/db"
import { NotFoundError, ConflictError, BadRequestError } from "../../lib/errors"

export interface RincianBlok {
  blok: number
  dariM3: number
  sampaiM3: number
  volumeM3: number
  hargaPerM3: number
  subtotal: number
}

/// Hitung biaya air progresif untuk `pemakaianM3` memakai blok tarif yang
/// berlaku pada `periode`. Blok diurutkan dari batas terkecil; blok dengan
/// batasAkhirM3 null = blok terakhir (tak terbatas).
export function hitungBiayaAir(
  pemakaianM3: number,
  blokTarif: { blok: number; batasAwalM3: number; batasAkhirM3: number | null; hargaPerM3: number }[]
): { total: number; rincian: RincianBlok[] } {
  const urut = [...blokTarif].sort((a, b) => a.batasAwalM3 - b.batasAwalM3)
  const rincian: RincianBlok[] = []
  let total = 0

  for (const b of urut) {
    if (pemakaianM3 <= b.batasAwalM3) break
    const batasAtas = b.batasAkhirM3 ?? Number.POSITIVE_INFINITY
    const volume = Math.min(pemakaianM3, batasAtas) - b.batasAwalM3
    if (volume <= 0) continue
    const subtotal = volume * b.hargaPerM3
    total += subtotal
    rincian.push({
      blok: b.blok,
      dariM3: b.batasAwalM3,
      sampaiM3: Math.min(pemakaianM3, batasAtas),
      volumeM3: volume,
      hargaPerM3: b.hargaPerM3,
      subtotal,
    })
  }

  return { total, rincian }
}

async function getBlokBerlaku(tx: Prisma.TransactionClient, tarifGolonganId: string, periode: Date) {
  return tx.tarifBlok.findMany({
    where: {
      tarifGolonganId,
      berlakuMulai: { lte: periode },
      OR: [{ berlakuSampai: null }, { berlakuSampai: { gte: periode } }],
    },
    orderBy: [{ blok: "asc" }, { berlakuMulai: "desc" }],
  })
}

export interface GenerateTagihanInput {
  pembacaanId: string
  beaBeban?: number
  beaAdmin?: number
  airKotor?: number
  lainLain?: number
  denda?: number
  tanggalJatuhTempo: Date
}

export async function generateTagihan(input: GenerateTagihanInput) {
  return prisma.$transaction(async (tx) => {
    const pembacaan = await tx.pembacaanMeter.findUnique({
      where: { id: input.pembacaanId },
      include: { meter: { include: { pelanggan: true } }, tagihan: true },
    })
    if (!pembacaan) throw new NotFoundError("PembacaanMeter")
    if (pembacaan.tagihan) throw new ConflictError("Pembacaan ini sudah punya tagihan")

    const pelanggan = pembacaan.meter.pelanggan
    if (pelanggan.deletedAt) throw new BadRequestError("Pelanggan sudah dihapus")
    if (!pelanggan.tarifGolonganId) {
      throw new BadRequestError("Pelanggan belum punya golongan tarif — tidak bisa menghitung tagihan")
    }

    const blok = await getBlokBerlaku(tx, pelanggan.tarifGolonganId, pembacaan.periode)
    if (blok.length === 0) {
      throw new BadRequestError(
        `Tidak ada TarifBlok yang berlaku untuk golongan tarif pelanggan pada periode ${pembacaan.periode.toISOString().slice(0, 7)}`
      )
    }

    const { total: jmlHargaAir, rincian } = hitungBiayaAir(pembacaan.pemakaianM3, blok)

    const beaBeban = input.beaBeban ?? 7000
    const beaAdmin = input.beaAdmin ?? 10000
    const airKotor = input.airKotor ?? 11100
    const lainLain = input.lainLain ?? 0
    const denda = input.denda ?? 0
    const totalTagihan = jmlHargaAir + beaBeban + beaAdmin + airKotor + lainLain + denda

    const tagihan = await tx.tagihan.create({
      data: {
        pelangganId: pelanggan.id,
        pembacaanId: pembacaan.id,
        periode: pembacaan.periode,
        pemakaianM3: pembacaan.pemakaianM3,
        jmlHargaAir,
        beaBeban,
        beaAdmin,
        airKotor,
        lainLain,
        denda,
        totalTagihan,
        tanggalJatuhTempo: input.tanggalJatuhTempo,
      },
    })

    return { ...tagihan, rincianBlok: rincian }
  })
}
