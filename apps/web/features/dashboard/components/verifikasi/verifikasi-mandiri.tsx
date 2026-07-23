"use client";

// features/dashboard/components/verifikasi/verifikasi-mandiri.tsx —
// halaman verifikasi laporan meter mandiri pelanggan (master-detail),
// kembaran verifikasi-lapangan untuk sumber data /laporan-mandiri.
// Laporan mandiri tetap satu ring (bukan V1–V3): verify langsung membuat
// pembacaan resmi. SELURUH AKSI lewat MENU KLIK KANAN pada baris; panel
// kiri murni penampil. Kolom "Masuk"/"Status" sengaja tidak ada (permintaan
// pengguna) — status tetap tersaring lewat toolbar dan terbaca di panel.
import * as React from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { Eye, ImageIcon, RotateCcw, ShieldCheck, Undo2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Spinner } from "@workspace/ui/components/spinner";
import { formatPeriode } from "@/features/public/lib/format";
import { ambilSatu, kirimJson, ApiError } from "../../lib/api-client";
import { LABEL_STATUS_LAPORAN_MANDIRI } from "../../lib/label";
import { DataGrid } from "../data-grid";
import {
  fmtPeriodeInt,
  fmtAngka,
  KELAS_ANGKA,
  KELAS_MONO,
} from "../grids/sel";
import type { StatsVerifikasi } from "./tipe";
import { RingkasanVerifikasi, PilihPeriode } from "./ringkasan-verifikasi";
import { PanelMandiri, type AksiMandiri } from "./panel-mandiri";
import { MenuKonteks, type AksiKonteks } from "./menu-konteks";

function SelFoto(p: ICellRendererParams) {
  const url = p.value as string | null | undefined;
  if (!url) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
      <ImageIcon className="size-3.5" /> 1 foto
    </span>
  );
}

type BarisMandiri = {
  id?: string;
  nomorLangganan?: string;
  status?: "MENUNGGU" | "DIVERIFIKASI" | "DITOLAK" | "DIGUNAKAN";
  pelanggan?: { nama?: string } | null;
};

const KOLOM: ColDef[] = [
  {
    field: "nomorLangganan",
    headerName: "No. Langganan",
    minWidth: 135,
    maxWidth: 150,
    cellClass: KELAS_MONO,
    sortable: true,
  },
  {
    headerName: "Pelanggan",
    minWidth: 150,
    flex: 2,
    valueGetter: (p) => p.data?.pelanggan?.nama ?? "—",
  },
  {
    field: "periode",
    headerName: "Periode",
    minWidth: 105,
    sortable: true,
    valueFormatter: fmtPeriodeInt,
  },
  {
    field: "standDilaporkan",
    headerName: "Stand (m³)",
    minWidth: 100,
    sortable: true,
    cellClass: KELAS_ANGKA,
    valueFormatter: fmtAngka,
  },
  {
    field: "namaPelapor",
    headerName: "Pelapor",
    minWidth: 125,
    sortable: true,
  },
  {
    field: "fotoUrl",
    headerName: "Lampiran",
    minWidth: 95,
    cellRenderer: SelFoto,
  },
];

