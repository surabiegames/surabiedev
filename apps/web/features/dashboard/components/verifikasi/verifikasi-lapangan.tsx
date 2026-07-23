"use client";

// features/dashboard/components/verifikasi/verifikasi-lapangan.tsx —
// halaman verifikasi laporan petugas lapangan (master-detail): kartu
// ringkasan + tabel laporan (kanan, kolom mengikuti tabel.md di folder ini)
// + panel detail murni penampil (kiri).
//
// SELURUH AKSI lewat MENU KLIK KANAN pada baris: Verifikasi V1 (modal
// periksa/koreksi), Validasi V2 dan Approve final V3 (dialog konfirmasi),
// Cek ulang (modal alasan), dan Batalkan tahap terakhir (unverify).
// Pembacaan resmi baru dibuat saat V3 — lihat laporan-harian.router.ts.
import * as React from "react";
import type {
  ColDef,
  ICellRendererParams,
  ValueFormatterParams,
} from "ag-grid-community";
import {
  Check,
  CheckCheck,
  Eye,
  FileCheck2,
  RotateCcw,
  ShieldCheck,
  Undo2,
} from "lucide-react";
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
import { ambilSatu, ambilList, kirimJson, ApiError } from "../../lib/api-client";
import { LABEL_KONDISI_CATAT } from "../../lib/label";
import { DataGrid } from "../data-grid";
import {
  fmtLabel,
  fmtTanggal,
  fmtAngka,
  KELAS_ANGKA,
  KELAS_MONO,
} from "../grids/sel";
import type { StatsVerifikasi, RingLaporanHarian } from "./tipe";
import { tahapLaporanHarian, ringVerif } from "./tipe";
import { RingkasanVerifikasi, PilihPeriode } from "./ringkasan-verifikasi";
import { PanelLapangan, type AksiLapangan } from "./panel-lapangan";
import { MenuKonteks, type AksiKonteks } from "./menu-konteks";

// Cermin ROLE_GROUPS (server/middleware/rbac.ts — tidak bisa diimpor ke
// client tanpa menyeret rantai server-only). Server tetap penjaga aslinya;
// ini hanya menentukan item menu mana yang aktif.
const SUPERVISOR_UP = new Set(["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER", "MANAGER", "SUPERVISOR"]);
const MANAGEMENT_UP = new Set(["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER", "MANAGER"]);
const SENIOR_UP = new Set(["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER"]);

/** Bentuk baris grid /laporan-harian yang dibaca kolom & menu konteks. */
type BarisLaporan = RingLaporanHarian & {
  id?: string;
  nomorLangganan?: string;
  namaPelanggan?: string | null;
  alamatPelanggan?: string | null;
  standAwal?: number;
  standAkhir?: number;
  standAkhirRevisi?: number | null;
  pemakaian?: number;
  pemakaianLalu?: number | null;
  persentase?: number | null;
  nomorMeter?: string | null;
  tanggalCatat?: string | null;
  pelanggan?: {
    id: string;
    nama: string;
    alamat?: string | null;
    tarifGolongan?: { kodeAsli: string } | null;
    rute?: { kode: string } | null;
    zona?: { kode: string; wilayahSeksi?: { kode: string } | null } | null;
  } | null;
  pencatat?: { id: string; namaLapangan: string } | null;
  pembacaan?: { id: string; standAkhir: number } | null;
  verif1By?: { name: string | null } | null;
  verif2By?: { name: string | null } | null;
  verif3By?: { name: string | null } | null;
  verifiedBy?: { name: string | null } | null;
};

// Warna per ring — dipakai ceklis kolom V1/V2/V3 dan (dijaga sama) baris
// ProgresRing di panel kiri: V1 hijau, V2 biru, V3 ungu.
const WARNA_RING = {
  v1: "text-emerald-600 dark:text-emerald-400",
  v2: "text-sky-600 dark:text-sky-400",
  v3: "text-violet-600 dark:text-violet-400",
} as const;

