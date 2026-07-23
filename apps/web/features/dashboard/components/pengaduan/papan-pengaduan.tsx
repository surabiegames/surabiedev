"use client";

// features/dashboard/components/pengaduan/papan-pengaduan.tsx — halaman kerja
// pengaduan: kartu ringkasan antrean + grid; klik baris membuka HALAMAN
// detail /dashboard/pengaduan/[id] (dulu sheet samping — detail tiket
// terlalu kompleks untuk lebar sheet, lihat detail-tiket.tsx).
import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { AlertTriangle, Inbox, Star, TimerOff } from "lucide-react";
import { ambilSatu } from "../../lib/api-client";
import { LABEL_JENIS_PENGADUAN, LABEL_STATUS_PENGADUAN, formatSisaWaktu } from "@/features/public/lib/format";
import { LABEL_PRIORITAS_PENGADUAN } from "../../lib/label";
import { DataGrid } from "../data-grid";
import { selStatus, fmtTanggal, fmtLabel, KELAS_MONO } from "../grids/sel";
import type { SlaTiket, StatistikPengaduan } from "./tipe";

/// Kolom SLA: yang paling dicari supervisor tiap pagi adalah "mana yang
/// hampir/sudah lewat tenggat" — angka mentah targetSelesaiAt tidak menjawab
/// itu tanpa dihitung di kepala.
function SelSla(p: ICellRendererParams) {
  const sla = p.data?.sla as SlaTiket | undefined;
  if (!sla?.targetSelesaiAt) return <span className="text-muted-foreground">—</span>;
  if (sla.terjeda) return <span className="text-violet-600 dark:text-violet-400">dijeda</span>;

  const teks = formatSisaWaktu(sla.sisaMenit);
  if (sla.melanggar) return <span className="font-medium text-red-600 dark:text-red-400">{teks}</span>;
  // < 4 jam tersisa: cukup dekat untuk perlu diperhatikan hari ini.
  if (sla.sisaMenit !== null && sla.sisaMenit < 240)
    return <span className="text-amber-600 dark:text-amber-400">{teks}</span>;
  return <span className="text-muted-foreground">{teks}</span>;
}

const KOLOM: ColDef[] = [
  { field: "nomorTiket", headerName: "No. Tiket", minWidth: 150, cellClass: KELAS_MONO, sortable: true },
  { field: "judul", headerName: "Judul", minWidth: 200, flex: 2, sortable: true },
  {
    field: "jenis",
    headerName: "Jenis",
    minWidth: 140,
    sortable: true,
    valueFormatter: fmtLabel(LABEL_JENIS_PENGADUAN),
  },
  {
    field: "prioritas",
    headerName: "Prioritas",
    minWidth: 110,
    sortable: true,
    valueFormatter: fmtLabel(LABEL_PRIORITAS_PENGADUAN),
    cellRenderer: selStatus({
      DARURAT: { label: "Darurat", nada: "merah" },
      TINGGI: { label: "Tinggi", nada: "amber" },
      NORMAL: { label: "Normal", nada: "netral" },
      RENDAH: { label: "Rendah", nada: "netral" },
    }),
  },
  {
    field: "status",
    headerName: "Status",
    minWidth: 160,
    sortable: true,
    valueFormatter: fmtLabel(LABEL_STATUS_PENGADUAN),
    cellRenderer: selStatus({
      BARU: { label: "Diterima", nada: "biru" },
      DITUGASKAN: { label: "Ditugaskan", nada: "amber" },
      DIPROSES: { label: "Ditangani", nada: "amber" },
      MENUNGGU_PELANGGAN: { label: "Tunggu pelapor", nada: "netral" },
      SELESAI: { label: "Selesai", nada: "hijau" },
      DITUTUP: { label: "Ditutup", nada: "netral" },
      DIBUKA_KEMBALI: { label: "Dibuka kembali", nada: "merah" },
      DITOLAK: { label: "Ditolak", nada: "merah" },
    }),
  },
  { headerName: "Tenggat", minWidth: 130, cellRenderer: SelSla, sortable: false },
  {
    headerName: "Petugas",
    minWidth: 140,
    valueGetter: (p) => p.data?.ditugaskanKe?.name ?? "—",
  },
  { field: "pelapor", headerName: "Pelapor", minWidth: 130, sortable: true },
  { field: "createdAt", headerName: "Masuk", minWidth: 120, sortable: true, valueFormatter: fmtTanggal },
];

