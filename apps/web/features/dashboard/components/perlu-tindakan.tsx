// features/dashboard/components/perlu-tindakan.tsx — daftar pekerjaan yang
// menunggu petugas.
//
// Ini INTI dashboard operasional: bukan sekadar angka, tapi "apa yang harus
// saya kerjakan sekarang". Karena itu diurutkan berdasarkan prioritas lalu
// yang paling lama menunggu (bukan yang terbaru) — aduan yang terlantar
// justru harus paling terlihat.
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  formatPeriode,
  formatTanggal,
  LABEL_JENIS_PENGADUAN,
  LABEL_STATUS_PENGADUAN,
} from "@/features/public/lib/format";
import { Panel } from "./panel";

interface Pengaduan {
  id: string;
  nomorTiket: string;
  jenis: string;
  judul: string;
  status: string;
  prioritas: string;
  createdAt: Date;
}

interface LaporanMandiri {
  id: string;
  nomorLangganan: string;
  periode: number;
  standDilaporkan: number;
  createdAt: Date;
  pelanggan: { nama: string } | null;
}

function Kosong({ pesan }: { pesan: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Inbox className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{pesan}</p>
    </div>
  );
}

export function PerluTindakan({
  pengaduan,
  laporanMandiri,
}: {
  pengaduan: Pengaduan[];
  laporanMandiri: LaporanMandiri[];
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel
        label="Pengaduan Aktif"
        chip={pengaduan.length > 0 ? `${pengaduan.length} Menunggu` : undefined}
        deskripsi="Prioritas tertinggi & paling lama menunggu di atas."
        className="p-2"
      >
        {pengaduan.length === 0 ? (
          <Kosong pesan="Tidak ada pengaduan yang menunggu." />
        ) : (
          <div className="flex flex-col">
            {pengaduan.map((p, i) => (
              <Link
                key={p.id}
                href={`/dashboard/pengaduan?q=${p.nomorTiket}`}
                className={
                  "flex items-start justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-accent " +
                  (i < pengaduan.length - 1
                    ? "border-b border-dashed border-border/50"
                    : "")
                }
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.judul}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {LABEL_JENIS_PENGADUAN[p.jenis] ?? p.jenis} ·{" "}
                    {formatTanggal(p.createdAt.toISOString())}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {(p.prioritas === "DARURAT" || p.prioritas === "TINGGI") && (
                    <Badge variant="destructive">
                      {p.prioritas.toLowerCase()}
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {LABEL_STATUS_PENGADUAN[p.status] ?? p.status}
                  </Badge>
                </div>
              </Link>
            ))}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="mt-2 justify-start text-muted-foreground"
            >
              <Link href="/dashboard/pengaduan">
                Lihat semua pengaduan <ArrowRight />
              </Link>
            </Button>
          </div>
        )}
      </Panel>

      <Panel
        label="Laporan Meter Menunggu Verifikasi"
        chip={
          laporanMandiri.length > 0
            ? `${laporanMandiri.length} Menunggu`
            : undefined
        }
        deskripsi="Dikirim pelanggan lewat halaman publik."
        className="p-2"
      >
        {laporanMandiri.length === 0 ? (
          <Kosong pesan="Tidak ada laporan yang menunggu verifikasi." />
        ) : (
          <div className="flex flex-col">
            {laporanMandiri.map((l, i) => (
              <Link
                key={l.id}
                href={`/dashboard/laporan-mandiri?id=${l.id}`}
                className={
                  "flex items-start justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-accent " +
                  (i < laporanMandiri.length - 1
                    ? "border-b border-dashed border-border/50"
                    : "")
                }
              >
                <div className="min-w-0">
                  {/* Nama dari relasi bila ada; nomor langganan sebagai
                      cadangan — laporan bisa saja belum ter-resolve ke
                      Pelanggan. */}
                  <p className="truncate text-sm font-medium">
                    {l.pelanggan?.nama ?? l.nomorLangganan}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatPeriode(l.periode)} ·{" "}
                    {formatTanggal(l.createdAt.toISOString())}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold text-foreground tabular-nums">
                  {l.standDilaporkan}{" "}
                  <span className="font-sans font-normal text-muted-foreground">
                    m³
                  </span>
                </span>
              </Link>
            ))}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="mt-2 justify-start text-muted-foreground"
            >
              <Link href="/dashboard/laporan-mandiri">
                Lihat semua laporan <ArrowRight />
              </Link>
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
