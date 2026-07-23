"use client";

// features/dashboard/components/verifikasi/ringkasan-verifikasi.tsx — strip
// 4 kartu statistik di atas halaman verifikasi + dropdown periode. Pola
// hairline yang sama dengan halaman Ringkasan (grid gap-px, sel bg-card).
import { CheckCircle2, ClipboardList, Hourglass, Percent } from "lucide-react";
import { NativeSelect } from "@workspace/ui/components/native-select";
import { formatPeriode } from "@/features/public/lib/format";
import { StatCard } from "../stat-card";
import type { StatsVerifikasi } from "./tipe";

export function PilihPeriode({
  periodes,
  nilai,
  onGanti,
}: {
  periodes: number[];
  nilai: number | null;
  onGanti: (p: number | null) => void;
}) {
  return (
    <NativeSelect
      aria-label="Filter periode"
      value={nilai ?? ""}
      onChange={(e) =>
        onGanti(e.currentTarget.value ? Number(e.currentTarget.value) : null)
      }
      className="h-8 w-auto min-w-36 text-xs"
    >
      <option value="">Semua periode</option>
      {periodes.map((p) => (
        <option key={p} value={p}>
          {formatPeriode(p)}
        </option>
      ))}
    </NativeSelect>
  );
}

export function RingkasanVerifikasi({
  stats,
}: {
  stats: StatsVerifikasi | null;
}) {
  const total = stats?.total ?? 0;
  const selesai = (stats?.diverifikasi ?? 0) + (stats?.ditolak ?? 0);
  const progres = total > 0 ? Math.round((selesai / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-px border border-border/70 bg-border/70 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total laporan"
        nilai={total.toLocaleString("id-ID")}
        icon={ClipboardList}
        keterangan="Sesuai filter periode"
      />
      <StatCard
        label="Menunggu"
        nilai={(stats?.menunggu ?? 0).toLocaleString("id-ID")}
        icon={Hourglass}
        keterangan="Belum diverifikasi"
        nada={(stats?.menunggu ?? 0) > 0 ? "perhatian" : "netral"}
      />
      <StatCard
        label="Terverifikasi"
        nilai={(stats?.diverifikasi ?? 0).toLocaleString("id-ID")}
        icon={CheckCircle2}
        keterangan={`Ditolak: ${(stats?.ditolak ?? 0).toLocaleString("id-ID")}`}
      />
      <StatCard
        label="Progres selesai"
        nilai={`${progres}%`}
        icon={Percent}
        keterangan={`${selesai.toLocaleString("id-ID")} dari ${total.toLocaleString("id-ID")} laporan`}
      />
    </div>
  );
}
