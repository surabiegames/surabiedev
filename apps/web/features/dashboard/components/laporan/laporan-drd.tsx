"use client";

// features/dashboard/components/laporan/laporan-drd.tsx — Laporan DRD
// (Daftar Rekening Ditagih): rekap agregat + daftar lengkap tagihan air per
// periode, sumber GET /api/v1/tagihan/drd (+ /rekap). Ekspor Excel ikut
// gratis dari DataGrid — DRD memang laporan yang biasa dicetak/dibagikan.
import * as React from "react";
import type { ColDef, ValueFormatterParams } from "ag-grid-community";
import { Banknote, Droplets, ReceiptText, Wallet } from "lucide-react";
import { NativeSelect } from "@workspace/ui/components/native-select";
import {
  formatPeriode,
  formatRupiah,
  formatRupiahRingkas,
  LABEL_STATUS_TAGIHAN,
} from "@/features/public/lib/format";
import { ambilSatu, ApiError } from "../../lib/api-client";
import { DataGrid } from "../data-grid";
import { StatCard } from "../stat-card";
import {
  selStatus,
  fmtRupiah,
  fmtPeriodeIso,
  fmtTanggal,
  fmtAngka,
  KELAS_ANGKA,
  KELAS_MONO,
} from "../grids/sel";

interface RekapDrd {
  totalRekening: number;
  totalPemakaianM3: number;
  totalHargaAir: number;
  totalDenda: number;
  totalTagihan: number;
  perStatus: { status: string; jumlah: number; nominal: number }[];
  periodes: number[];
}

/// nominalTunggak dikirim backend sebagai STRING (BigInt tidak bisa di-JSON;
/// presisinya wajib utuh — lihat serialize() di tagihan.router.ts).
function fmtTunggak(p: ValueFormatterParams): string {
  if (p.value == null) return "—";
  const n = Number(p.value);
  return Number.isFinite(n) ? formatRupiah(n) : String(p.value);
}

const KOLOM: ColDef[] = [
  {
    headerName: "No. Langganan",
    minWidth: 135,
    maxWidth: 150,
    cellClass: KELAS_MONO,
    valueGetter: (p) => p.data?.pelanggan?.nomorLangganan ?? "—",
  },
  {
    headerName: "Nama",
    minWidth: 150,
    flex: 2,
    valueGetter: (p) => p.data?.pelanggan?.nama ?? "—",
  },
  {
    headerName: "Alamat",
    minWidth: 170,
    flex: 2,
    valueGetter: (p) => p.data?.pelanggan?.alamat ?? "—",
  },
  {
    headerName: "Gol. tarif",
    minWidth: 90,
    valueGetter: (p) => p.data?.pelanggan?.tarifGolongan?.kodeAsli ?? "—",
  },
  {
    headerName: "Rute",
    minWidth: 85,
    cellClass: KELAS_MONO,
    valueGetter: (p) => p.data?.pelanggan?.rute?.kode ?? "—",
  },
  {
    field: "periode",
    headerName: "Periode",
    minWidth: 105,
    sortable: true,
    valueFormatter: fmtPeriodeIso,
  },
  {
    field: "pemakaianM3",
    headerName: "Pakai (m³)",
    minWidth: 100,
    sortable: true,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtAngka,
  },
  {
    field: "jmlHargaAir",
    headerName: "Harga air",
    minWidth: 110,
    sortable: true,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtRupiah,
  },
  {
    field: "beaBeban",
    headerName: "Beban",
    minWidth: 95,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtRupiah,
  },
  {
    field: "beaAdmin",
    headerName: "Admin",
    minWidth: 95,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtRupiah,
  },
  {
    field: "airKotor",
    headerName: "Air kotor",
    minWidth: 95,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtRupiah,
  },
  {
    field: "denda",
    headerName: "Denda",
    minWidth: 90,
    sortable: true,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtRupiah,
  },
  {
    field: "totalTagihan",
    headerName: "Total",
    minWidth: 115,
    sortable: true,
    cellClass: KELAS_ANGKA + " font-semibold",
    valueFormatter: fmtRupiah,
  },
  {
    field: "nominalTunggak",
    headerName: "Tunggakan",
    minWidth: 110,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtTunggak,
  },
  {
    field: "status",
    headerName: "Status",
    minWidth: 120,
    sortable: true,
    cellRenderer: selStatus({
      BELUM_BAYAR: { label: "Belum bayar", nada: "amber" },
      SUDAH_BAYAR: { label: "Lunas", nada: "hijau" },
      JATUH_TEMPO: { label: "Jatuh tempo", nada: "merah" },
      DIHAPUSKAN: { label: "Dihapuskan", nada: "netral" },
    }),
  },
  {
    field: "tanggalJatuhTempo",
    headerName: "Jatuh tempo",
    minWidth: 115,
    sortable: true,
    valueFormatter: fmtTanggal,
  },
];