export function VerifikasiMandiri({ bisaAksi }: { bisaAksi: boolean }) {
  // undefined = belum init; diisi periode terbaru yang punya data.
  const [periode, setPeriode] = React.useState<number | null | undefined>(
    undefined,
  );
  const [stats, setStats] = React.useState<StatsVerifikasi | null>(null);
  const [galatStats, setGalatStats] = React.useState<string | null>(null);
  const [idTerpilih, setIdTerpilih] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [menu, setMenu] = React.useState<{
    posisi: { x: number; y: number };
    baris: BarisMandiri;
  } | null>(null);
  const [aksi, setAksi] = React.useState<AksiMandiri | null>(null);
  const [konfirmasi, setKonfirmasi] = React.useState<{
    id: string;
    judul: string;
    deskripsi: string;
  } | null>(null);
  const [mengirim, setMengirim] = React.useState(false);
  const [galatAksi, setGalatAksi] = React.useState<string | null>(null);

  React.useEffect(() => {
    let batal = false;
    ambilSatu<StatsVerifikasi>("/laporan-mandiri/stats", {
      periode: periode ?? undefined,
    })
      .then((s) => {
        if (batal) return;
        setStats(s);
        setGalatStats(null);
        setPeriode((lama) =>
          lama === undefined ? (s.periodes[0] ?? null) : lama,
        );
      })
      .catch((err) => {
        if (!batal)
          setGalatStats(
            err instanceof ApiError ? err.message : "Gagal memuat ringkasan.",
          );
      });
    return () => {
      batal = true;
    };
  }, [periode, refreshKey]);

  async function jalankanUnverify() {
    if (!konfirmasi) return;
    setMengirim(true);
    setGalatAksi(null);
    try {
      await kirimJson(`/laporan-mandiri/${konfirmasi.id}/unverify`, "PATCH", {});
      setKonfirmasi(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setGalatAksi(
        err instanceof ApiError ? err.message : "Aksi gagal dijalankan.",
      );
    } finally {
      setMengirim(false);
    }
  }

  function aksiMenu(baris: BarisMandiri): AksiKonteks[] {
    const id = baris.id;
    if (!id) return [];
    const nama = baris.pelanggan?.nama ?? baris.nomorLangganan ?? "";
    const daftar: AksiKonteks[] = [
      {
        label: "Lihat detail",
        icon: Eye,
        onPilih: () => setMenu(null),
        keterangan: "Detail sudah tampil di panel kiri",
      },
    ];

    if (baris.status === "MENUNGGU") {
      daftar.push(
        {
          label: "Verifikasi / koreksi stand…",
          icon: ShieldCheck,
          pemisah: true,
          disabled: !bisaAksi,
          keterangan: bisaAksi
            ? "Periksa foto, koreksi bila salah input, lalu jadikan resmi"
            : "Akun Anda tidak punya akses verifikasi",
          onPilih: () => {
            setMenu(null);
            setAksi("verify");
          },
        },
        {
          label: "Tolak / minta foto ulang…",
          icon: RotateCcw,
          disabled: !bisaAksi,
          keterangan: bisaAksi ? undefined : "Akun Anda tidak punya akses verifikasi",
          onPilih: () => {
            setMenu(null);
            setAksi("tolak");
          },
        },
      );
    }

    if (baris.status === "DIVERIFIKASI" || baris.status === "DIGUNAKAN") {
      daftar.push({
        label: "Batalkan verifikasi",
        icon: Undo2,
        pemisah: true,
        destruktif: true,
        disabled: !bisaAksi,
        keterangan: bisaAksi
          ? "Pembacaan resmi dihapus; ditolak bila sudah dipakai tagihan"
          : "Akun Anda tidak punya akses verifikasi",
        onPilih: () => {
          setMenu(null);
          setGalatAksi(null);
          setKonfirmasi({
            id,
            judul: "Batalkan verifikasi?",
            deskripsi: `Laporan ${nama} kembali ke status menunggu; PembacaanMeter resmi yang terbentuk ikut dihapus. Server menolak bila pembacaan sudah dipakai tagihan.`,
          });
        },
      });
    }
    if (baris.status === "DITOLAK") {
      daftar.push({
        label: "Kembalikan ke antrean (batalkan tolak)",
        icon: Undo2,
        pemisah: true,
        disabled: !bisaAksi,
        keterangan: bisaAksi ? undefined : "Akun Anda tidak punya akses verifikasi",
        onPilih: () => {
          setMenu(null);
          setGalatAksi(null);
          setKonfirmasi({
            id,
            judul: "Batalkan penolakan?",
            deskripsi: `Alasan penolakan dihapus dan laporan ${nama} kembali ke antrean menunggu verifikasi.`,
          });
        },
      });
    }

    return daftar;
  }

  return (
    // Struktur kembar verifikasi-lapangan: rantai tinggi h-full (layout.tsx
    // sudah mengunci SidebarInset h-dvh overflow-hidden → div konten min-h-0
    // flex-1), panel kiri kolom mandiri yang menggulir sendiri, kolom kanan
    // = header periode + ringkasan (shrink-0) + tabel (flex-1 min-h-0).
    <div className="flex h-full min-h-0 flex-col items-stretch gap-4 lg:flex-row">
      <aside className="scrollbar-tipis flex h-full min-h-0 w-full shrink-0 flex-col overflow-y-auto border border-border/70 bg-card lg:w-80">
        <div className="sticky top-0 z-10 shrink-0 border-b border-border/70 bg-card px-4 py-2.5">
          <h2 className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Detail Laporan
          </h2>
        </div>
        {/* key: ganti baris = remount panel, seluruh state form mulai
            bersih tanpa reset sinkron di effect. */}
        <PanelMandiri
          key={idTerpilih ?? "kosong"}
          id={idTerpilih}
          aksi={aksi}
          onTutupAksi={() => setAksi(null)}
          onSelesai={() => setRefreshKey((k) => k + 1)}
        />
      </aside>

      <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {periode ? `Periode ${formatPeriode(periode)}` : "Semua periode"}
          </p>
          <PilihPeriode
            periodes={stats?.periodes ?? []}
            nilai={periode ?? null}
            onGanti={setPeriode}
          />
        </div>

        {galatStats && (
          <p className="shrink-0 text-xs text-destructive">{galatStats}</p>
        )}
        <div className="shrink-0">
          <RingkasanVerifikasi stats={stats} />
        </div>

        <div className="min-h-0 min-w-0 flex-1">
          <DataGrid
            judul="Laporan Meter Mandiri"
            endpoint="/laporan-mandiri"
            columnDefs={KOLOM}
            searchParam="q"
            searchPlaceholder="Cari no. langganan / nama…"
            filters={[
              {
                param: "status",
                label: "Status",
                opsi: Object.entries(LABEL_STATUS_LAPORAN_MANDIRI).map(
                  ([value, label]) => ({ value, label }),
                ),
              },
            ]}
            extraParams={periode ? { periode: String(periode) } : undefined}
            onRowClicked={(d) =>
              setIdTerpilih((d as { id?: string }).id ?? null)
            }
            onRowContextMenu={(d, posisi) => {
              const baris = d as BarisMandiri;
              setIdTerpilih(baris.id ?? null);
              setAksi(null);
              setMenu({ posisi, baris });
            }}
            idTerpilih={idTerpilih}
            refreshKey={refreshKey}
            tinggiClassName="scrollbar-tipis flex-1 min-h-96"
          />
        </div>
      </div>

      {menu && (
        <MenuKonteks
          posisi={menu.posisi}
          judul={`${menu.baris.nomorLangganan ?? ""} · ${menu.baris.pelanggan?.nama ?? ""}`}
          aksi={aksiMenu(menu.baris)}
          onTutup={() => setMenu(null)}
        />
      )}

      <AlertDialog
        open={konfirmasi !== null}
        onOpenChange={(buka) => {
          if (!buka && !mengirim) setKonfirmasi(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{konfirmasi?.judul}</AlertDialogTitle>
            <AlertDialogDescription>
              {konfirmasi?.deskripsi}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {galatAksi && <p className="text-xs text-destructive">{galatAksi}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mengirim}>Batal</AlertDialogCancel>
            {/* onClick tanpa auto-close: dialog baru ditutup setelah server
                menjawab sukses; galat tampil di dalam dialog. */}
            <AlertDialogAction
              disabled={mengirim}
              onClick={(e) => {
                e.preventDefault();
                void jalankanUnverify();
              }}
            >
              {mengirim && <Spinner className="size-3.5" />}
              Ya, lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
