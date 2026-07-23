"use client";

// features/dashboard/components/verifikasi/modal-lapangan.tsx — modal aksi
// V1 (ring pertama verifikasi berjenjang V1→V2→V3, lihat tabel.md): foto
// (bila ada) berdampingan dengan ST akhir revisi, meter tujuan, dan blok
// tarif. V2/V3 hanya persetujuan (dialog konfirmasi di halaman), jadi
// satu-satunya modal isian adalah V1 ini — plus mode "cek ulang" (tolak).
//
// Meter tujuan dipilih manual di V1: `nomorMeter` di laporan bisa
// duplikat/orphan (681 duplikat di data lapangan), jadi penentuan meter
// yang benar adalah keputusan verifikator, bukan tebakan sistem (lihat
// verif1Schema di server/modules/laporan/laporan-harian.router.ts).
// Revisi TIDAK menimpa angka catat petugas — keduanya tampil berdampingan
// di tabel (ST akhir catat vs ST akhir revisi); pembacaan resmi memakai
// revisi saat V3 approve.
//
// Modal ini hanya dirender saat aksi diminta (dari menu klik kanan), jadi
// state isian selalu mulai bersih di tiap pembukaan.
import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { NativeSelect } from "@workspace/ui/components/native-select";
import { Separator } from "@workspace/ui/components/separator";
import { Spinner } from "@workspace/ui/components/spinner";
import { Textarea } from "@workspace/ui/components/textarea";
import { formatPeriode } from "@/features/public/lib/format";
import { kirimJson, ApiError } from "../../lib/api-client";
import { LABEL_KONDISI_CATAT } from "../../lib/label";
import type { LaporanHarianDetail, MeterRingkas } from "./tipe";
import { Bagian } from "./panel-bagian";
import { DialogVerifikasi } from "./dialog-verifikasi";

