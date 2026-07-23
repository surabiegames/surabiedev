// features/beranda/components/hero.tsx — pembuka editorial: tipografi kiri,
// vinyet "rekening hidup" kanan. Vinyet dibangun dari elemen UI asli sistem
// (badge status, angka mono, sparkline batang) — bukan screenshot dashboard
// generik — dan disembunyikan di layar kecil karena fokus fungsional mobile
// adalah form cek cepat, bukan dekorasi.
import Link from "next/link"
import { BadgeCheck, ArrowUpRight } from "lucide-react"
import { CekCepatForm } from "./cek-cepat-form"

/// Tinggi batang sparkline vinyet (persen) — bentuknya saja yang penting,
/// angkanya tidak diklaim sebagai data siapa pun.
const BATANG = [42, 55, 38, 60, 48, 72]

export function Hero() {
  return (
    <section aria-labelledby="hero-judul" className="border-b border-border/70">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-5 pt-16 pb-14 md:px-8 lg:grid-cols-12 lg:gap-8 lg:pt-24 lg:pb-20">
        <div className="flex flex-col justify-center lg:col-span-7">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
            Layanan Digital Pelanggan
          </p>
          <h1
            id="hero-judul"
            className="mt-4 text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-foreground sm:text-5xl lg:text-6xl"
          >
            Urusan air rumah Anda,
            <br />
            <span className="text-muted-foreground">selesai dari genggaman.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground">
            Cek tagihan, laporkan angka meter dengan foto bukti, dan sampaikan gangguan air —
            tanpa antre, tanpa akun. Setiap laporan diverifikasi petugas PERUMDA Tirtawening
            sebelum memengaruhi tagihan Anda.
          </p>

          <div className="mt-8">
            <CekCepatForm />
            <p className="mt-2.5 text-xs text-muted-foreground">
              Gratis, langsung, tanpa mendaftar. Nomor langganan tertera di rekening air Anda.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              href="/lapor-meter"
              className="group inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              Lapor angka meter
              <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              href="/pengaduan"
              className="group inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              Laporkan gangguan air
              <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>

        {/* Vinyet rekening — dekoratif, disembunyikan dari pembaca layar. */}
        <div aria-hidden="true" className="relative hidden items-center lg:col-span-5 lg:flex">
          <div className="relative w-full">
            <div className="absolute -inset-6 border border-border/50" />
            <div className="relative border border-border bg-card shadow-[0_1px_0_rgb(0,0,0,0.03),0_16px_40px_-24px_rgb(0,0,0,0.25)]">
              <div className="flex items-start justify-between border-b border-border/70 px-5 py-4">
                <div>
                  <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                    No. Pelanggan
                  </p>
                  <p className="mt-1 font-mono text-base font-bold text-foreground">004•••••010</p>
                </div>
                <span className="inline-flex items-center gap-1.5 border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-foreground">
                  <span className="size-1.5 bg-emerald-500" />
                  Lunas
                </span>
              </div>

              <div className="grid grid-cols-2 gap-px border-b border-border/70 bg-border/50">
                <div className="bg-card px-5 py-4">
                  <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Periode</p>
                  <p className="mt-1 text-sm font-medium text-foreground">Mei 2026</p>
                </div>
                <div className="bg-card px-5 py-4">
                  <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Pemakaian</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                    23 <span className="font-sans font-normal text-muted-foreground">m³</span>
                  </p>
                </div>
              </div>

              <div className="px-5 py-4">
                <div className="flex items-end justify-between">
                  <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                    Konsumsi 6 bulan
                  </p>
                  <div className="flex h-12 items-end gap-1.5">
                    {BATANG.map((t, i) => (
                      <div
                        key={i}
                        style={{ height: `${t}%` }}
                        className={i === BATANG.length - 1 ? "w-3 bg-primary" : "w-3 bg-muted-foreground/25"}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-dashed border-border/70 pt-4">
                  <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                    Total Tagihan
                  </p>
                  <p className="font-mono text-2xl font-bold tracking-tight text-foreground">Rp 173.540</p>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-5 -left-5 flex items-center gap-2 border border-border bg-background px-3 py-2 shadow-sm">
              <BadgeCheck className="size-4 text-primary" />
              <span className="text-xs font-medium text-foreground">Diverifikasi petugas</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
