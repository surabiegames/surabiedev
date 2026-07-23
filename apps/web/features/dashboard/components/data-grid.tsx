"use client"

// features/dashboard/components/data-grid.tsx — SATU-SATUNYA pembungkus
// AG Grid Community untuk seluruh tabel dashboard. Semua halaman memakai ini
// supaya tema, toolbar, dan perilaku pagination konsisten — jangan merender
// <AgGridReact> langsung di tempat lain.
//
// Model baris: INFINITE. Tabel terbesar (pelanggan/tagihan/pembacaan) berisi
// >22.000 baris — memuat semuanya ke browser berarti ~MB JSON per kunjungan.
// Infinite model meminta per blok 50 baris ke /api/v1 (yang paginasinya
// memang berbentuk page/pageSize, lihat server/lib/pagination.ts).
//
// SORTING: server-side. Kolom yang diberi `sortable: true` di colDef HARUS
// ada di whitelist `sortQuery([...])` endpoint-nya (colId/field = nama kolom
// Prisma) — grid mengirim sortBy/sortDir dan AG Grid otomatis meminta ulang
// blok saat urutan berubah. Kolom di luar whitelist biarkan tanpa sortable.
//
// EKSPOR EXCEL: menarik SELURUH baris (mengikuti pencarian/filter/sort yang
// sedang aktif) per blok 1000 lewat endpoint yang sama, lalu menulis .xlsx
// di browser — bukan mengekspor 50 baris yang kebetulan termuat.
import * as React from "react"
import { AgGridReact } from "ag-grid-react"
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type IDatasource,
  type GridApi,
  type ValueGetterParams,
  type ValueFormatterParams,
} from "ag-grid-community"
import { Columns3, FileSpreadsheet, Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { NativeSelect } from "@workspace/ui/components/native-select"
import { Spinner } from "@workspace/ui/components/spinner"
import { ambilList, ApiError } from "../lib/api-client"

ModuleRegistry.registerModules([AllCommunityModule])

/// Tema dipetakan ke token CSS proyek (bukan warna hardcode) — dark mode
/// ikut benar otomatis karena nilai var berubah saat class `dark` menempel.
const temaGrid = themeQuartz.withParams({
  accentColor: "var(--primary)",
  backgroundColor: "var(--card)",
  foregroundColor: "var(--foreground)",
  borderColor: "var(--border)",
  headerBackgroundColor: "color-mix(in srgb, var(--muted) 45%, transparent)",
  headerTextColor: "var(--muted-foreground)",
  headerFontWeight: 600,
  fontFamily: "inherit",
  fontSize: 13,
  headerFontSize: 11,
  borderRadius: 0,
  wrapperBorderRadius: 0,
  rowHoverColor: "color-mix(in srgb, var(--accent) 55%, transparent)",
  selectedRowBackgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
  browserColorScheme: "inherit",
})

export interface FilterSelect {
  /** Nama query param di endpoint, mis. "status". */
  param: string
  label: string
  opsi: { value: string; label: string }[]
}

const PAGE_SIZE = 50
const EKSPOR_BLOK = 1000
const EKSPOR_MAKS_BLOK = 100 // pagar keselamatan: maks 100rb baris per file

/** Nilai satu sel untuk ekspor: valueGetter/field, lalu valueFormatter —
 *  KECUALI kolom angka (cellClass tabular-nums): diekspor sebagai angka
 *  mentah supaya bisa di-SUM di Excel, bukan teks "Rp 173.540". */
function nilaiEkspor(c: ColDef, row: Record<string, unknown>): unknown {
  let v: unknown
  if (typeof c.valueGetter === "function") v = c.valueGetter({ data: row } as ValueGetterParams)
  else if (c.field) v = row[c.field]

  const kolomAngka = typeof c.cellClass === "string" && c.cellClass.includes("tabular-nums")
  if (typeof v === "number" && kolomAngka) return v
  if (typeof c.valueFormatter === "function") {
    return c.valueFormatter({ value: v, data: row } as ValueFormatterParams)
  }
  if (v === null || v === undefined) return ""
  if (typeof v === "object") return ""
  return v
}

export function DataGrid({
  judul,
  endpoint,
  columnDefs,
  searchParam,
  searchPlaceholder = "Cari…",
  initialSearch = "",
  filters = [],
  extraParams,
  tinggiClassName = "flex-1 min-h-96",
  onRowClicked,
  onRowContextMenu,
  idTerpilih,
  refreshKey,
}: {
  /** Micro-label strip header panel, mis. "Daftar Pelanggan". */
  judul: string
  /** Path list di bawah /api/v1, mis. "/pelanggan". */
  endpoint: string
  columnDefs: ColDef[]
  /** Nama param pencarian bila endpoint mendukung (biasanya "q"). Tanpa ini kotak cari disembunyikan. */
  searchParam?: string
  searchPlaceholder?: string
  initialSearch?: string
  filters?: FilterSelect[]
  /** Param tetap yang selalu ikut terkirim. */
  extraParams?: Record<string, string>
  tinggiClassName?: string
  /** Klik baris (pola master-detail, mis. halaman verifikasi). */
  onRowClicked?: (data: Record<string, unknown>) => void
  /** Klik kanan baris — pemicu menu aksi kontekstual (halaman verifikasi).
   *  Menyediakan koordinat viewport kursor; menu default browser ditekan. */
  onRowContextMenu?: (data: Record<string, unknown>, posisi: { x: number; y: number }) => void
  /** id baris yang sedang dipilih — disorot sinkron dengan panel detail. */
  idTerpilih?: string | null
  /** Naikkan nilainya untuk memaksa muat ulang data (setelah aksi verifikasi). */
  refreshKey?: number
}) {
  const apiRef = React.useRef<GridApi | null>(null)
  const [cari, setCari] = React.useState(initialSearch)
  const [filterNilai, setFilterNilai] = React.useState<Record<string, string>>({})
  const [total, setTotal] = React.useState<number | null>(null)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [mengekspor, setMengekspor] = React.useState(false)
  // Kolom yang disembunyikan pengguna lewat picker "Kolom" di toolbar —
  // kunci = colId/field/headerName. Ekspor Excel ikut menghormatinya
  // (yang diekspor = yang terlihat).
  const [kolomSembunyi, setKolomSembunyi] = React.useState<Set<string>>(new Set())

  const kunciKolom = (c: ColDef) => c.colId ?? c.field ?? c.headerName ?? ""
  const defsTampil = React.useMemo(
    () => columnDefs.map((c) => ({ ...c, hide: kolomSembunyi.has(kunciKolom(c)) })),
    [columnDefs, kolomSembunyi]
  )
  const kolomTampil = React.useMemo(
    () => columnDefs.filter((c) => c.headerName && !kolomSembunyi.has(kunciKolom(c))),
    [columnDefs, kolomSembunyi]
  )

  // Datasource membaca state lewat ref supaya identitasnya stabil — ganti
  // filter cukup purge cache, tidak membangun ulang grid. Ref disinkronkan
  // di effect (bukan saat render — dilarang react-hooks/refs).
  const paramsRef = React.useRef({ cari: initialSearch, filterNilai: {} as Record<string, string> })
  // extraParams ikut lewat ref (bukan closure datasource) supaya parent bisa
  // menggantinya (mis. dropdown periode) tanpa membangun ulang grid — cukup
  // purge, blok diminta ulang dengan nilai terbaru.
  const extraRef = React.useRef(extraParams)
  const extraSerial = JSON.stringify(extraParams ?? {})
  const idTerpilihRef = React.useRef<string | null | undefined>(idTerpilih)
  // Sort terakhir yang dipakai grid — diikutkan saat ekspor supaya urutan
  // file Excel sama dengan yang terlihat di layar.
  const sortRef = React.useRef<{ sortBy?: string; sortDir?: string }>({})

  const datasource = React.useMemo<IDatasource>(
    () => ({
      getRows: async (params) => {
        const { cari, filterNilai } = paramsRef.current
        const sm = params.sortModel?.[0]
        sortRef.current = sm ? { sortBy: sm.colId, sortDir: sm.sort } : {}
        try {
          setGalat(null)
          const { rows, total } = await ambilList<Record<string, unknown>>(endpoint, {
            page: Math.floor(params.startRow / PAGE_SIZE) + 1,
            pageSize: PAGE_SIZE,
            ...(searchParam && cari.trim() ? { [searchParam]: cari.trim() } : {}),
            ...filterNilai,
            ...sortRef.current,
            ...extraRef.current,
          })
          setTotal(total)
          params.successCallback(rows, total)
        } catch (err) {
          setGalat(err instanceof ApiError ? err.message : "Gagal memuat data.")
          params.failCallback()
        }
      },
    }),
    [endpoint, searchParam]
  )

  // Sinkronkan ref lalu purge cache (debounce): purge membuang seluruh blok
  // dan meminta ulang dari page 1 dengan param terbaru. Berlaku untuk kotak
  // cari, dropdown filter, extraParams dari parent, dan refreshKey (pemicu
  // muat ulang setelah aksi mutasi di halaman verifikasi).
  const pertama = React.useRef(true)
  React.useEffect(() => {
    paramsRef.current = { cari, filterNilai }
    extraRef.current = extraParams
    if (pertama.current) {
      pertama.current = false
      return
    }
    const t = setTimeout(() => apiRef.current?.purgeInfiniteCache(), 350)
    return () => clearTimeout(t)
    // extraSerial mewakili isi extraParams di deps (identitas objeknya
    // berubah tiap render parent — pakai objeknya langsung akan purge
    // terus-menerus, karena itu extraParams sengaja tidak masuk deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cari, filterNilai, extraSerial, refreshKey])

  // Sorot baris terpilih: nilai dibaca getRowClass lewat ref, redraw saat
  // pilihan berubah (infinite model tidak merender ulang sendiri).
  React.useEffect(() => {
    idTerpilihRef.current = idTerpilih
    apiRef.current?.redrawRows()
  }, [idTerpilih])

  function gantiFilter(param: string, value: string) {
    setFilterNilai((lama) => ({ ...lama, [param]: value }))
  }

  async function eksporExcel() {
    if (mengekspor) return
    setMengekspor(true)
    setGalat(null)
    try {
      const { cari, filterNilai } = paramsRef.current
      const paramsUmum = {
        ...(searchParam && cari.trim() ? { [searchParam]: cari.trim() } : {}),
        ...filterNilai,
        ...sortRef.current,
        ...extraParams,
      }

      const semua: Record<string, unknown>[] = []
      for (let page = 1; page <= EKSPOR_MAKS_BLOK; page++) {
        const { rows, total } = await ambilList<Record<string, unknown>>(endpoint, {
          page,
          pageSize: EKSPOR_BLOK,
          ...paramsUmum,
        })
        semua.push(...rows)
        if (semua.length >= total || rows.length === 0) break
      }

      const data = semua.map((row) => {
        const o: Record<string, unknown> = {}
        for (const c of kolomTampil) o[c.headerName!] = nilaiEkspor(c, row)
        return o
      })

      // Import dinamis: xlsx (~400 kB) hanya diunduh saat tombol dipakai,
      // bukan membebani setiap kunjungan halaman.
      const XLSX = await import("xlsx")
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Data")
      const slug = judul.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      XLSX.writeFile(wb, `${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      setGalat(err instanceof ApiError ? err.message : "Gagal mengekspor data.")
    } finally {
      setMengekspor(false)
    }
  }

  return (
    // flex h-full flex-col: SEBELUMNYA section ini block biasa tanpa
    // tinggi apa pun, sehingga tinggiClassName="h-full" di grid wrapper
    // di bawah jadi referensi melingkar (section menunggu tinggi grid,
    // grid menunggu tinggi section) dan resolve ke 0 — AG Grid dapat
    // instruksi tinggi 0px, baris tidak pernah dirender. Sekarang section
    // mewarisi tinggi pasti dari parent-nya, toolbar di atas `shrink-0`,
    // dan grid wrapper `flex-1 min-h-0` benar-benar mengisi sisanya.
    <section className="flex h-full flex-col border border-border/70 bg-card">
      {/* Toolbar dua baris: baris 1 = identitas tabel + aksi (Kolom,
          Ekspor); baris 2 = pencarian + filter. Dipisah supaya deret filter
          panjang tidak berdesakan dengan tombol aksi di layar sempit. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/70 px-4 py-2">
        <h2 className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{judul}</h2>
        {total !== null && (
          <span className="border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {total.toLocaleString("id-ID")} baris
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                title="Pilih kolom yang ditampilkan"
              >
                <Columns3 className="size-3.5" />
                Kolom
                {kolomSembunyi.size > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    ({columnDefs.filter((c) => c.headerName).length - kolomSembunyi.size})
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
              <DropdownMenuLabel className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                Kolom tampil
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columnDefs
                .filter((c) => c.headerName)
                .map((c) => {
                  const kunci = kunciKolom(c)
                  return (
                    <DropdownMenuCheckboxItem
                      key={kunci}
                      checked={!kolomSembunyi.has(kunci)}
                      // preventDefault: menu tetap terbuka agar bisa
                      // mencentang beberapa kolom sekaligus.
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(tampil) =>
                        setKolomSembunyi((lama) => {
                          const baru = new Set(lama)
                          if (tampil) baru.delete(kunci)
                          else baru.add(kunci)
                          return baru
                        })
                      }
                    >
                      {c.headerName}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={eksporExcel}
            disabled={mengekspor || total === 0}
            title="Unduh seluruh baris (sesuai filter & kolom aktif) sebagai file Excel"
          >
            {mengekspor ? <Spinner className="size-3.5" /> : <FileSpreadsheet className="size-3.5" />}
            {mengekspor ? "Menyiapkan…" : "Ekspor"}
          </Button>
        </div>
      </div>

      {(searchParam || filters.length > 0) && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border/70 bg-muted/20 px-4 py-1.5">
          {searchParam && (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-7 w-56 pl-8 text-xs"
                aria-label="Cari"
              />
            </div>
          )}
          {filters.map((f) => (
            <NativeSelect
              key={f.param}
              aria-label={f.label}
              value={filterNilai[f.param] ?? ""}
              onChange={(e) => gantiFilter(f.param, e.currentTarget.value)}
              className="h-7 w-auto min-w-28 text-xs"
            >
              <option value="">{f.label}: semua</option>
              {f.opsi.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          ))}
        </div>
      )}

      {galat && (
        <p className="shrink-0 border-b border-border/70 bg-destructive/10 px-4 py-2 text-xs text-destructive">{galat}</p>
      )}

      <div
        className={
          // min-h-0: WAJIB di flex child yang isinya butuh discroll —
          // tanpa ini, flex-1 tidak akan pernah mengecil di bawah tinggi
          // konten instrinsiknya (AG Grid), section jadi ikut membengkak.
          "min-h-0 scrollbar-tipis " +
          // Header kolom bergaya micro-label seperti panel lain di sistem ini.
          "[&_.ag-header-cell-text]:text-[10px] [&_.ag-header-cell-text]:font-semibold [&_.ag-header-cell-text]:tracking-widest [&_.ag-header-cell-text]:uppercase " +
          // Baris terpilih (master-detail): aksen kiri + latar primary tipis,
          // grammar yang sama dengan menu aktif di sidebar.
          "[&_.baris-terpilih]:bg-primary/10 [&_.baris-terpilih]:shadow-[inset_2px_0_0_0_var(--primary)] " +
          (onRowClicked ? "[&_.ag-row]:cursor-pointer " : "") +
          tinggiClassName
        }
      >
        <AgGridReact
          theme={temaGrid}
          columnDefs={defsTampil}
          defaultColDef={{ sortable: false, resizable: true, flex: 1, minWidth: 110 }}
          rowModelType="infinite"
          cacheBlockSize={PAGE_SIZE}
          maxBlocksInCache={10}
          datasource={datasource}
          onGridReady={(e) => {
            apiRef.current = e.api
          }}
          onRowClicked={onRowClicked ? (e) => e.data && onRowClicked(e.data as Record<string, unknown>) : undefined}
          onCellContextMenu={
            onRowContextMenu
              ? (e) => {
                  const ev = e.event as MouseEvent | null | undefined
                  if (e.data && ev) onRowContextMenu(e.data as Record<string, unknown>, { x: ev.clientX, y: ev.clientY })
                }
              : undefined
          }
          preventDefaultOnContextMenu={!!onRowContextMenu}
          getRowClass={(p) => ((p.data as { id?: string } | undefined)?.id === idTerpilihRef.current ? "baris-terpilih" : undefined)}
          overlayNoRowsTemplate='<span style="color: var(--muted-foreground); font-size: 13px">Tidak ada data untuk ditampilkan.</span>'
          suppressCellFocus
        />
      </div>
    </section>
  )
}