"use client";

// features/dashboard/components/verifikasi/panel-lapangan.tsx — panel kiri
// halaman verifikasi laporan petugas lapangan.
//
// Panel ini MURNI PENAMPIL DETAIL — tidak ada kotak isian maupun tombol
// aksi; satu-satunya interaksi adalah melihat peta dan memperbesar foto.
// Seluruh aksi (V1/V2/V3, cek ulang, unverify) dipicu dari MENU KLIK KANAN
// pada baris tabel; halaman meneruskan aksi yang dipilih lewat prop `aksi`,
// dan panel hanya merender ModalLapangan begitu detailnya siap.
import * as React from "react";
import { AlertTriangle, CheckCircle2, MousePointerClick } from "lucide-react";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { formatPeriode, formatTanggal } from "@/features/public/lib/format";
import { ambilSatu, ambilList, ApiError } from "../../lib/api-client";
import { LABEL_KONDISI_CATAT, label } from "../../lib/label";
import type { LaporanHarianDetail, MeterRingkas } from "./tipe";
import { tahapLaporanHarian, ringVerif } from "./tipe";
import { BadgeStatusVerif, Bagian, GridStand, PanelKosong } from "./panel-bagian";
import { FotoSebelumnya } from "./foto-sebelumnya";
import { TabFoto } from "./tab-foto";
import { HistoriPemakaian } from "./histori-pemakaian";
import { PetaLokasi } from "./peta-lokasi";
import { ModalLapangan } from "./modal-lapangan";

/// v2/v3 memakai modal yang SAMA dengan v1. Sengaja bukan modal terpisah:
/// koreksi yang boleh dilakukan ketiganya identik, dan dua formulir untuk
/// satu pekerjaan selalu berujung pada salah satunya ketinggalan diperbarui.
export type AksiLapangan = "v1" | "v2" | "v3" | "cekulang";

