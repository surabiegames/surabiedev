// features/publik/components/halaman-publik.tsx — kerangka editorial bersama
// halaman layanan publik, meminjam bahasa visual beranda (features/beranda):
// pita judul ber-garis penuh, eyebrow uppercase, rel kiri lengket untuk
// konteks, dan "kartu berbingkai" bergaya vinyet hero untuk area fungsional.
//
// Server component murni presentasional — boleh diimpor komponen client
// (ikut jadi bundle client di sana, dan itu tidak apa-apa).
import { cn } from "@workspace/ui/lib/utils"

/** Pita judul + grid konten. `aside` tampil di rel kiri pada desktop dan
 *  PINDAH KE BAWAH form di layar kecil — warga datang untuk menyelesaikan
 *  urusan, bukan membaca panduan dulu. */
export function HalamanPublik({
  eyebrow,
  judul,
  lede,
  aside,
  children,
}: {
  eyebrow: string
  judul: string
  lede: string
  aside: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <>
      <section className="border-b border-border/70">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 lg:py-14">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">{eyebrow}</p>
          <h1 className="mt-3 max-w-2xl text-3xl leading-[1.1] font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            {judul}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">{lede}</p>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-5 py-10 md:px-8 lg:grid-cols-12 lg:gap-8 lg:py-14">
        {/* Konten (form) DULU di DOM — di layar kecil warga langsung ketemu
            formnya; `lg:order-first` memindahkan aside ke rel kiri hanya di
            desktop. */}
        <div className="lg:col-span-7 lg:col-start-6">{children}</div>
        <aside className="lg:order-first lg:col-span-4 lg:col-start-1 lg:row-start-1">
          <div className="flex flex-col gap-8 lg:sticky lg:top-24">{aside}</div>
        </aside>
      </div>
    </>
  )
}

/** Blok kecil di rel kiri: micro-label uppercase + isi. */
export function AsideBlok({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">{label}</h2>
      <div className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  )
}

/** Linimasa langkah bernomor — grammar yang sama dengan vinyet pengaduan
 *  di beranda. */
export function LangkahList({ langkah }: { langkah: readonly { judul: string; detail: string }[] }) {
  return (
    <ol className="space-y-0">
      {langkah.map((l, i, arr) => (
        <li key={l.judul} className="relative flex gap-4 pb-6 last:pb-0">
          {i < arr.length - 1 && <span aria-hidden="true" className="absolute top-7 left-[11px] h-full w-px bg-border" />}
          <span className="flex size-6 shrink-0 items-center justify-center border border-border bg-card font-mono text-[11px] font-bold text-foreground">
            {i + 1}
          </span>
          <span className="flex flex-col gap-0.5 pt-0.5">
            <span className="text-sm font-medium text-foreground">{l.judul}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">{l.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Kartu fungsional berbingkai ganda — tanda tangan visual beranda (bingkai
 *  offset di belakang kartu). Pakai HANYA pada satu kartu utama per halaman
 *  supaya tetap terasa istimewa. */
export function KartuBerbingkai({
  label,
  chip,
  className,
  children,
}: {
  label?: string
  chip?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute -inset-3 hidden border border-border/50 sm:block md:-inset-4" />
      <div className="relative border border-border bg-card shadow-[0_1px_0_rgb(0,0,0,0.03),0_16px_40px_-24px_rgb(0,0,0,0.25)]">
        {label && (
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
            <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{label}</span>
            {chip && (
              <span className="border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-primary uppercase">
                {chip}
              </span>
            )}
          </div>
        )}
        <div className={cn("p-5", className)}>{children}</div>
      </div>
    </div>
  )
}
