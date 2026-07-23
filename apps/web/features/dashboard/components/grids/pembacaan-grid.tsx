"use client"

// Grid /dashboard/pembacaan — endpoint GET /api/v1/pembacaan (pencatatan
// meter resmi hasil closing/verifikasi).
// Kolom nomor langganan & nama pelanggan dipisah supaya ekspor Excel-nya
// langsung berbentuk kolom rekap.
import type { ColDef } from "ag-grid-community"
import { DataGrid } from "../data-grid"
import { fmtPeriodeIso, fmtAngka, fmtLabel, KELAS_ANGKA, KELAS_MONO } from "./sel"
import { LABEL_KONDISI_CATAT } from "../../lib/label"

const KOLOM: ColDef[] = [
  { headerName: "No. Langganan", minWidth: 135, maxWidth: 155, cellClass: KELAS_MONO, valueGetter: (p) => p.data?.meter?.pelanggan?.nomorLangganan },
  { headerName: "Nama Pelanggan", minWidth: 170, flex: 2, valueGetter: (p) => p.data?.meter?.pelanggan?.nama },
  { headerName: "No. Meter", minWidth: 115, cellClass: KELAS_MONO, valueGetter: (p) => p.data?.meter?.nomorMeter },
  { field: "periode", headerName: "Periode", minWidth: 110, sortable: true, valueFormatter: fmtPeriodeIso },
  { field: "standLalu", headerName: "Stand Lalu", minWidth: 100, sortable: true, cellClass: KELAS_ANGKA, valueFormatter: fmtAngka },
  { field: "standAkhir", headerName: "Stand Akhir", minWidth: 100, sortable: true, cellClass: KELAS_ANGKA, valueFormatter: fmtAngka },
  { field: "pemakaianM3", headerName: "Pakai (m³)", minWidth: 100, sortable: true, cellClass: KELAS_ANGKA, valueFormatter: fmtAngka },
  { field: "kondisi", headerName: "Kondisi", minWidth: 140, sortable: true, valueFormatter: fmtLabel(LABEL_KONDISI_CATAT) },
  { headerName: "Pencatat", minWidth: 120, valueGetter: (p) => p.data?.pencatat?.namaLapangan ?? "—" },
]

export function PembacaanGrid() {
  return (
    <DataGrid
      judul="Pembacaan Meter Resmi"
      endpoint="/pembacaan"
      columnDefs={KOLOM}
      filters={[
        {
          // LENGKAP: seluruh 21 kondisi catat, bukan hanya yang "sering".
          param: "kondisi",
          label: "Kondisi",
          opsi: Object.entries(LABEL_KONDISI_CATAT).map(([value, label]) => ({ value, label })),
        },
      ]}
    />
  )
}
