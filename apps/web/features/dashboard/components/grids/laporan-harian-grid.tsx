"use client"

// Grid /dashboard/laporan-harian — endpoint GET /api/v1/laporan-harian
// (setoran baca meter harian petugas lapangan, sebelum verifikasi).
//
// namaPelanggan dari field snapshot (bukan relasi) — lihat catatan pola
// snapshot di prisma/README.md.
import type { ColDef } from "ag-grid-community"
import { DataGrid } from "../data-grid"
import { selBool, fmtBool, fmtPeriodeInt, fmtAngka, fmtLabel, KELAS_ANGKA, KELAS_MONO } from "./sel"
import { LABEL_KONDISI_CATAT } from "../../lib/label"

const KOLOM: ColDef[] = [
  { field: "nomorLangganan", headerName: "No. Langganan", minWidth: 135, maxWidth: 150, cellClass: KELAS_MONO, sortable: true },
  { field: "namaPelanggan", headerName: "Pelanggan", minWidth: 160, flex: 2, sortable: true },
  { field: "periode", headerName: "Periode", minWidth: 105, sortable: true, valueFormatter: fmtPeriodeInt },
  { field: "standAwal", headerName: "Stand Awal", minWidth: 100, sortable: true, cellClass: KELAS_ANGKA, valueFormatter: fmtAngka },
  { field: "standAkhir", headerName: "Stand Akhir", minWidth: 100, sortable: true, cellClass: KELAS_ANGKA, valueFormatter: fmtAngka },
  { field: "pemakaian", headerName: "Pakai (m³)", minWidth: 100, sortable: true, cellClass: KELAS_ANGKA, valueFormatter: fmtAngka },
  { field: "kondisi", headerName: "Kondisi", minWidth: 130, sortable: true, valueFormatter: fmtLabel(LABEL_KONDISI_CATAT) },
  { field: "isVerified", headerName: "Verifikasi", minWidth: 120, sortable: true, cellRenderer: selBool("Terverifikasi", "Belum", "hijau", "amber"), valueFormatter: fmtBool("Terverifikasi", "Belum") },
]

export function LaporanHarianGrid() {
  return (
    <DataGrid
      judul="Laporan Harian Petugas"
      endpoint="/laporan-harian"
      columnDefs={KOLOM}
      searchParam="q"
      searchPlaceholder="Cari nama / nomor…"
    />
  )
}
