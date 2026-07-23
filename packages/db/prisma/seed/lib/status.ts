// prisma/seed/lib/status.ts — SATU-SATUNYA tempat yang boleh memutuskan
// Pelanggan.status berubah atau tidak. Sengaja dipisah dari steps/*.ts
// dan dibuat sangat konservatif: satu baris CSV yang ambigu TIDAK BOLEH
// membalik status pelanggan tanpa sinyal yang pasti.
//
// Aturan inti (jangan diubah tanpa alasan kuat & didiskusikan dulu):
// 1. ProgresCater.mutasinama HANYA punya kosakata "PELANGGAN AKTIF" /
//    "tupsp" / "tupsm" di data yang sudah diaudit — secara semantik ini
//    HANYA BISA berarti AKTIF atau TUTUP_SEMENTARA. Sumber ini TIDAK
//    PERNAH dipakai untuk set status ke TUTUP_SPT/CABUT_PERMANEN.
// 2. Kalau status pelanggan yang SUDAH ADA di database berstatus terminal
//    (TUTUP_SPT/CABUT_PERMANEN), ProgresCater TIDAK BOLEH "menghidupkan
//    kembali" ke AKTIF/TUTUP_SEMENTARA hanya karena nolg itu masih
//    muncul di file closing bulan ini — itu keputusan bisnis yang perlu
//    konfirmasi manusia, bukan inferensi otomatis.
// 3. Pemutusan (r-nomor) TIDAK PERNAH menulis Pelanggan.status sama
//    sekali (lihat steps/09-pemutusan.ts) — hanya mencatat baris
//    Pemutusan-nya, lalu men-flag ke SeedReport untuk ditinjau manusia.

import type { StatusPelanggan } from "@/app/generated/prisma"

const TERMINAL_STATUSES: ReadonlySet<StatusPelanggan> = new Set([
  "TUTUP_SPT",
  "CABUT_PERMANEN",
])

/// Hanya mengenali kosakata yang SUDAH TERVERIFIKASI ada di ProgresCater
/// .mutasinama. Nilai lain (termasuk yang belum pernah teramati) sengaja
/// return null, BUKAN ditebak — caller tidak akan mengubah status kalau
/// null.
export function mapMutasiNamaToStatus(
  raw: string | null | undefined
): StatusPelanggan | null {
  const v = (raw ?? "").trim().toLowerCase()
  if (v === "pelanggan aktif") return "AKTIF"
  if (v === "tupsp" || v === "tupsm") return "TUTUP_SEMENTARA"
  return null
}

export interface StatusResolution {
  status: StatusPelanggan
  changed: boolean
  reason: string
}

export function resolvePelangganStatus(params: {
  /// null = pelanggan baru (belum ada row di DB).
  existingStatus: StatusPelanggan | null
  /// Hasil mapMutasiNamaToStatus() untuk baris ProgresCater saat ini.
  mutasiNamaStatus: StatusPelanggan | null
}): StatusResolution {
  const { existingStatus, mutasiNamaStatus } = params

  if (existingStatus === null) {
    const status = mutasiNamaStatus ?? "AKTIF"
    return {
      status,
      changed: true,
      reason: mutasiNamaStatus
        ? `pelanggan baru, status dari mutasinama (${mutasiNamaStatus})`
        : "pelanggan baru, mutasinama tidak dikenali -> default AKTIF",
    }
  }

  if (TERMINAL_STATUSES.has(existingStatus)) {
    return {
      status: existingStatus,
      changed: false,
      reason: `status existing (${existingStatus}) bersifat terminal — ProgresCater tidak pernah mengubah status terminal`,
    }
  }

  if (mutasiNamaStatus === null) {
    return {
      status: existingStatus,
      changed: false,
      reason: "mutasinama pada baris ini tidak dikenali, status existing dipertahankan",
    }
  }

  if (mutasiNamaStatus === existingStatus) {
    return { status: existingStatus, changed: false, reason: "tidak ada perubahan" }
  }

  return {
    status: mutasiNamaStatus,
    changed: true,
    reason: `mutasinama pada periode ini menyatakan ${mutasiNamaStatus} (sebelumnya ${existingStatus})`,
  }
}
