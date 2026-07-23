"use client"

// Grid /dashboard/laporan-mandiri — endpoint GET /api/v1/laporan-mandiri
// (laporan meter yang dikirim pelanggan dari halaman publik /lapor-meter).
import type { ColDef, ICellRendererParams } from "ag-grid-community"
import { DataGrid } from "../data-grid"
import { selStatus, fmtLabel, fmtPeriodeInt, fmtAngka, fmtTanggal, KELAS_ANGKA, KELAS_MONO } from "./sel"
import { LABEL_STATUS_LAPORAN_MANDIRI } from "../../lib/label"

function SelFoto(p: ICellRendererParams) {
  const url = p.value as string | null | undefined
  if (!url) return <span className="text-muted-foreground">—</span>
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
      Lihat foto ↗
    </a>
  )
}

const KOLOM: ColDef[] = [
  { field: "nomorLangganan", headerName: "No. Langganan", minWidth: 135, maxWidth: 150, cellClass: KELAS_MONO, sortable: true },
  { headerName: "Pelanggan", minWidth: 160, flex: 2, valueGetter: (p) => p.data?.pelanggan?.nama ?? "—" },
  { field: "periode", headerName: "Periode", minWidth: 105, sortable: true, valueFormatter: fmtPeriodeInt },
  { field: "standDilaporkan", headerName: "Stand (m³)", minWidth: 100, sortable: true, cellClass: KELAS_ANGKA, valueFormatter: fmtAngka },
  { field: "namaPelapor", headerName: "Pelapor", minWidth: 130, sortable: true },
  { field: "fotoUrl", headerName: "Bukti", minWidth: 100, cellRenderer: SelFoto },
  {
    field: "status",
    headerName: "Status",
    minWidth: 130,
    sortable: true,
    valueFormatter: fmtLabel(LABEL_STATUS_LAPORAN_MANDIRI),
    cellRenderer: selStatus({
      MENUNGGU: { label: "Menunggu", nada: "amber" },
      DIVERIFIKASI: { label: "Diverifikasi", nada: "hijau" },
      DIGUNAKAN: { label: "Digunakan", nada: "hijau" },
      DITOLAK: { label: "Ditolak", nada: "merah" },
    }),
  },
  { field: "createdAt", headerName: "Masuk", minWidth: 120, sortable: true, valueFormatter: fmtTanggal },
]

export function LaporanMandiriGrid() {
  return (
    <DataGrid
      judul="Laporan Meter Mandiri"
      endpoint="/laporan-mandiri"
      columnDefs={KOLOM}
      filters={[
        {
          param: "status",
          label: "Status",
          opsi: Object.entries(LABEL_STATUS_LAPORAN_MANDIRI).map(([value, label]) => ({ value, label })),
        },
      ]}
    />
  )
}