function Kartu({
  ikon: Ikon,
  label,
  nilai,
  nada,
}: {
  ikon: React.ElementType;
  label: string;
  nilai: React.ReactNode;
  nada?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
      <Ikon className={`size-5 shrink-0 ${nada ?? "text-muted-foreground"}`} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{nilai}</p>
      </div>
    </div>
  );
}

export function PapanPengaduan({ initialQ }: { initialQ?: string }) {
  const router = useRouter();
  const [stat, setStat] = React.useState<StatistikPengaduan | null>(null);

  const muatStat = React.useCallback(() => {
    ambilSatu<StatistikPengaduan>("/pengaduan/statistik")
      .then(setStat)
      // Kartu ringkasan adalah pelengkap: kalau gagal, grid di bawahnya tetap
      // berguna. Menggagalkan seluruh halaman karena angka hiasan tidak masuk
      // akal.
      .catch(() => setStat(null));
  }, []);

  React.useEffect(() => {
    muatStat();
  }, [muatStat]);

  return (
    // Rantai tinggi penuh: kartu statistik shrink-0, tabel mengisi sisa
    // (flex-1 min-h-0) dengan gulir-internal AG Grid — konsisten dengan
    // halaman tabel lain.
    <div className="flex h-full min-h-0 flex-col gap-4">
      {stat && (
        <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kartu ikon={Inbox} label="Belum ditugaskan" nilai={stat.belumDitugaskan} nada="text-blue-500" />
          <Kartu ikon={TimerOff} label="Lewat tenggat" nilai={stat.melanggarSla} nada="text-red-500" />
          <Kartu
            ikon={AlertTriangle}
            label="Darurat & tinggi (terbuka)"
            nilai={(stat.perPrioritasTerbuka.DARURAT ?? 0) + (stat.perPrioritasTerbuka.TINGGI ?? 0)}
            nada="text-amber-500"
          />
          <Kartu
            ikon={Star}
            label="Rata-rata kepuasan"
            nada="text-emerald-500"
            nilai={
              stat.rataRating !== null ? (
                <>
                  {stat.rataRating.toFixed(1)}
                  <span className="text-xs font-normal text-muted-foreground"> /5 · {stat.jumlahDinilai} penilaian</span>
                </>
              ) : (
                <span className="text-sm font-normal text-muted-foreground">Belum ada</span>
              )
            }
          />
        </div>
      )}

      <div className="min-h-0 min-w-0 flex-1">
        <DataGrid
          judul="Pengaduan Warga"
          endpoint="/pengaduan"
          columnDefs={KOLOM}
          searchParam="q"
          searchPlaceholder="Cari judul / tiket…"
          initialSearch={initialQ}
          // DataGrid mengoper baris sebagai Record<string, unknown> (ia tidak
          // tahu bentuk data tiap endpoint) — `id` dibaca langsung, bukan
          // lewat cast ke PengaduanBaris yang cuma menipu pemeriksa tipe.
          onRowClicked={(row) => {
            if (typeof row.id === "string") router.push(`/dashboard/pengaduan/${row.id}`)
          }}
          filters={[
            {
              param: "status",
              label: "Status",
              opsi: Object.entries(LABEL_STATUS_PENGADUAN).map(([value, label]) => ({ value, label })),
            },
            {
              param: "prioritas",
              label: "Prioritas",
              opsi: Object.entries(LABEL_PRIORITAS_PENGADUAN).map(([value, label]) => ({ value, label })),
            },
            {
              param: "jenis",
              label: "Jenis",
              opsi: Object.entries(LABEL_JENIS_PENGADUAN).map(([value, label]) => ({ value, label })),
            },
            {
              param: "melanggarSla",
              label: "SLA",
              opsi: [{ value: "true", label: "Lewat tenggat" }],
            },
          ]}
        />
      </div>
    </div>
  );
}
