"use client"

// Grid /dashboard/pelanggan — endpoint GET /api/v1/pelanggan.
import type { ColDef } from "ag-grid-community"
import { DataGrid } from "../data-grid"
import { selStatus, fmtLabel, KELAS_MONO } from "./sel"
import { LABEL_STATUS_PELANGGAN } from "../../lib/label"

const KOLOM: ColDef[] = [
  { field: "nomorLangganan", headerName: "No. Langganan", cellClass: KELAS_MONO, minWidth: 135, maxWidth: 150, sortable: true },
  { field: "nama", headerName: "Nama", minWidth: 170, sortable: true },
  {
    // colId "alamat" = nama kolom Prisma — sort server-side tetap jalan
    // meski tampilannya digabung RT/RW lewat valueGetter.
    colId: "alamat",
    headerName: "Alamat",
    minWidth: 220,
    flex: 2,
    sortable: true,
    valueGetter: (p) =>
      p.data
        ? [p.data.alamat, p.data.rt && p.data.rw ? `RT ${p.data.rt}/RW ${p.data.rw}` : null].filter(Boolean).join(", ")
        : undefined,
  },
  { headerName: "Kelurahan", minWidth: 130, valueGetter: (p) => p.data?.kelurahan?.nama },
  { headerName: "Gol. Tarif", minWidth: 100, maxWidth: 120, cellClass: KELAS_MONO, valueGetter: (p) => p.data?.tarifGolongan?.kode?.replace("GOL_", "") },
  {
    field: "status",
    headerName: "Status",
    minWidth: 140,
    sortable: true,
    valueFormatter: fmtLabel(LABEL_STATUS_PELANGGAN),
    cellRenderer: selStatus({
      AKTIF: { label: "Aktif", nada: "hijau" },
      TUTUP_SEMENTARA: { label: "Tutup sementara", nada: "amber" },
      DISEGEL: { label: "Disegel", nada: "merah" },
      TUTUP_SPT: { label: "Tutup SPT", nada: "merah" },
      CABUT_PERMANEN: { label: "Cabut permanen", nada: "netral" },
    }),
  },
]

export function PelangganGrid() {
  return (
    <DataGrid
      judul="Daftar Pelanggan"
      endpoint="/pelanggan"
      columnDefs={KOLOM}
      searchParam="q"
      searchPlaceholder="Cari nama / nomor / alamat…"
      filters={[
        {
          param: "status",
          label: "Status",
          opsi: Object.entries(LABEL_STATUS_PELANGGAN).map(([value, label]) => ({ value, label })),
        },
      ]}
    />
  )
}
