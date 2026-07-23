"use client"

// Grid /dashboard/organisasi — empat entitas struktur organisasi dalam satu
// halaman ber-tab: Divisi → Bagian → Sub-bagian, plus Pencatat (jembatan
// nama petugas lapangan di CSV ↔ akun User + penugasan Rute Baca Meter
// yang diunduh aplikasi mobile petugas).
import type { ColDef } from "ag-grid-community"
import { DataGrid } from "../data-grid"
import { selBool, fmtLabel, KELAS_MONO } from "./sel"
import { LABEL_ROLE } from "../../lib/label"

// Tinggi tabel tidak lagi dipatok di sini — grid memakai default `flex-1`
// dan mengisi TabsContent (lihat organisasi/page.tsx yang sudah full-height),
// konsisten dengan halaman tabel lain.
export function DivisiGrid() {
  const kolom: ColDef[] = [{ field: "nama", headerName: "Nama Divisi", minWidth: 240, flex: 2 }]
  return <DataGrid judul="Divisi" endpoint="/divisi" columnDefs={kolom} searchParam="q" />
}

export function BagianGrid() {
  const kolom: ColDef[] = [
    { field: "kode", headerName: "Kode", minWidth: 100, maxWidth: 130, cellClass: KELAS_MONO },
    { field: "nama", headerName: "Nama Bagian", minWidth: 220, flex: 2 },
    { field: "levelKepala", headerName: "Level Kepala", minWidth: 150, valueFormatter: fmtLabel(LABEL_ROLE) },
    { headerName: "Divisi", minWidth: 150, valueGetter: (p) => p.data?.divisi?.nama ?? "—" },
  ]
  return <DataGrid judul="Bagian" endpoint="/bagian" columnDefs={kolom} searchParam="q" />
}

export function SubBagianGrid() {
  const kolom: ColDef[] = [
    { field: "kode", headerName: "Kode", minWidth: 100, maxWidth: 130, cellClass: KELAS_MONO },
    { field: "nama", headerName: "Nama Sub-bagian", minWidth: 220, flex: 2 },
    { headerName: "Bagian", minWidth: 150, valueGetter: (p) => p.data?.bagian?.nama ?? "—" },
  ]
  return <DataGrid judul="Sub-bagian" endpoint="/sub-bagian" columnDefs={kolom} searchParam="q" />
}

export function PencatatGrid() {
  // Penugasan rute pindah ke halaman khusus /dashboard/pemetaan-rute
  // (many-to-many berurut). Grid ini kini murni menampilkan pencatat + jumlah
  // rute yang dipegangnya (Pencatat._count.penugasanRute).
  const kolom: ColDef[] = [
    { field: "namaLapangan", headerName: "Nama Lapangan", minWidth: 150 },
    { field: "namaLengkap", headerName: "Nama Lengkap", minWidth: 180, flex: 2 },
    { field: "nip", headerName: "NIP", minWidth: 130, cellClass: KELAS_MONO },
    { headerName: "Akun Tertaut", minWidth: 160, valueGetter: (p) => p.data?.user?.name ?? p.data?.user?.email ?? "—" },
    {
      headerName: "Jumlah Rute",
      minWidth: 120,
      maxWidth: 150,
      valueGetter: (p) => `${p.data?._count?.penugasanRute ?? 0} rute`,
    },
    { field: "isAktif", headerName: "Status", minWidth: 110, maxWidth: 130, cellRenderer: selBool("Aktif", "Non-aktif") },
  ]
  return (
    <DataGrid
      judul="Pencatat Lapangan — atur penugasan rute di menu Pemetaan Rute"
      endpoint="/pencatat"
      columnDefs={kolom}
      searchParam="q"
    />
  )
}
