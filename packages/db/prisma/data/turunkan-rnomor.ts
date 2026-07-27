// prisma/data/turunkan-rnomor.ts — MENURUNKAN berkas r-nomor dari
// ProgresCater untuk periode yang berkas aslinya tidak kita punya.
//
// KENAPA INI SAH, BUKAN MENGARANG DATA.
//
// Sebuah sambungan yang dicabut pada periode N berhenti muncul di
// ProgresCater N (ia keluar dari closing), sementara baris terakhirnya di
// periode N-1 membawa penanda `mutasinama`: "tupsm" (tutup sementara) atau
// "tupsp" (tutup karena tunggakan). Jadi DUA-DUANYA terbaca dari sumber —
// siapa yang dicabut, DAN jenisnya. Tidak ada yang ditebak.
//
// DIVALIDASI TERHADAP BERKAS ASLI. r-nomor Mei ada di data. Turunan dari
// ProgresCater April->Mei menghasilkan 19 nomor yang SAMA PERSIS dengan
// 19 nomor di berkas asli, dan 19 dari 19 jenisnya cocok — nol selisih.
// Itulah dasar kepercayaan pada berkas hasil skrip ini.
//
// YANG TIDAK BISA DITURUNKAN, dan sengaja dikosongkan: nomor surat, nomor
// SPT, dan tanggal-tanggalnya. Itu dokumen administratif yang hanya ada di
// berkas asli; mengarangnya akan membuat berkas turunan tampak lebih resmi
// daripada yang sebenarnya. Kolomnya tetap ada supaya bentuknya identik
// dengan r-nomor asli dan bisa diunggah lewat layar impor yang sama.
//
// JANUARI TIDAK BISA DITURUNKAN — butuh ProgresCater Desember yang tidak
// kita punya. Itu bukan kekurangan skrip ini: Januari memang awal rantai.
//
// Jalankan: pnpm exec tsx prisma/data/turunkan-rnomor.ts

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { parse } from "csv-parse/sync"

const DIR = join(process.cwd(), "prisma", "data")

const PERIODE = [
  { folder: "jan", thbl: 202601 },
  { folder: "feb", thbl: 202602 },
  { folder: "mar", thbl: 202603 },
  { folder: "apr", thbl: 202604 },
  { folder: "mei", thbl: 202605 },
  { folder: "juni", thbl: 202606 },
] as const

const KOLOM = [
  "periode", "jenis_pemutusan", "nomor_pelanggan", "nama", "no_surat",
  "tgl_permohonan", "tgl_tutup", "no_spt", "tgl_spt", "tgl_cabut",
] as const

function bacaProgresCater(folder: string): Array<Record<string, string>> {
  const jalur = join(DIR, folder, "ProgresCater-PW5.csv")
  if (!existsSync(jalur)) return []
  return parse(readFileSync(jalur), {
    delimiter: ";", columns: true, bom: true, skip_empty_lines: true, relax_column_count: true,
  }) as Array<Record<string, string>>
}

/// Huruf DIPERTAHANKAN — tiga nomor di data ini memuat "A", dan membuangnya
/// mengubahnya jadi nomor sah milik orang lain.
const nolg = (v: string) =>
  (v ?? "").trim().toUpperCase().replace(/[^0-9A-Z]/g, "").padStart(11, "0")

/// Peta kosakata ProgresCater -> kosakata r-nomor. Hanya dua yang dikenal;
/// nilai lain TIDAK diterjemahkan dan barisnya dilaporkan, bukan ditebak.
const JENIS: Record<string, string> = { tupsm: "TSM", tupsp: "SPT" }

function main() {
  const isi = new Map<number, Map<string, Record<string, string>>>()
  for (const p of PERIODE) {
    isi.set(p.thbl, new Map(bacaProgresCater(p.folder).map((r) => [nolg(r.nolg), r])))
  }

  for (let i = 0; i < PERIODE.length - 1; i++) {
    const lalu = PERIODE[i]!
    const kini = PERIODE[i + 1]!
    const a = isi.get(lalu.thbl)!
    const b = isi.get(kini.thbl)!
    if (a.size === 0 || b.size === 0) continue

    const baris: string[] = []
    const takDikenal: string[] = []
    for (const [n, r] of a) {
      if (b.has(n)) continue
      const tanda = (r.mutasinama ?? "").trim().toLowerCase()
      const jenis = JENIS[tanda]
      if (!jenis) {
        takDikenal.push(`${n} (mutasinama="${r.mutasinama}")`)
        continue
      }
      // Nomor ditulis TANPA nol depan, mengikuti bentuk berkas asli.
      baris.push(
        [kini.thbl, jenis, n.replace(/^0+/, ""), (r.nama ?? "").trim(), "", "", "", "", "", ""].join(";")
      )
    }

    const jalur = join(DIR, kini.folder, "r-nomor.csv")
    if (existsSync(jalur)) {
      console.log(`  ${kini.thbl}: DILEWATI — ${kini.folder}/r-nomor.csv sudah ada (berkas asli tidak ditimpa)`)
      continue
    }
    writeFileSync(jalur, "﻿" + [KOLOM.join(";"), ...baris].join("\n") + "\n", "utf-8")
    console.log(`  ${kini.thbl}: ${baris.length} baris -> ${kini.folder}/r-nomor.csv`)
    if (takDikenal.length > 0) {
      console.log(`     ${takDikenal.length} nomor TIDAK diturunkan (penanda tidak dikenal): ${takDikenal.join(", ")}`)
    }
  }
  console.log("\nJanuari sengaja tidak dibuat: butuh ProgresCater Desember yang tidak ada.")
}

main()
