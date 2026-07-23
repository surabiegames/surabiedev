"use client";

// features/dashboard/components/verifikasi/panel-mandiri.tsx — panel kiri
// halaman verifikasi laporan mandiri pelanggan (dari halaman publik
// /lapor-meter, selalu berfoto).
//
// Panel ini MURNI PENAMPIL DETAIL — tidak ada kotak isian maupun tombol
// aksi; satu-satunya interaksi adalah melihat peta dan memperbesar foto.
// Aksi (verifikasi/koreksi, tolak, batalkan) dipicu dari MENU KLIK KANAN
// pada baris tabel; halaman meneruskan pilihan lewat prop `aksi` dan panel
// merender ModalMandiri begitu detailnya siap.
//
// Meter tujuan, stand lalu, dan blok tarif tidak pernah ditampilkan:
// ketiganya turunan mekanis (meter aktif pelanggan; stand lalu + blok tarif
// dari pembacaan resmi terakhir meter itu). Tidak ada keputusan manusia di
// sana, jadi menampilkannya cuma menambah bidang yang harus dilewati —
// tetap dihitung diam-diam dan dikirim saat verify.
import * as React from "react";
import { CheckCircle2, MousePointerClick } from "lucide-react";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { formatPeriode, formatTanggal } from "@/features/public/lib/format";
import { ambilSatu, ambilList, ApiError } from "../../lib/api-client";
import type {
  LaporanMandiriDetail,
  MeterRingkas,
  PembacaanRingkas,
} from "./tipe";
import { BadgeStatusVerif, Bagian, GridStand, PanelKosong } from "./panel-bagian";
import { FotoBukti } from "./foto-bukti";
import { FotoSebelumnya } from "./foto-sebelumnya";
import { HistoriPemakaian } from "./histori-pemakaian";
import { PetaLokasi } from "./peta-lokasi";
import { ModalMandiri } from "./modal-mandiri";

export type AksiMandiri = "verify" | "tolak";

export function PanelMandiri({
  id,
  aksi,
  onTutupAksi,
  onSelesai,
}: {
  id: string | null;
  /** Aksi dari menu klik kanan yang butuh modal; null = tidak ada modal. */
  aksi: AksiMandiri | null;
  onTutupAksi: () => void;
  onSelesai: () => void;
}) {
  const [detail, setDetail] = React.useState<LaporanMandiriDetail | null>(null);
  const [galat, setGalat] = React.useState<string | null>(null);
  // Pemicu muat ulang setelah aksi. State awal selalu bersih tiap ganti
  // baris karena parent me-remount panel lewat `key` — tidak ada reset
  // sinkron di effect (dilarang react-hooks/set-state-in-effect).
  const [muatKe, setMuatKe] = React.useState(0);

  const [meterId, setMeterId] = React.useState("");
  const [standLalu, setStandLalu] = React.useState("");
  const [blokTarif, setBlokTarif] = React.useState("1");

  React.useEffect(() => {
    if (!id) return;
    let batal = false;
    (async () => {
      try {
        const row = await ambilSatu<LaporanMandiriDetail>(
          `/laporan-mandiri/${id}`,
        );
        if (batal) return;
        setDetail(row);
        setGalat(null);
        const { rows } = await ambilList<MeterRingkas>("/meter", {
          pelangganId: row.pelangganId,
          pageSize: 100,
        });
        if (batal) return;
        setMeterId((rows.find((m) => m.isAktif) ?? rows[0])?.id ?? "");
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

  // Prefill stand lalu & blok tarif dari pembacaan resmi terakhir meter
  // terpilih — berganti meter berarti berganti riwayat stand.
  React.useEffect(() => {
    if (!meterId) return;
    let batal = false;
    ambilList<PembacaanRingkas>("/pembacaan", { meterId, pageSize: 1 })
      .then(({ rows }) => {
        if (batal) return;
        setStandLalu(rows[0] ? String(rows[0].standAkhir) : "0");
        setBlokTarif(rows[0] ? String(rows[0].blokTarif) : "1");
      })
      .catch(() => {
        if (!batal) setStandLalu("0");
      });
    return () => {
      batal = true;
    };
  }, [meterId]);

  if (!id) {
    return (
      <PanelKosong
        icon={MousePointerClick}
        pesan="Klik baris untuk melihat detail; klik kanan baris untuk aksi verifikasi, tolak, atau batalkan."
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

  const standLaluNum = Number(standLalu);
  const pemakaian =
    standLalu !== "" && Number.isFinite(standLaluNum)
      ? Math.max(0, detail.standDilaporkan - standLaluNum)
      : null;
  // Pagar kedua — menu klik kanan sudah menyaring status MENUNGGU.
  const bisaModal = detail.status === "MENUNGGU";

  return (
    <div className="flex flex-col gap-3.5 p-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            {detail.pelanggan?.nama ?? "—"}
          </p>
          <BadgeStatusVerif status={detail.status} />
        </div>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {detail.nomorLangganan}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatPeriode(detail.periode)} · dilaporkan{" "}
          {formatTanggal(detail.createdAt)}
        </p>
        {detail.pelanggan?.alamat && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {detail.pelanggan.alamat}
          </p>
        )}
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Pelapor: {detail.namaPelapor} · {detail.nomorPelapor}
        </p>
      </div>

      <Separator />

      {/* Urutan panel mengikuti panel lapangan: detail → stand → histori
          3 bulan → foto sebelumnya (pembanding) → foto periode berjalan →
          lokasi. */}
      <GridStand
        sel={[
          { label: "Stand meter", nilai: detail.standDilaporkan },
          { label: "Pakai (m³)", nilai: pemakaian ?? 0 },
        ]}
      />

      <Separator />

      <Bagian judul="Histori pencatatan (3 bulan terakhir)">
        <HistoriPemakaian pelangganId={detail.pelangganId} />
      </Bagian>

      <Bagian judul="Foto periode sebelumnya (pembanding)">
        <FotoSebelumnya
          pelangganId={detail.pelangganId}
          periode={detail.periode}
        />
      </Bagian>

      <Bagian judul="Foto periode berjalan (bukti pelapor)">
        <FotoBukti
          url={detail.fotoUrl}
          label={`Foto meter — ${formatPeriode(detail.periode)}`}
        />
      </Bagian>

      <Bagian judul="Lokasi">
        <PetaLokasi
          lat={detail.pelanggan?.geoLat}
          lng={detail.pelanggan?.geoLong}
        />
      </Bagian>

      <Separator />

      {(detail.status === "DIVERIFIKASI" || detail.status === "DIGUNAKAN") && (
        <p className="inline-flex items-start gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          Sudah menjadi pembacaan resmi
          {detail.verifiedBy?.name
            ? ` — diverifikasi ${detail.verifiedBy.name}`
            : ""}
          {detail.verifiedAt ? ` (${formatTanggal(detail.verifiedAt)})` : ""}.
        </p>
      )}
      {detail.status === "DITOLAK" && (
        <p className="text-[11px] text-muted-foreground">
          Ditolak
          {detail.verifiedBy?.name ? ` oleh ${detail.verifiedBy.name}` : ""}
          {detail.alasanDitolak ? ` — “${detail.alasanDitolak}”` : ""}.
        </p>
      )}

      {aksi && bisaModal && (
        <ModalMandiri
          detail={detail}
          meterId={meterId}
          standLalu={standLaluNum}
          blokTarif={Number(blokTarif)}
          tolakAwal={aksi === "tolak"}
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