export function ModalLapangan({
  detail,
  meters,
  meterAwal,
  tolakAwal,
  onTutup,
  onSelesai,
}: {
  detail: LaporanHarianDetail;
  meters: MeterRingkas[];
  /** Prapilih dari panel: meter yang nomornya cocok, lalu meter aktif. */
  meterAwal: string;
  /** true = langsung mode cek ulang (dipicu aksi "Cek ulang" di menu). */
  tolakAwal: boolean;
  onTutup: () => void;
  onSelesai: () => void;
}) {
  const [meterId, setMeterId] = React.useState(meterAwal);
  const [blokTarif, setBlokTarif] = React.useState(
    String(detail.blokTarifVerif ?? 1),
  );
  const [revisi, setRevisi] = React.useState(
    String(detail.standAkhirRevisi ?? detail.standAkhir),
  );
  const [kondisi, setKondisi] = React.useState(detail.kondisi);
  const [catatan, setCatatan] = React.useState("");
  const [modeTolak, setModeTolak] = React.useState(tolakAwal);
  const [mengirim, setMengirim] = React.useState(false);
  const [galat, setGalat] = React.useState<string | null>(null);

  const revisiNum = Number(revisi);
  const revisiSiap = revisi !== "" && Number.isFinite(revisiNum);
  const berubah = revisiSiap && revisiNum !== detail.standAkhir;
  const pemakaian = revisiSiap
    ? Math.max(0, revisiNum - detail.standAwal)
    : null;

  async function jalankan(aksi: "verif1" | "reject") {
    setMengirim(true);
    setGalat(null);
    try {
      if (aksi === "verif1") {
        await kirimJson(`/laporan-harian/${detail.id}/verif1`, "PATCH", {
          meterId,
          blokTarif: Number(blokTarif),
          catatanVerif: catatan.trim() || undefined,
          // Revisi hanya dikirim bila benar-benar beda dari angka catat —
          // angka sama bukan koreksi, kolom revisi di tabel tetap kosong.
          standAkhirRevisi: berubah ? revisiNum : null,
          // Kondisi hanya dikirim bila dikoreksi — undefined = tidak diubah.
          kondisi: kondisi !== detail.kondisi ? kondisi : undefined,
        });
      } else {
        await kirimJson(`/laporan-harian/${detail.id}/reject`, "PATCH", {
          catatanVerif: catatan.trim(),
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
      judul={`Verifikasi V1 — ${detail.pelanggan?.nama ?? detail.namaPelanggan ?? detail.nomorLangganan}`}
      subjudul={`${formatPeriode(detail.periode)} · ${detail.pencatat?.namaLapangan ?? "pencatat tidak diketahui"} · stand catat ${detail.standAwal.toLocaleString("id-ID")} → ${detail.standAkhir.toLocaleString("id-ID")}.`}
      fotoLabel={`Foto meter — ${formatPeriode(detail.periode)}`}
      fotos={[
        {
          kunci: "stand",
          label: "Stand meter",
          url: detail.fotoStandUrl ?? detail.pembacaan?.fotoBukti,
          keteranganKosong:
            "Laporan petugas dari sistem lama tidak menyertakan foto — koreksi mengacu pada histori pemakaian.",
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
    >
      <Bagian judul="ST akhir revisi">
        <Input
          type="number"
          min={0}
          value={revisi}
          onChange={(e) => setRevisi(e.target.value)}
          className="h-9 font-mono text-sm"
          aria-label="Stand akhir revisi"
        />
        <p className="text-[11px] text-muted-foreground">
          {berubah
            ? `Revisi dari angka catat ${detail.standAkhir.toLocaleString("id-ID")} — angka catat tetap tersimpan.`
            : "Samakan dengan angka catat bila petugas benar; ubah bila salah input."}
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

      <Bagian judul="Meter tujuan">
        <NativeSelect
          value={meterId}
          onChange={(e) => setMeterId(e.currentTarget.value)}
          className="h-8 text-xs"
        >
          {meters.length === 0 && (
            <option value="">Pelanggan belum punya meter terdaftar</option>
          )}
          {meters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nomorMeter}
              {m.merkKode ? ` · ${m.merkKode}` : ""}{" "}
              {m.isAktif ? "(aktif)" : "(histori)"}
            </option>
          ))}
        </NativeSelect>
      </Bagian>

      <Bagian judul="Blok tarif">
        <NativeSelect
          value={blokTarif}
          onChange={(e) => setBlokTarif(e.currentTarget.value)}
          className="h-8 text-xs"
        >
          {[1, 2, 3, 4].map((b) => (
            <option key={b} value={b}>
              Blok {b}
            </option>
          ))}
        </NativeSelect>
      </Bagian>

      <Bagian judul="Keterangan catat">
        <NativeSelect
          value={kondisi}
          onChange={(e) => setKondisi(e.currentTarget.value)}
          className="h-8 text-xs"
        >
          {Object.entries(LABEL_KONDISI_CATAT).map(([kode, nama]) => (
            <option key={kode} value={kode}>
              {nama}
            </option>
          ))}
        </NativeSelect>
        {kondisi !== detail.kondisi && (
          <p className="text-[11px] text-muted-foreground">
            Dikoreksi dari “{LABEL_KONDISI_CATAT[detail.kondisi] ?? detail.kondisi}”.
          </p>
        )}
      </Bagian>

      <Bagian judul={modeTolak ? "Alasan cek ulang (wajib)" : "Catatan (opsional)"}>
        <Textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          rows={2}
          className="text-xs"
          placeholder={
            modeTolak
              ? "Mis. angka stand tidak sesuai foto/riwayat"
              : "Catatan verifikasi"
          }
        />
      </Bagian>

      {galat && <p className="text-[11px] text-destructive">{galat}</p>}

      <Separator className="mt-auto" />

      {modeTolak ? (
        <div className="flex flex-col gap-1.5">
          <Button
            variant="destructive"
            className="h-9 w-full"
            disabled={mengirim || catatan.trim().length === 0}
            onClick={() => jalankan("reject")}
          >
            {mengirim && <Spinner className="size-3.5" />} Kirim untuk cek ulang
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
            disabled={mengirim || !meterId || !revisiSiap}
            onClick={() => jalankan("verif1")}
          >
            {mengirim && <Spinner className="size-3.5" />}
            {berubah ? "Simpan revisi & tandai V1" : "Valid — tandai V1"}
          </Button>
          <Button
            variant="outline"
            className="h-8 w-full"
            disabled={mengirim}
            onClick={() => setModeTolak(true)}
          >
            Cek ulang
          </Button>
        </div>
      )}
    </DialogVerifikasi>
  );
}
