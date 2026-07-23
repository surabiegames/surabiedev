"use client";

// features/dashboard/components/verifikasi/modal-mandiri.tsx — modal aksi
// verifikasi laporan mandiri: foto besar (zoom + geser) berdampingan dengan
// kotak stand yang bisa dikoreksi, lalu verify/reject.
//
// Koreksi bukan aksi simpan tersendiri: verifikator membetulkan angkanya di
// sini lalu menekan "Valid", dan satu permintaan verify itulah yang menulis
// angka final — ke laporan sekaligus ke PembacaanMeter resmi, jadi tidak
// pernah ada dua angka berbeda untuk satu laporan.
import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Separator } from "@workspace/ui/components/separator";
import { Spinner } from "@workspace/ui/components/spinner";
import { Textarea } from "@workspace/ui/components/textarea";
import { formatPeriode } from "@/features/public/lib/format";
import { kirimJson, ApiError } from "../../lib/api-client";
import type { LaporanMandiriDetail } from "./tipe";
import { Bagian } from "./panel-bagian";
import { DialogVerifikasi } from "./dialog-verifikasi";

export function ModalMandiri({
  detail,
  meterId,
  standLalu,
  blokTarif,
  tolakAwal,
  onTutup,
  onSelesai,
}: {
  detail: LaporanMandiriDetail;
  /** Meter aktif pelanggan — turunan, tidak dipilih verifikator. */
  meterId: string;
  standLalu: number;
  blokTarif: number;
  /** true = langsung mode tolak (dipicu aksi "Tolak" di menu klik kanan). */
  tolakAwal: boolean;
  onTutup: () => void;
  onSelesai: () => void;
}) {
  const [stand, setStand] = React.useState(String(detail.standDilaporkan));
  const [alasan, setAlasan] = React.useState("");
  const [modeTolak, setModeTolak] = React.useState(tolakAwal);
  const [mengirim, setMengirim] = React.useState(false);
  const [galat, setGalat] = React.useState<string | null>(null);

  const standNum = Number(stand);
  const standSiap = stand !== "" && Number.isFinite(standNum);
  const standLaluSiap = Number.isFinite(standLalu);
  const pemakaian = standSiap && standLaluSiap ? Math.max(0, standNum - standLalu) : null;
  const berubah = standSiap && standNum !== detail.standDilaporkan;

  async function jalankan(aksi: "verify" | "reject") {
    setMengirim(true);
    setGalat(null);
    try {
      if (aksi === "verify") {
        await kirimJson(`/laporan-mandiri/${detail.id}/verify`, "PATCH", {
          meterId,
          standLalu,
          blokTarif,
          standDilaporkan: standNum,
        });
      } else {
        await kirimJson(`/laporan-mandiri/${detail.id}/reject`, "PATCH", {
          alasanDitolak: alasan.trim(),
        });
      }
      onSelesai();
    } catch (err) {
      setGalat(err instanceof ApiError ? err.message : "Aksi gagal dijalankan.");
    } finally {
      setMengirim(false);
    }
  }

  return (
    <DialogVerifikasi
      buka
      onBuka={(v) => !v && onTutup()}
      judul={`Verifikasi stand — ${detail.pelanggan?.nama ?? detail.nomorLangganan}`}
      subjudul={`${formatPeriode(detail.periode)} · dilaporkan ${detail.namaPelapor} · cocokkan angka pada foto dengan kotak stand.`}
      fotoUrl={detail.fotoUrl}
      fotoLabel={`Foto meter — ${formatPeriode(detail.periode)}`}
    >
      <Bagian judul="Stand meter">
        <Input
          type="number"
          min={0}
          value={stand}
          onChange={(e) => setStand(e.target.value)}
          className="h-9 font-mono text-sm"
          aria-label="Stand meter"
        />
        <p className="text-[11px] text-muted-foreground">
          {berubah
            ? `Dikoreksi dari ${detail.standDilaporkan.toLocaleString("id-ID")}.`
            : "Koreksi bila pelapor salah input."}
        </p>
      </Bagian>

      <div className="flex items-baseline justify-between gap-2 border border-border/70 bg-muted/30 px-2.5 py-2">
        <span className="text-[9px] font-semibold tracking-widest text-muted-foreground uppercase">
          Pakai (m³)
        </span>
        <span className="font-mono text-sm font-bold tabular-nums text-foreground">
          {pemakaian?.toLocaleString("id-ID") ?? "—"}
        </span>
      </div>

      {/* Meter tujuan tidak dipilih manual, jadi ketiadaannya harus
          dijelaskan — kalau tidak, tombol verifikasi cuma mati tanpa sebab. */}
      {!meterId && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          Pelanggan ini belum punya meter terdaftar — verifikasi baru bisa
          dijalankan setelah meternya didaftarkan.
        </p>
      )}

      {modeTolak && (
        <Bagian judul="Alasan penolakan (wajib, dikirim ke pelapor)">
          <Textarea
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            rows={3}
            className="text-xs"
            placeholder="Mis. foto buram / angka stand tidak terbaca"
          />
        </Bagian>
      )}

      {galat && <p className="text-[11px] text-destructive">{galat}</p>}

      <Separator className="mt-auto" />

      {modeTolak ? (
        <div className="flex flex-col gap-1.5">
          <Button
            variant="destructive"
            className="h-9 w-full"
            disabled={mengirim || alasan.trim().length === 0}
            onClick={() => jalankan("reject")}
          >
            {mengirim && <Spinner className="size-3.5" />} Tolak laporan
          </Button>
          <Button
            variant="ghost"
            className="h-8 w-full"
            disabled={mengirim}
            onClick={() => setModeTolak(false)}
          >
            Batal
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Button
            className="h-9 w-full"
            disabled={mengirim || !meterId || !standSiap || !standLaluSiap}
            onClick={() => jalankan("verify")}
          >
            {mengirim && <Spinner className="size-3.5" />}
            {berubah ? "Simpan koreksi & jadikan resmi" : "Valid — jadikan pembacaan resmi"}
          </Button>
          <Button
            variant="outline"
            className="h-8 w-full"
            disabled={mengirim}
            onClick={() => setModeTolak(true)}
          >
            Tolak / minta foto ulang
          </Button>
        </div>
      )}
    </DialogVerifikasi>
  );
}
