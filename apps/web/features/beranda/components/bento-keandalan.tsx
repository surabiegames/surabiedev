// features/beranda/components/bento-keandalan.tsx — grid bento "di balik
// layar". Setiap sel menceritakan mekanisme yang BENAR-BENAR ada di sistem
// ini (verifikasi laporan, penyamaran alamat, penamaan arsip foto, PostGIS,
// jadwal giliran) — bukan klaim pemasaran kosong. Kalau menambah sel, pakai
// aturan yang sama: hanya tulis yang bisa ditunjuk kodenya.
import { ShieldCheck, MapPinned, Timer, FileCheck2, EyeOff } from "lucide-react"

function SelJudul({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold tracking-tight text-foreground">{children}</h3>
}

function SelTeks({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
}

export function BentoKeandalan() {
  return (
    <section aria-labelledby="bento-judul" className="border-b border-border/70">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">Di balik layar</p>
          <h2 id="bento-judul" className="mt-3 text-3xl font-semibold tracking-tight text-balance text-foreground">
            Setiap angka melewati tangan petugas sebelum menjadi tagihan.
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-6">
          {/* Sel besar: alur verifikasi — jantung sistemnya. */}
          <div className="border border-border/70 bg-card p-6 md:col-span-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="size-4.5 text-primary" aria-hidden="true" />
              <SelJudul>Laporan warga tidak langsung mengubah tagihan</SelJudul>
            </div>
            <SelTeks>
              Angka meter yang Anda kirim berstatus <span className="font-medium text-foreground">menunggu</span> sampai
              petugas memeriksa foto buktinya. Baru setelah lolos verifikasi, angka itu menjadi pencatatan resmi dan
              dihitung sebagai tagihan — laporan keliru atau iseng berhenti di meja petugas.
            </SelTeks>
            <ol aria-hidden="true" className="mt-6 flex flex-wrap items-center gap-y-3">
              {["Laporan masuk", "Menunggu", "Diverifikasi petugas", "Pencatatan resmi", "Tagihan"].map((t, i, arr) => (
                <li key={t} className="flex items-center">
                  <span
                    className={
                      "border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wide uppercase " +
                      (i === 2
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-muted/40 text-muted-foreground")
                    }
                  >
                    {t}
                  </span>
                  {i < arr.length - 1 && <span className="mx-1.5 h-px w-3 bg-border sm:w-5" />}
                </li>
              ))}
            </ol>
          </div>

          {/* Arsip foto tertata. */}
          <div className="border border-border/70 bg-card p-6 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <FileCheck2 className="size-4.5 text-primary" aria-hidden="true" />
              <SelJudul>Bukti foto terarsip rapi</SelJudul>
            </div>
            <SelTeks>
              Isi berkas diperiksa server (bukan sekadar nama filenya), lalu disimpan dengan penamaan baku per periode
              sehingga selalu bisa ditelusuri ulang:
            </SelTeks>
            <p className="mt-4 border border-border bg-muted/40 px-3 py-2 font-mono text-[11px] break-all text-muted-foreground">
              202607_stand_00401700010.jpg
            </p>
          </div>

          {/* Privasi. */}
          <div className="border border-border/70 bg-card p-6 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <EyeOff className="size-4.5 text-primary" aria-hidden="true" />
              <SelJudul>Data seperlunya saja</SelJudul>
            </div>
            <SelTeks>
              Halaman publik hanya menampilkan yang perlu Anda lihat: alamat disamarkan sebagian, dan setiap permintaan
              dibatasi lajunya untuk menghalangi pengambilan data massal.
            </SelTeks>
            <p aria-hidden="true" className="mt-4 font-mono text-sm text-muted-foreground">
              ASMI NO.<span className="text-foreground">************</span>
            </p>
          </div>

          {/* Peta / GIS. */}
          <div className="border border-border/70 bg-card p-6 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <MapPinned className="size-4.5 text-primary" aria-hidden="true" />
              <SelJudul>Berbasis peta sungguhan</SelJudul>
            </div>
            <SelTeks>
              Setiap sambungan, batas kelurahan, dan lokasi pengaduan tersimpan sebagai koordinat geografis — laporan
              kebocoran Anda tiba di petugas lengkap dengan titik kejadiannya.
            </SelTeks>
          </div>

          {/* Giliran air. */}
          <div className="border border-border/70 bg-card p-6 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <Timer className="size-4.5 text-primary" aria-hidden="true" />
              <SelJudul>Jadwal giliran tercatat</SelJudul>
            </div>
            <SelTeks>
              Sambungan dengan pasokan bergilir dicatat jam alirnya per hari, sehingga petugas membedakan
              &ldquo;gangguan&rdquo; dari &ldquo;memang belum jadwalnya&rdquo; saat menangani laporan Anda.
            </SelTeks>
            <div aria-hidden="true" className="mt-4 flex gap-2">
              <span className="border border-border bg-muted/40 px-2.5 py-1 font-mono text-[10px] font-semibold text-muted-foreground uppercase">
                Penuh · 24 jam
              </span>
              <span className="border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-primary uppercase">
                Bergilir · 04.00–09.00
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
