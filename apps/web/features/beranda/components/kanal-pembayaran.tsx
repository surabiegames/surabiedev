// features/beranda/components/kanal-pembayaran.tsx — strip kepercayaan.
//
// Menggantikan trope "logo ticker" dengan sesuatu yang jujur: kanal
// pembayaran yang memang dimodelkan sistem ini (enum KanalPembayaran +
// contoh penyelenggara di prisma/tagihan.prisma) — tanpa logo pihak ketiga
// yang belum tentu boleh dipakai. Di layar kecil menggulir horizontal,
// bukan menumpuk ke bawah.
import { Landmark, Store, QrCode, Building2, RefreshCw, Wallet } from "lucide-react"

const KANAL = [
  { icon: Landmark, label: "Teller Kantor", detail: "Loket pelayanan" },
  { icon: QrCode, label: "QRIS", detail: "Semua aplikasi pembayaran" },
  { icon: Building2, label: "Virtual Account", detail: "Transfer bank" },
  { icon: Store, label: "Minimarket", detail: "Jaringan PPOB" },
  { icon: Wallet, label: "PPOB Bank", detail: "Kanal perbankan" },
  { icon: RefreshCw, label: "Autodebet", detail: "Potong otomatis" },
] as const

export function KanalPembayaran() {
  return (
    <section aria-labelledby="kanal-judul" className="border-b border-border/70">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8">
        <h2 id="kanal-judul" className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Bayar lewat kanal yang sudah Anda kenal
        </h2>
        <ul className="mt-5 flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {KANAL.map(({ icon: Icon, label, detail }) => (
            <li
              key={label}
              className="flex shrink-0 snap-start items-center gap-3 border border-border/70 bg-card px-4 py-3 transition-colors hover:border-foreground/25"
            >
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-medium whitespace-nowrap text-foreground">{label}</span>
                <span className="text-[11px] whitespace-nowrap text-muted-foreground">{detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