/// Baris progres ring V1/V2/V3 — penampil murni. Warna per ring SAMA dengan
/// ceklis kolom V1/V2/V3 di tabel (WARNA_RING di verifikasi-lapangan.tsx):
/// V1 hijau, V2 biru, V3 ungu — satu bahasa visual di tabel dan panel.
function ProgresRing({ detail }: { detail: LaporanHarianDetail }) {
  const ring = ringVerif(detail);
  const baris: { label: string; nama: string | null; tanggal?: string | null; warna: string }[] = [
    {
      label: "V1 · Supervisor",
      nama: ring.v1,
      tanggal: detail.verif1At,
      warna: "text-emerald-700 dark:text-emerald-400",
    },
    {
      label: "V2 · Manager",
      nama: ring.v2,
      tanggal: detail.verif2At,
      warna: "text-sky-700 dark:text-sky-400",
    },
    {
      label: "V3 · Senior Manager",
      nama: ring.v3,
      tanggal: detail.verif3At,
      warna: "text-violet-700 dark:text-violet-400",
    },
  ];
  return (
    <div className="flex flex-col divide-y divide-border/70 border border-border/70">
      {baris.map((b) => (
        <div key={b.label} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
          <span className="text-[9px] font-semibold tracking-widest text-muted-foreground uppercase">
            {b.label}
          </span>
          {b.nama ? (
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${b.warna}`}>
              <CheckCircle2 className="size-3 shrink-0" />
              {b.nama}
              {b.tanggal ? ` · ${formatTanggal(b.tanggal)}` : ""}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function PanelLapangan({
  id,
  aksi,
  ambangAnomali,
  onTutupAksi,
  onSelesai,
}: {
  id: string | null;
  /** Aksi dari menu klik kanan yang butuh modal (v1 / cek ulang);
   *  null = tidak ada modal. Panel sendiri tidak punya tombol aksi. */
  aksi: AksiLapangan | null;
  ambangAnomali: number;
  onTutupAksi: () => void;
  onSelesai: () => void;
}) {
  const [detail, setDetail] = React.useState<LaporanHarianDetail | null>(null);
  const [galat, setGalat] = React.useState<string | null>(null);
  // Pemicu muat ulang setelah aksi. State awal selalu bersih tiap ganti
  // baris karena parent me-remount panel lewat `key` — tidak ada reset
  // sinkron di effect (dilarang react-hooks/set-state-in-effect).
  const [muatKe, setMuatKe] = React.useState(0);

  const [meters, setMeters] = React.useState<MeterRingkas[]>([]);
  const [meterAwal, setMeterAwal] = React.useState("");

  React.useEffect(() => {
    if (!id) return;
    let batal = false;
    (async () => {
      try {
        const row = await ambilSatu<LaporanHarianDetail>(
          `/laporan-harian/${id}`,
        );
        if (batal) return;
        setDetail(row);
        setGalat(null);
        if (row.pelanggan?.id) {
          const { rows } = await ambilList<MeterRingkas>("/meter", {
            pelangganId: row.pelanggan.id,
            pageSize: 100,
          });
          if (batal) return;
          setMeters(rows);
          // Prapilih: meter pilihan V1 sebelumnya, lalu meter yang nomornya
          // cocok dengan laporan, lalu meter aktif — verifikator tetap bisa
          // menggantinya di modal.
          const pilihan = rows.find((m) => m.id === row.meterVerifId);
          const cocok = rows.find(
            (m) => row.nomorMeter && m.nomorMeter === row.nomorMeter,
          );
          setMeterAwal(
            (pilihan ?? cocok ?? rows.find((m) => m.isAktif) ?? rows[0])?.id ??
              "",
          );
        } else {
          setMeters([]);
          setMeterAwal("");
        }
      } catch (err) {
        if (!batal)
          setGalat(
            err instanceof ApiError
              ? err.message
              : "Gagal memuat detail laporan.",
          );
      }
    })();
    return () => {
      batal = true;
    };
  }, [id, muatKe]);

  if (!id) {
    return (
      <PanelKosong
        icon={MousePointerClick}
        pesan="Klik baris untuk melihat detail; klik kanan baris untuk aksi verifikasi (V1/V2/V3, cek ulang, batalkan)."
      />
    );
  }
  if (!detail && !galat) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }
  if (!detail) {
    return (
      <p className="p-4 text-xs text-destructive">
        {galat ?? "Detail tidak ditemukan."}
      </p>
    );
  }

  const tahap = tahapLaporanHarian(detail);
  const nama = detail.pelanggan?.nama ?? detail.namaPelanggan ?? "Tanpa nama";
  const alamat = detail.pelanggan?.alamat ?? detail.alamatPelanggan;
  const anomali =
    detail.persentase != null && Math.abs(detail.persentase) > ambangAnomali;
  // Modal hanya relevan bila laporan masih bisa diproses; menu klik kanan
  // sudah menyaring, ini pagar kedua bila data berubah di antaranya.
  //
  // SYARATNYA PER RING. Versi sebelumnya memakai satu syarat `!verif1At`
  // untuk semua aksi verifikasi — akibatnya begitu V1 selesai, memilih
  // "Verifikasi V2" memang mengubah state tapi modalnya tidak pernah
  // dirender: tombol hidup, tidak terjadi apa-apa. Tiap ring punya
  // prasyaratnya sendiri, persis seperti yang ditegakkan server.
  const bisaModal = (() => {
    // Sudah jadi pembacaan resmi: tidak ada ring yang tersisa, dan cek
    // ulang pun harus lewat "Batalkan V3" dulu.
    if (detail.pembacaanId) return false;
    if (aksi === "cekulang") return true;
    if (!detail.pelanggan) return false;
    if (aksi === "v1") return !detail.verif1At;
    if (aksi === "v2") return !!detail.verif1At && !detail.verif2At;
    if (aksi === "v3") return !!detail.verif1At && !!detail.verif2At && !detail.verif3At;
    return false;
  })();

  return (
    <div className="flex flex-col gap-3.5 p-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{nama}</p>
          <BadgeStatusVerif status={tahap} />
        </div>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {detail.nomorLangganan}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatPeriode(detail.periode)} ·{" "}
          {label(LABEL_KONDISI_CATAT, detail.kondisi)}
        </p>
        {alamat && (
          <p className="mt-1.5 text-xs text-muted-foreground">{alamat}</p>
        )}
        {!detail.pelanggan && (
          <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
            Nomor langganan ini belum terhubung ke data pelanggan — verifikasi
            belum bisa dijalankan sebelum pelanggannya ter-import.
          </p>
        )}
      </div>

      <Separator />

      <GridStand
        sel={[
          { label: "St. awal", nilai: detail.standAwal },
          { label: "St. catat", nilai: detail.standAkhir },
          ...(detail.standAkhirRevisi != null
            ? [{ label: "St. revisi", nilai: detail.standAkhirRevisi }]
            : []),
          { label: "Pakai (m³)", nilai: detail.pemakaian },
        ]}
      />

      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span
          className={
            anomali
              ? "inline-flex items-center gap-1 font-medium text-destructive"
              : "text-muted-foreground"
          }
        >
          {anomali && <AlertTriangle className="size-3" />}
          Deviasi{" "}
          {detail.persentase != null
            ? `${detail.persentase > 0 ? "+" : ""}${detail.persentase}%`
            : "—"}
          {anomali ? ` (ambang ±${ambangAnomali}%)` : " dari bulan lalu"}
        </span>
        <span className="text-muted-foreground">
          {detail.pencatat?.namaLapangan ?? "Pencatat tidak diketahui"}
          {detail.tanggalCatat
            ? ` · ${formatTanggal(detail.tanggalCatat)}`
            : ""}
        </span>
      </div>

      <Separator />

      {/* Urutan panel (permintaan pengguna): detail laporan → stand →
          histori pencatatan 3 bulan → foto sebelumnya (pembanding) → foto
          periode berjalan → verifikasi berjenjang → lokasi. */}
      <Bagian judul="Histori pencatatan (3 bulan terakhir)">
        <HistoriPemakaian pelangganId={detail.pelanggan?.id} />
      </Bagian>

      <Bagian judul="Foto periode sebelumnya (pembanding)">
        <FotoSebelumnya
          pelangganId={detail.pelanggan?.id}
          periode={detail.periode}
        />
      </Bagian>

      <Bagian judul="Foto periode berjalan">
        <TabFoto
          varian="panel"
          item={[
            {
              kunci: "stand",
              label: "Stand meter",
              url: detail.fotoStandUrl ?? detail.pembacaan?.fotoBukti,
              keteranganKosong:
                "Laporan petugas dari sistem lama tidak menyertakan foto.",
            },
            {
              kunci: "segel",
              label: "Segel",
              url: detail.fotoSegelUrl,
              keteranganKosong: "Petugas tidak mengirim foto segel.",
            },
            {
              kunci: "rumah",
              label: "Rumah",
              url: detail.fotoRumahUrl,
              keteranganKosong: "Petugas tidak mengirim foto rumah/persil.",
            },
          ]}
        />
      </Bagian>

      <Bagian judul="Verifikasi berjenjang">
        <ProgresRing detail={detail} />
      </Bagian>

      <Bagian judul="Lokasi">
        <PetaLokasi
          lat={detail.pelanggan?.geoLat}
          lng={detail.pelanggan?.geoLong}
        />
      </Bagian>

      <Separator />

      {tahap === "RESMI" && (
        <p className="inline-flex items-start gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          Sudah menjadi pembacaan resmi
          {detail.verifiedBy?.name
            ? ` — approve final ${detail.verifiedBy.name}`
            : ""}
          {detail.verifiedAt ? ` (${formatTanggal(detail.verifiedAt)})` : ""}.
        </p>
      )}
      {tahap === "DITOLAK" && (
        <p className="text-[11px] text-muted-foreground">
          Dikembalikan untuk cek ulang
          {detail.verifiedBy?.name ? ` oleh ${detail.verifiedBy.name}` : ""}
          {detail.catatanVerif ? ` — “${detail.catatanVerif}”` : ""}. Klik
          kanan barisnya untuk memverifikasi ulang bila ternyata benar.
        </p>
      )}
      {detail.catatanVerif && tahap !== "DITOLAK" && (
        <p className="text-[11px] text-muted-foreground">
          Catatan verifikasi: “{detail.catatanVerif}”
        </p>
      )}

      {aksi && bisaModal && (
        <ModalLapangan
          detail={detail}
          meters={meters}
          meterAwal={meterAwal}
          ring={aksi === "v2" ? 2 : aksi === "v3" ? 3 : 1}
          tolakAwal={aksi === "cekulang"}
          onTutup={onTutupAksi}
          onSelesai={() => {
            onTutupAksi();
            onSelesai();
            setMuatKe((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
