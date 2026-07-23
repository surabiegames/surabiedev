// features/beranda/components/stats-strip.tsx — baris angka nyata dari
// database (features/beranda/lib/stats.ts). Async server component; dirender
// di dalam <Suspense> dari app/page.tsx supaya hero tidak menunggu query.
//
// Kalau database kosong (deploy baru), seluruh strip disembunyikan — angka
// nol besar-besar lebih merusak kepercayaan daripada tidak ada angka.
import { getStatsBeranda } from "../lib/stats";
import { formatPeriode } from "@/features/public/lib/format";

function angka(n: number): string {
  return n.toLocaleString("id-ID");
}

export async function StatsStrip() {
  const stats = await getStatsBeranda();
  if (stats.pelangganAktif === 0) return null;

  const items = [
    { nilai: angka(stats.pelangganAktif), label: "Pelanggan aktif terlayani" },
    {
      nilai: angka(stats.kelurahanTerlayani),
      label: "Kelurahan dalam cakupan",
    },
    {
      nilai: angka(stats.kecamatanTerlayani),
      label: "Kecamatan di Kota Bandung",
    },
    ...(stats.periodeTerakhir
      ? [
          {
            nilai: angka(stats.tagihanPeriodeTerakhir),
            label: `Rekening diterbitkan · ${formatPeriode(stats.periodeTerakhir)}`,
          },
        ]
      : []),
  ];

  return (
    <section
      aria-label="Statistik pelayanan"
      className="border-b border-border/70"
    >
      <dl className="mx-auto grid w-full max-w-6xl grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <div
            key={item.label}
            className={
              "flex flex-col gap-1 px-5 py-7 md:px-8 " +
              (i > 0 ? "border-l border-border/70 " : "") +
              (i >= 2 ? "max-lg:border-t max-lg:border-border/70 " : "") +
              (i === 2 ? "max-lg:border-l-0" : "")
            }
          >
            <dd className="order-1 font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl">
              {item.nilai}
            </dd>
            <dt className="order-2 text-[11px] font-medium tracking-wide text-muted-foreground">
              {item.label}
            </dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function StatsStripSkeleton() {
  return (
    <section aria-hidden="true" className="border-b border-border/70">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={
              "flex flex-col gap-2 px-5 py-7 md:px-8 " +
              (i > 0 ? "border-l border-border/70" : "")
            }
          >
            <div className="h-8 w-24 animate-pulse bg-muted" />
            <div className="h-3 w-32 animate-pulse bg-muted/70" />
          </div>
        ))}
      </div>
    </section>
  );
}
