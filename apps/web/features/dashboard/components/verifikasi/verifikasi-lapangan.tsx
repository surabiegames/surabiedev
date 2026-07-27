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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui/components/resizable";
import { formatPeriode } from "@/features/public/lib/format";
import { ambilSatu, ambilList, kirimJson, ApiError } from "../../lib/api-client";
import { LABEL_KONDISI_CATAT } from "../../lib/label";
import {
  fmtLabel,
  fmtTanggal,
  fmtAngka,
  KELAS_ANGKA,
  KELAS_MONO,
} from "../grids/sel";
import type { StatsVerifikasi, RingLaporanHarian } from "./tipe";
import { tahapLaporanHarian, ringVerif } from "./tipe";
import { RingkasanVerifikasi } from "./ringkasan-verifikasi";
import { PanelTabel } from "./panel-tabel";
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
  /// role lebih tinggi tampil disabled — wewenangnya sudah dijaga role
  /// akses, jadi tidak perlu dijelaskan ulang di tiap item.
  function aksiMenu(baris: BarisLaporan): AksiKonteks[] {
    const id = baris.id;
    if (!id) return [];
    const tahap = tahapLaporanHarian(baris);
    const nama = baris.pelanggan?.nama ?? baris.namaPelanggan ?? baris.nomorLangganan ?? "";
    const daftar: AksiKonteks[] = [
      {
        label: "Lihat",
        icon: Eye,
        onPilih: () => setMenu(null),
      },
    ];

    if (tahap === "MENUNGGU_V1" || tahap === "DITOLAK") {
      daftar.push({
        label: "Verifikasi V1",
        icon: ShieldCheck,
        pemisah: true,
        disabled: !bisaV1 || !baris.pelanggan,
        onPilih: () => {
          setMenu(null);
          setAksi("v1");
        },
      });
    }
    if (tahap === "MENUNGGU_V2") {
      daftar.push({
        label: "Verifikasi V2",
        icon: CheckCheck,
        pemisah: true,
        disabled: !bisaV2,
        onPilih: () => {
          setMenu(null);
          setAksi("v2");
        },
      });
    }
    if (tahap === "MENUNGGU_V3") {
      daftar.push({
        label: "Verifikasi V3",
        icon: FileCheck2,
        pemisah: true,
        disabled: !bisaV3,
        onPilih: () => {
          setMenu(null);
          setAksi("v3");
        },
      });
    }

    if (tahap !== "RESMI" && tahap !== "DITOLAK") {
      daftar.push({
        label: "Cek ulang",
        icon: RotateCcw,
        disabled: !bisaV1,
        onPilih: () => {
          setMenu(null);
          setAksi("cekulang");
        },
      });
    }

    // Unverifikasi: membatalkan SATU tahap terakhir.
    if (tahap === "RESMI") {
      daftar.push({
        label: "Batalkan V3",
        icon: Undo2,
        pemisah: true,
        destruktif: true,
        disabled: !bisaV3,
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
    <>
    {/* TATA LETAK: tabel KIRI, detail KANAN.
    //
        Sisi kiri layar sudah milik sidebar aplikasi; menaruh panel detail di
        sana membuat dua talang vertikal bertumpuk dan memaksa mata melewati
        dua kolom sempit sebelum sampai ke isi. Tabel adalah objek utama
        halaman ini dan ia yang butuh lebar. Urutan bacanya pun jadi wajar:
        pilih baris (kiri) lalu lihat rinciannya (kanan), bukan melompat
        mundur 22 ribu kali.

        TEPI MENYATU: tanpa gap & tanpa border luar. Panel tabel menempel ke
        sidebar aplikasi dan ke navbar atas; satu-satunya garis di antara
        kedua panel adalah pemisah yang bisa ditarik. Border ganda berjarak
        1px jadi tidak mungkin terjadi. */}
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0 items-stretch">
      <ResizablePanel defaultSize="72" minSize="40" className="flex min-w-0 flex-col">
        <div className="flex h-full min-h-0 min-w-0 flex-col gap-2 p-2">
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <p className="text-muted-foreground text-xs">
              {periode ? `Periode ${formatPeriode(periode)}` : "Semua periode"}
            </p>
            {stats?.anomali ? (
              <span className="border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400 border">
                {stats.anomali.toLocaleString("id-ID")} anomali &gt; ±{ambang}%
              </span>
            ) : null}
            {galatStats && <p className="text-destructive text-xs">{galatStats}</p>}
          </div>

          <div className="shrink-0">
            <RingkasanVerifikasi stats={stats} periode={periode ?? null} />
          </div>

          <div className="min-h-0 min-w-0 flex-1">
            <PanelTabel
              periodes={stats?.periodes ?? []}
              pencatats={pencatats}
              ambangAnomali={ambang}
              bolehRing={(r) => (r === 1 ? bisaV1 : r === 2 ? bisaV2 : bisaV3)}
              idTerpilih={idTerpilih}
              onPeriodeBerubah={setPeriode}
              onKlikBaris={(row) => setIdTerpilih(row.id)}
              onKlikKanan={(row, posisi) => {
                setIdTerpilih(row.id)
                setAksi(null)
                setMenu({ posisi, baris: row as BarisLaporan })
              }}
              refreshKey={refreshKey}
              onBerubah={() => setRefreshKey((k) => k + 1)}
              sisaKerja={stats ? stats.total - stats.diverifikasi : null}
            />
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize="28" minSize="18" collapsible className="flex min-w-0 flex-col">
        {/* Judul DI LUAR wadah bergulir. Versi sebelumnya menaruhnya sebagai
            `sticky top-0` di dalam elemen ber-`overflow-y-auto`, dan tepi
            atasnya terpotong oleh wadahnya sendiri — itulah "border atas
            tidak terlihat". Header tetap, isi yang bergulir: tidak ada lagi
            yang bisa memotongnya. */}
        <aside className="bg-card flex h-full min-h-0 flex-col">
          <div className="border-border/70 shrink-0 border-b px-4 py-2.5">
            <h2 className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
              Detail Laporan
            </h2>
          </div>
          <div className="scrollbar-tipis min-h-0 flex-1 overflow-y-auto">
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
          </div>
        </aside>
      </ResizablePanel>
    </ResizablePanelGroup>

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
    </>
  );
}