export function LaporanDrd() {
  // undefined = belum init; default ke periode terbaru yang punya data
  // (aturan dashboard — closing bulanan bisa tertinggal dari bulan berjalan).
  const [periode, setPeriode] = React.useState<number | null | undefined>(
    undefined,
  );
  const [rekap, setRekap] = React.useState<RekapDrd | null>(null);
  const [galat, setGalat] = React.useState<string | null>(null);

  React.useEffect(() => {
    let batal = false;
    ambilSatu<RekapDrd>("/tagihan/drd/rekap", { periode: periode ?? undefined })
      .then((r) => {
        if (batal) return;
        setRekap(r);
        setGalat(null);
        setPeriode((lama) =>
          lama === undefined ? (r.periodes[0] ?? null) : lama,
        );
      })
      .catch((err) => {
        if (!batal)
          setGalat(
            err instanceof ApiError ? err.message : "Gagal memuat rekap DRD.",
          );
      });
    return () => {
      batal = true;
    };
  }, [periode]);

  const lunas = rekap?.perStatus.find((s) => s.status === "SUDAH_BAYAR");

  return (
    // Rantai tinggi penuh: kepala + kartu statistik shrink-0, tabel mengisi
    // sisa (flex-1 min-h-0) & memakai gulir-internal AG Grid — konsisten
    // dengan halaman tabel lain sejak layout.tsx mengunci tinggi.
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {periode
            ? `DRD periode ${formatPeriode(periode)}`
            : "Seluruh periode tagihan"}
        </p>
        <NativeSelect
          aria-label="Filter periode"
          value={periode ?? ""}
          onChange={(e) =>
            setPeriode(
              e.currentTarget.value ? Number(e.currentTarget.value) : null,
            )
          }
          className="h-8 w-auto min-w-36 text-xs"
        >
          <option value="">Semua periode</option>
          {(rekap?.periodes ?? []).map((p) => (
            <option key={p} value={p}>
              {formatPeriode(p)}
            </option>
          ))}
        </NativeSelect>
      </div>

      {galat && <p className="shrink-0 text-xs text-destructive">{galat}</p>}

      <div className="grid shrink-0 grid-cols-1 gap-px border border-border/70 bg-border/70 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Rekening ditagih"
          nilai={(rekap?.totalRekening ?? 0).toLocaleString("id-ID")}
          icon={ReceiptText}
          keterangan="Lembar rekening pada periode ini"
        />
        <StatCard
          label="Pemakaian air"
          nilai={`${(rekap?.totalPemakaianM3 ?? 0).toLocaleString("id-ID")} m³`}
          icon={Droplets}
          keterangan="Total m³ tertagih"
        />
        <StatCard
          label="Nilai DRD"
          nilai={formatRupiahRingkas(rekap?.totalTagihan ?? 0)}
          judulLengkap={formatRupiah(rekap?.totalTagihan ?? 0)}
          icon={Banknote}
          keterangan={`Harga air ${formatRupiahRingkas(rekap?.totalHargaAir ?? 0)} + beban/admin/denda`}
        />
        <StatCard
          label="Sudah lunas"
          nilai={formatRupiahRingkas(lunas?.nominal ?? 0)}
          judulLengkap={formatRupiah(lunas?.nominal ?? 0)}
          icon={Wallet}
          keterangan={`${(lunas?.jumlah ?? 0).toLocaleString("id-ID")} dari ${(rekap?.totalRekening ?? 0).toLocaleString("id-ID")} rekening`}
        />
      </div>

      <div className="min-h-0 min-w-0 flex-1">
        <DataGrid
          judul="Daftar Rekening Ditagih"
          endpoint="/tagihan/drd"
          columnDefs={KOLOM}
          searchParam="q"
          searchPlaceholder="Cari no. langganan / nama…"
          filters={[
            {
              param: "status",
              label: "Status",
              opsi: Object.entries(LABEL_STATUS_TAGIHAN).map(
                ([value, label]) => ({ value, label }),
              ),
            },
          ]}
          extraParams={periode ? { periode: String(periode) } : undefined}
        />
      </div>
    </div>
  );
}