/// Kolom ring sengaja sempit: ceklis berwarna, nama pengoreksi di tooltip
/// (dan tetap ikut ke ekspor Excel lewat valueGetter).
function selRing(warna: string) {
  const Sel = (p: ICellRendererParams) => {
    const nama = p.value as string | null;
    if (!nama) return <span className="text-muted-foreground/50">—</span>;
    return (
      <span className="inline-flex w-full justify-center" title={nama}>
        <Check className={`size-4 ${warna}`} strokeWidth={3} />
      </span>
    );
  };
  return Sel;
}

const SEL_KOSONG = () => <span className="text-muted-foreground">—</span>;

export function VerifikasiLapangan({ role }: { role: string }) {
  const bisaV1 = SUPERVISOR_UP.has(role);
  const bisaV2 = MANAGEMENT_UP.has(role);
  const bisaV3 = SENIOR_UP.has(role);

  // undefined = belum init (default akan diisi periode terbaru yang punya
  // data — aturan dashboard: periode acuan = terakhir yang ADA datanya,
  // bukan bulan berjalan). null = pengguna memilih "Semua periode".
  const [periode, setPeriode] = React.useState<number | null | undefined>(
    undefined,
  );
  const [stats, setStats] = React.useState<StatsVerifikasi | null>(null);
  const [galatStats, setGalatStats] = React.useState<string | null>(null);
  const [idTerpilih, setIdTerpilih] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Menu klik kanan + aksi yang sedang berjalan.
  const [menu, setMenu] = React.useState<{
    posisi: { x: number; y: number };
    baris: BarisLaporan;
  } | null>(null);
  const [aksi, setAksi] = React.useState<AksiLapangan | null>(null);
  const [konfirmasi, setKonfirmasi] = React.useState<{
    endpoint: "verif2" | "verif3" | "unverify";
    id: string;
    judul: string;
    deskripsi: string;
    destruktif?: boolean;
  } | null>(null);
  const [mengirim, setMengirim] = React.useState(false);
  const [galatAksi, setGalatAksi] = React.useState<string | null>(null);

  // Daftar pencatat untuk filter toolbar (permintaan: bisa menyaring per
  // pencatat, sorting tanggal sudah lewat header kolom "Catat").
  const [pencatats, setPencatats] = React.useState<
    { id: string; namaLapangan: string }[]
  >([]);

  React.useEffect(() => {
    let batal = false;
    ambilList<{ id: string; namaLapangan: string }>("/pencatat", {
      pageSize: 500,
    })
      .then(({ rows }) => {
        if (!batal) setPencatats(rows);
      })
      .catch(() => {
        // Filter pencatat opsional — tabel tetap berfungsi tanpa daftarnya.
      });
    return () => {
      batal = true;
    };
  }, []);

  React.useEffect(() => {
    let batal = false;
    ambilSatu<StatsVerifikasi>("/laporan-harian/stats", {
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

  const ambang = stats?.ambangAnomali ?? 50;

  // Kolom mengikuti header tabel.md:
  // V1|V2|V3|No|No Pel|Nama|Alamat|Tarif|ST awal|ST akhir resmi|ST akhir
  // catat|ST akhir revisi|m3|m3 Lalu|%|Koreksi|SISA|St rata2|RUTE|W|ZONA|
  // Cater|Catat|Nm_al|St Angkat. SISA / St rata2 / St Angkat belum punya
  // sumber data di sistem — tampil "—" dulu, kolomnya sudah disiapkan.
  const kolom = React.useMemo<ColDef[]>(
    () => [
      {
        headerName: "V1",
        colId: "v1",
        minWidth: 48,
        maxWidth: 54,
        resizable: false,
        valueGetter: (p) => (p.data ? ringVerif(p.data as BarisLaporan).v1 : null),
        cellRenderer: selRing(WARNA_RING.v1),
      },
      {
        headerName: "V2",
        colId: "v2",
        minWidth: 48,
        maxWidth: 54,
        resizable: false,
        valueGetter: (p) => (p.data ? ringVerif(p.data as BarisLaporan).v2 : null),
        cellRenderer: selRing(WARNA_RING.v2),
      },
      {
        headerName: "V3",
        colId: "v3",
        minWidth: 48,
        maxWidth: 54,
        resizable: false,
        valueGetter: (p) => (p.data ? ringVerif(p.data as BarisLaporan).v3 : null),
        cellRenderer: selRing(WARNA_RING.v3),
      },
      {
        headerName: "No",
        colId: "no",
        minWidth: 60,
        maxWidth: 70,
        cellClass: KELAS_ANGKA,
        cellRenderer: (p: ICellRendererParams) =>
          p.node.rowIndex != null ? p.node.rowIndex + 1 : "",
      },
      {
        field: "nomorLangganan",
        headerName: "No Pel",
        minWidth: 130,
        maxWidth: 145,
        cellClass: KELAS_MONO,
        sortable: true,
        // Tanpa ikon anomali (permintaan pengguna) — sinyal anomali cukup
        // dari pewarnaan kolom % dan badge hitungan di atas tabel.
      },
      {
        headerName: "Nama",
        minWidth: 150,
        flex: 2,
        valueGetter: (p) =>
          p.data?.pelanggan?.nama ?? p.data?.namaPelanggan ?? "—",
      },
      {
        headerName: "Alamat",
        minWidth: 160,
        flex: 2,
        valueGetter: (p) =>
          p.data?.pelanggan?.alamat ?? p.data?.alamatPelanggan ?? "—",
      },
      {
        headerName: "Tarif",
        minWidth: 80,
        valueGetter: (p) => p.data?.pelanggan?.tarifGolongan?.kodeAsli ?? "—",
      },
      {
        field: "standAwal",
        headerName: "ST awal",
        minWidth: 90,
        sortable: true,
        cellClass: KELAS_ANGKA,
        valueFormatter: fmtAngka,
      },
      {
        headerName: "ST akhir resmi",
        colId: "standResmi",
        minWidth: 105,
        cellClass: KELAS_ANGKA,
        valueGetter: (p) => p.data?.pembacaan?.standAkhir ?? null,
        valueFormatter: fmtAngka,
      },
      {
        field: "standAkhir",
        headerName: "ST akhir catat",
        minWidth: 105,
        sortable: true,
        cellClass: KELAS_ANGKA,
        valueFormatter: fmtAngka,
      },
      {
        field: "standAkhirRevisi",
        headerName: "ST akhir revisi",
        minWidth: 105,
        cellClass: KELAS_ANGKA,
        valueFormatter: fmtAngka,
      },
      {
        field: "pemakaian",
        headerName: "m3",
        minWidth: 85,
        sortable: true,
        cellClass: KELAS_ANGKA,
        valueFormatter: fmtAngka,
      },
      {
        field: "pemakaianLalu",
        headerName: "m3 Lalu",
        minWidth: 90,
        sortable: true,
        cellClass: KELAS_ANGKA,
        valueFormatter: fmtAngka,
      },
      {
        field: "persentase",
        headerName: "%",
        minWidth: 85,
        sortable: true,
        cellClass: KELAS_ANGKA,
        valueFormatter: (p: ValueFormatterParams) =>
          typeof p.value === "number"
            ? `${p.value > 0 ? "+" : ""}${p.value}%`
            : "—",
        cellRenderer: (p: ICellRendererParams) => {
          if (typeof p.value !== "number")
            return <span className="text-muted-foreground">—</span>;
          const kelas =
            Math.abs(p.value) > ambang
              ? "text-red-600 dark:text-red-400 font-semibold"
              : p.value < 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-foreground";
          return (
            <span
              className={kelas}
            >{`${p.value > 0 ? "+" : ""}${p.value}%`}</span>
          );
        },
      },
      {
        headerName: "Koreksi",
        colId: "koreksi",
        minWidth: 90,
        cellClass: KELAS_ANGKA,
        // Selisih kubikasi akibat revisi V1 (revisi − catat); kosong bila
        // tidak ada revisi.
        valueGetter: (p) => {
          const d = p.data as BarisLaporan | undefined;
          return d?.standAkhirRevisi != null && d.standAkhir != null
            ? d.standAkhirRevisi - d.standAkhir
            : null;
        },
        valueFormatter: (p: ValueFormatterParams) =>
          typeof p.value === "number"
            ? `${p.value > 0 ? "+" : ""}${p.value.toLocaleString("id-ID")}`
            : "—",
      },
      { headerName: "SISA", colId: "sisa", minWidth: 80, cellRenderer: SEL_KOSONG },
      { headerName: "St rata2", colId: "stRata2", minWidth: 90, cellRenderer: SEL_KOSONG },
      {
        headerName: "RUTE",
        minWidth: 85,
        valueGetter: (p) => p.data?.pelanggan?.rute?.kode ?? "—",
      },
      {
        headerName: "W",
        minWidth: 75,
        valueGetter: (p) => p.data?.pelanggan?.zona?.wilayahSeksi?.kode ?? "—",
      },
      {
        headerName: "ZONA",
        minWidth: 85,
        valueGetter: (p) => p.data?.pelanggan?.zona?.kode ?? "—",
      },
      {
        headerName: "Cater",
        minWidth: 110,
        valueGetter: (p) => p.data?.pencatat?.namaLapangan ?? "—",
      },
      {
        field: "tanggalCatat",
        headerName: "Catat",
        minWidth: 110,
        sortable: true,
        valueFormatter: fmtTanggal,
      },
      {
        // Keterangan/kondisi catat (DK, BMK/BMB, dll.) — penting untuk
        // menilai stand yang aneh; bisa dikoreksi di modal V1.
        field: "kondisi",
        headerName: "Ket. catat",
        minWidth: 115,
        sortable: true,
        valueFormatter: fmtLabel(LABEL_KONDISI_CATAT),
      },
      {
        field: "nomorMeter",
        headerName: "Nm_al",
        minWidth: 110,
        cellClass: KELAS_MONO,
      },
      { headerName: "St Angkat", colId: "stAngkat", minWidth: 95, cellRenderer: SEL_KOSONG },
    ],
    [ambang],
  );

  async function jalankanKonfirmasi() {
    if (!konfirmasi) return;
    setMengirim(true);
    setGalatAksi(null);
    try {
      await kirimJson(
        `/laporan-harian/${konfirmasi.id}/${konfirmasi.endpoint}`,
        "PATCH",
        {},
      );
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

  /// Item menu klik kanan sesuai tahap baris + role pengguna. Item yang
  /// belum waktunya (mis. V2 sebelum V1) disembunyikan; item yang butuh
  /// role lebih tinggi tampil disabled dengan keterangan.
  function aksiMenu(baris: BarisLaporan): AksiKonteks[] {
    const id = baris.id;
    if (!id) return [];
    const tahap = tahapLaporanHarian(baris);
    const nama = baris.pelanggan?.nama ?? baris.namaPelanggan ?? baris.nomorLangganan ?? "";
    const daftar: AksiKonteks[] = [
      {
        label: "Lihat detail",
        icon: Eye,
        onPilih: () => setMenu(null),
        keterangan: "Detail sudah tampil di panel kiri",
      },
    ];

    if (tahap === "MENUNGGU_V1" || tahap === "DITOLAK") {
      daftar.push({
        label: "Verifikasi V1 — periksa & koreksi…",
        icon: ShieldCheck,
        pemisah: true,
        disabled: !bisaV1 || !baris.pelanggan,
        keterangan: !baris.pelanggan
          ? "Pelanggan belum ter-import — belum bisa diverifikasi"
          : !bisaV1
            ? "Butuh Supervisor ke atas"
            : tahap === "DITOLAK"
              ? "Laporan ditolak — verifikasi ulang bila ternyata benar"
              : undefined,
        onPilih: () => {
          setMenu(null);
          setAksi("v1");
        },
      });
    }
    if (tahap === "MENUNGGU_V2") {
      daftar.push({
        label: "Validasi V2",
        icon: CheckCheck,
        pemisah: true,
        disabled: !bisaV2,
        keterangan: bisaV2 ? undefined : "Butuh Manager ke atas",
        onPilih: () => {
          setMenu(null);
          setGalatAksi(null);
          setKonfirmasi({
            endpoint: "verif2",
            id,
            judul: "Validasi V2?",
            deskripsi: `Menandai laporan ${nama} lolos pemeriksaan tingkat Manager. Setelah ini laporan menunggu approve final V3.`,
          });
        },
      });
    }
    if (tahap === "MENUNGGU_V3") {
      daftar.push({
        label: "Approve final V3 — jadikan resmi",
        icon: FileCheck2,
        pemisah: true,
        disabled: !bisaV3,
        keterangan: bisaV3 ? undefined : "Butuh Senior Manager ke atas",
        onPilih: () => {
          setMenu(null);
          setGalatAksi(null);
          setKonfirmasi({
            endpoint: "verif3",
            id,
            judul: "Approve final V3?",
            deskripsi: `Persetujuan akhir untuk ${nama}: laporan menjadi PembacaanMeter resmi dan siap diproses ke penagihan. Angka yang dipakai: revisi V1 bila ada, selain itu angka catat petugas.`,
          });
        },
      });
    }

    if (tahap !== "RESMI" && tahap !== "DITOLAK") {
      daftar.push({
        label: "Cek ulang — kembalikan ke petugas…",
        icon: RotateCcw,
        disabled: !bisaV1,
        keterangan: bisaV1
          ? "Semua ring yang sudah terisi ikut direset"
          : "Butuh Supervisor ke atas",
        onPilih: () => {
          setMenu(null);
          setAksi("cekulang");
        },
      });
    }

    // Unverifikasi: membatalkan SATU tahap terakhir.
    if (tahap === "RESMI") {
      daftar.push({
        label: "Batalkan approve final (V3)",
        icon: Undo2,
        pemisah: true,
        destruktif: true,
        disabled: !bisaV3,
        keterangan: bisaV3
          ? "Pembacaan resmi dihapus; ditolak bila sudah dipakai tagihan"
          : "Butuh Senior Manager ke atas",
        onPilih: () => {
          setMenu(null);
          setGalatAksi(null);
          setKonfirmasi({
            endpoint: "unverify",
            id,
            destruktif: true,
            judul: "Batalkan approve final?",
            deskripsi: `PembacaanMeter resmi milik ${nama} dihapus dan laporan kembali ke tahap menunggu V3. Server menolak bila pembacaan sudah dipakai tagihan.`,
          });
        },
      });
    } else if (tahap === "MENUNGGU_V3") {
      daftar.push({
        label: "Batalkan V2",
        icon: Undo2,
        destruktif: true,
        disabled: !bisaV2,
        keterangan: bisaV2 ? undefined : "Butuh Manager ke atas",
        onPilih: () => {
          setMenu(null);
          setGalatAksi(null);
          setKonfirmasi({
            endpoint: "unverify",
            id,
            destruktif: true,
            judul: "Batalkan V2?",
            deskripsi: `Tanda validasi V2 pada laporan ${nama} dihapus; laporan kembali menunggu V2.`,
          });
        },
      });
    } else if (tahap === "MENUNGGU_V2") {
      daftar.push({
        label: "Batalkan V1",
        icon: Undo2,
        destruktif: true,
        disabled: !bisaV1,
        keterangan: bisaV1
          ? "Revisi stand & pilihan meter ikut dihapus"
          : "Butuh Supervisor ke atas",
        onPilih: () => {
          setMenu(null);
          setGalatAksi(null);
          setKonfirmasi({
            endpoint: "unverify",
            id,
            destruktif: true,
            judul: "Batalkan V1?",
            deskripsi: `Hasil pemeriksaan V1 pada laporan ${nama} (termasuk revisi stand dan pilihan meter) dihapus; laporan kembali menunggu V1.`,
          });
        },
      });
    } else if (tahap === "DITOLAK") {
      daftar.push({
        label: "Kembalikan ke antrean (batalkan tolak)",
        icon: Undo2,
        disabled: !bisaV1,
        keterangan: bisaV1 ? undefined : "Butuh Supervisor ke atas",
        onPilih: () => {
          setMenu(null);
          setGalatAksi(null);
          setKonfirmasi({
            endpoint: "unverify",
            id,
            judul: "Batalkan penolakan?",
            deskripsi: `Catatan penolakan dihapus dan laporan ${nama} kembali ke antrean menunggu V1.`,
          });
        },
      });
    }

    return daftar;
  }

  return (
    // h-full: SEKARANG aman dipakai — layout.tsx sudah mengunci rantai
    // tinggi di atas (SidebarInset h-dvh overflow-hidden → div konten
    // min-h-0 flex-1). items-stretch: kedua kolom otomatis sama-sama
    // penuh mengisi tinggi yang tersedia (bukan lagi angka calc tebakan).
    <div className="flex h-full min-h-0 flex-col items-stretch gap-4 lg:flex-row">
      {/* Panel kiri = kolom mandiri sejak baris paling atas (sejajar
          card ringkasan), tinggi penuh, scroll sendiri via overflow-y-auto
          — tidak lagi butuh sticky/calc, cukup h-full karena parent-nya
          sudah pasti tingginya. */}
      <aside className="scrollbar-tipis flex h-full min-h-0 w-full shrink-0 flex-col overflow-y-auto border border-border/70 bg-card lg:w-80">
        <div className="sticky top-0 z-10 shrink-0 border-b border-border/70 bg-card px-4 py-2.5">
          <h2 className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Detail Laporan
          </h2>
        </div>
        {/* key: ganti baris = remount panel, seluruh state form mulai
            bersih tanpa reset sinkron di effect. */}
        <PanelLapangan
          key={idTerpilih ?? "kosong"}
          id={idTerpilih}
          aksi={aksi}
          ambangAnomali={ambang}
          onTutupAksi={() => setAksi(null)}
          onSelesai={() => setRefreshKey((k) => k + 1)}
        />
      </aside>

      {/* Kolom kanan: header periode + 4 card (shrink-0, tinggi natural)
          + tabel (flex-1 min-h-0, mengisi SISA tinggi kolom & scroll
          sendiri) — bukan lagi 3 blok lepas dengan tinggi ditebak. */}
      <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {periode ? `Periode ${formatPeriode(periode)}` : "Semua periode"}
            {stats?.anomali ? (
              <span className="ml-2 border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
                {stats.anomali.toLocaleString("id-ID")} anomali &gt; ±{ambang}%
              </span>
            ) : null}
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
            judul="Laporan Pencatatan Lapangan"
            endpoint="/laporan-harian"
            columnDefs={kolom}
            searchParam="q"
            searchPlaceholder="Cari no. langganan / nama…"
            filters={[
              {
                param: "statusVerif",
                label: "Status",
                opsi: [
                  { value: "MENUNGGU", label: "Menunggu" },
                  { value: "DIVERIFIKASI", label: "Resmi" },
                  { value: "DITOLAK", label: "Cek ulang" },
                ],
              },
              {
                param: "pencatatId",
                label: "Pencatat",
                opsi: pencatats.map((p) => ({
                  value: p.id,
                  label: p.namaLapangan,
                })),
              },
            ]}
            extraParams={periode ? { periode: String(periode) } : undefined}
            onRowClicked={(d) =>
              setIdTerpilih((d as { id?: string }).id ?? null)
            }
            onRowContextMenu={(d, posisi) => {
              const baris = d as BarisLaporan;
              // Klik kanan sekaligus memilih baris — panel kiri dan menu
              // selalu membicarakan baris yang sama.
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
          judul={`${menu.baris.nomorLangganan ?? ""} · ${menu.baris.pelanggan?.nama ?? menu.baris.namaPelanggan ?? ""}`}
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
          {galatAksi && (
            <p className="text-xs text-destructive">{galatAksi}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mengirim}>Batal</AlertDialogCancel>
            {/* onClick tanpa auto-close: dialog baru ditutup setelah server
                menjawab sukses; galat tampil di dalam dialog. */}
            <AlertDialogAction
              disabled={mengirim}
              onClick={(e) => {
                e.preventDefault();
                void jalankanKonfirmasi();
              }}
            >
              {mengirim && <Spinner className="size-3.5" />}
              {konfirmasi?.destruktif ? "Ya, batalkan" : "Ya, lanjutkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}