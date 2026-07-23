"use client"

// Grid /dashboard/konfigurasi — endpoint GET /api/v1/konfigurasi.
// Nilai ber-flag isRahasia sudah disamarkan SERVER untuk non-SUPER_ADMIN —
// grid ini tinggal menampilkan apa adanya.
import type { ColDef } from "ag-grid-community"
import { DataGrid } from "../data-grid"
import { selBool, fmtBool, fmtTanggal, KELAS_MONO } from "./sel"

const KOLOM: ColDef[] = [
  { field: "kunci", headerName: "Kunci", minWidth: 180, cellClass: KELAS_MONO, sortable: true },
  { field: "nilai", headerName: "Nilai", minWidth: 200, flex: 2, cellClass: KELAS_MONO },
  { field: "tipe", headerName: "Tipe", minWidth: 90, maxWidth: 110, sortable: true },
  { field: "isRahasia", headerName: "Sifat", minWidth: 110, maxWidth: 130, sortable: true, cellRenderer: selBool("Rahasia", "Publik", "amber", "netral"), valueFormatter: fmtBool("Rahasia", "Publik") },
  { field: "deskripsi", headerName: "Deskripsi", minWidth: 200, flex: 2 },
  { field: "updatedAt", headerName: "Diubah", minWidth: 120, sortable: true, valueFormatter: fmtTanggal },
]

export function KonfigurasiGrid() {
  return (
    <DataGrid
      judul="Konfigurasi Sistem"
      endpoint="/konfigurasi"
      columnDefs={KOLOM}
      searchParam="q"
      searchPlaceholder="Cari kunci…"
    />
  )
}
