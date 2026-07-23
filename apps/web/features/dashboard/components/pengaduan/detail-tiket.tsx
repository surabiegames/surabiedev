"use client";

// features/dashboard/components/pengaduan/detail-tiket.tsx — HALAMAN detail
// satu tiket (/dashboard/pengaduan/[id]), menggantikan PanelTiket yang dulu
// hidup di Sheet samping: detail tiket terlalu kompleks (duduk perkara,
// wilayah, chat, penyelesaian berfoto, eskalasi, linimasa penuh) untuk
// lebar satu sheet. Tata letak dua kolom: kiri = perkara + linimasa,
// kanan = seluruh aksi penanganan (sticky).
//
// Dua hal yang sengaja diserahkan ke server, JANGAN dipindahkan ke sini:
//  1. `transisiTersedia` — dari matriks TRANSISI server (sudah disaring per
//     role pemanggil). Menyalin matriksnya = dua sumber yang menyimpang.
//  2. `sla` — perhitungan terlambat/sisa waktu datang jadi dari server.
//
// SELESAI diperlakukan KHUSUS (blok "Selesaikan tiket"): server mewajibkan
// catatanPenyelesaian + fotoPenyelesaianUrl, jadi tombol generiknya
// disembunyikan dan diganti alur unggah foto → PATCH status.
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpCircle,
  CheckCircle2,
  CircleUser,
  Clock,
  ImageIcon,
  Lock,
  MapPin,
  MessageCircle,
  MessageSquarePlus,
  Send,
  Star,
  TriangleAlert,
  UserCheck,
  Video,
} from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { BingkaiFoto } from "@/components/bingkai-foto";
import { BingkaiVideo } from "@/components/bingkai-video";
import { Button } from "@workspace/ui/components/button";
import { NativeSelect } from "@workspace/ui/components/native-select";
import { Separator } from "@workspace/ui/components/separator";
import { Spinner } from "@workspace/ui/components/spinner";
import { Switch } from "@workspace/ui/components/switch";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { Input } from "@workspace/ui/components/input";
import {
  formatSisaWaktu,
  formatWaktu,
  LABEL_JENIS_PENGADUAN,
  statusPengaduanTampilan,
  urlVideoTeroptimasi,
} from "@/features/public/lib/format";
import { ambilSatu, kirimJson, kirimForm, ApiError } from "../../lib/api-client";
import { LABEL_PRIORITAS_PENGADUAN } from "../../lib/label";
import type { PengaduanDetail, PetugasRingkas, StatusPengaduan } from "./tipe";
import { LinimasaStaf } from "./linimasa-staf";

/// Status yang TIDAK boleh muncul sebagai tombol status generik:
///  - DITUTUP & DIBUKA_KEMBALI: hak PELAPOR; backend menolaknya eksplisit.
///  - DITUGASKAN: punya jalur sendiri (dropdown + Tugaskan) — tombol generik
///    akan memindahkan status TANPA ditugaskanKeId (keadaan separuh jadi).
///  - SELESAI: punya blok sendiri (wajib catatan + foto bukti).
const BUKAN_TOMBOL_STATUS: StatusPengaduan[] = [
  "DITUTUP",
  "DIBUKA_KEMBALI",
  "DITUGASKAN",
  "SELESAI",
];

function Baris({
  ikon: Ikon,
  label,
  children,
}: {
  ikon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Ikon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <div className="text-sm wrap-break-words">{children}</div>
      </div>
    </div>
  );
}

function JudulBagian({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export function DetailTiket({ pengaduanId }: { pengaduanId: string }) {
  const router = useRouter();
  const [detail, setDetail] = React.useState<PengaduanDetail | null>(null);
  const [petugas, setPetugas] = React.useState<PetugasRingkas[]>([]);
  const [memuat, setMemuat] = React.useState(true);
  const [galat, setGalat] = React.useState<string | null>(null);
  const [mengirim, setMengirim] = React.useState(false);

  const [catatan, setCatatan] = React.useState("");
  const [catatanPublik, setCatatanPublik] = React.useState(false);
  const [pilihPetugas, setPilihPetugas] = React.useState("");
  const [pesanChat, setPesanChat] = React.useState("");

  const [catatanSelesai, setCatatanSelesai] = React.useState("");
  const [fotoBukti, setFotoBukti] = React.useState<File | null>(null);

  const [pilihAtasan, setPilihAtasan] = React.useState("");
  const [alasanEskalasi, setAlasanEskalasi] = React.useState("");
  const [prioritasEskalasi, setPrioritasEskalasi] = React.useState("");

  const muat = React.useCallback(async () => {
    try {
      setDetail(await ambilSatu<PengaduanDetail>(`/pengaduan/${pengaduanId}`));
      setGalat(null);
    } catch (err) {
      setGalat(err instanceof ApiError ? err.message : "Gagal memuat detail tiket.");
    }
  }, [pengaduanId]);

  React.useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const row = await ambilSatu<PengaduanDetail>(`/pengaduan/${pengaduanId}`);
        if (batal) return;
        setDetail(row);
        setGalat(null);
      } catch (err) {
        if (!batal) setGalat(err instanceof ApiError ? err.message : "Gagal memuat detail tiket.");
      } finally {
        if (!batal) setMemuat(false);
      }
    })();
    return () => {
      batal = true;
    };
  }, [pengaduanId]);

  // Sumbernya /pengaduan/petugas, BUKAN /users — /users dibatasi
  // MANAGEMENT_UP sementara menugaskan tiket cuma butuh SUPERVISOR_UP.
  React.useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const rows = await ambilSatu<PetugasRingkas[]>("/pengaduan/petugas");
        if (!batal) setPetugas(rows);
      } catch {
        // Dropdown kosong sudah cukup menjelaskan dirinya; aksi lain tetap
        // berguna.
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  async function jalankan(aksi: () => Promise<unknown>) {
    setMengirim(true);
    setGalat(null);
    try {
      await aksi();
      await muat();
      setCatatan("");
    } catch (err) {
      setGalat(err instanceof ApiError ? err.message : "Aksi gagal. Coba lagi.");
    } finally {
      setMengirim(false);
    }
  }

  if (memuat && !detail) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
        <TriangleAlert className="size-6 text-destructive" />
        <p className="text-sm text-muted-foreground">{galat ?? "Tiket tidak ditemukan."}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/pengaduan")}>
          <ArrowLeft /> Kembali ke daftar
        </Button>
      </div>
    );
  }

  const status = statusPengaduanTampilan(detail.status);
  const transisi = detail.transisiTersedia.filter((s) => !BUKAN_TOMBOL_STATUS.includes(s));
  const bisaSelesai = detail.transisiTersedia.includes("SELESAI");
  const bisaChat = detail.status !== "DITUTUP";

  return (
    <div className="flex flex-col gap-5">
      {/* ── Kepala halaman ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="icon-sm" asChild aria-label="Kembali ke daftar pengaduan">
              <Link href="/dashboard/pengaduan">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <code className="font-mono text-base font-semibold tracking-wider">{detail.nomorTiket}</code>
            <Badge variant="outline" className={status.badgeClass}>
              {status.label}
            </Badge>
            {detail.prioritas === "DARURAT" || detail.prioritas === "TINGGI" ? (
              <Badge variant="destructive">{LABEL_PRIORITAS_PENGADUAN[detail.prioritas]}</Badge>
            ) : null}
            {detail.jumlahDibukaKembali > 0 && (
              <Badge
                variant="outline"
                className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-400"
              >
                Dibuka kembali {detail.jumlahDibukaKembali}×
              </Badge>
            )}
          </div>
          <h2 className="mt-2 text-lg font-semibold">{detail.judul}</h2>
          <p className="text-sm text-muted-foreground">
            {LABEL_JENIS_PENGADUAN[detail.jenis] ?? detail.jenis} · masuk {formatWaktu(detail.createdAt)} WIB
          </p>
        </div>
      </div>

      {detail.sla.melanggar && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>Tiket ini melewati target penyelesaian — {formatSisaWaktu(detail.sla.sisaMenit)}.</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ── Kolom kiri: duduk perkara + linimasa ─────────────────── */}
        <div className="flex min-w-0 flex-col gap-5">
          <p className="text-sm whitespace-pre-wrap">{detail.deskripsi}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Baris ikon={CircleUser} label="Pelapor">
              <p>{detail.pelapor}</p>
              {/* Kontak pelapor tampil di sini (sisi petugas), TIDAK pernah
                  di halaman publik. */}
              {detail.kontakPelapor && <p className="text-muted-foreground">{detail.kontakPelapor}</p>}
              {detail.pelanggan && (
                <p className="font-mono text-xs text-muted-foreground">
                  {detail.pelanggan.nomorLangganan} · {detail.pelanggan.nama}
                </p>
              )}
              {!detail.pelanggan && detail.nomorLangganan && (
                <p className="font-mono text-xs text-muted-foreground">
                  {detail.nomorLangganan} (belum dicocokkan)
                </p>
              )}
            </Baris>

            <Baris ikon={Clock} label="Target penyelesaian">
              <p>{formatWaktu(detail.sla.targetSelesaiAt)} WIB</p>
              <p className={detail.sla.melanggar ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>
                {formatSisaWaktu(detail.sla.sisaMenit)}
                {detail.sla.terjeda && " · dijeda"}
              </p>
            </Baris>

            <Baris ikon={UserCheck} label="Ditugaskan ke">
              <p>{detail.ditugaskanKe?.name ?? "— belum ditugaskan"}</p>
            </Baris>

            <Baris ikon={MapPin} label="Lokasi kejadian">
              <p>{detail.alamatKejadian ?? "—"}</p>
              {/* Wilayah hasil auto-tag ST_Contains — bantu operator memilah
                  antrean per wilayah kerja tanpa menebak dari alamat teks. */}
              {(detail.kelurahan || detail.kecamatan) && (
                <p className="text-muted-foreground">
                  {[detail.kelurahan?.nama, detail.kecamatan?.nama].filter(Boolean).join(", ")}
                </p>
              )}
            </Baris>

            {detail.eskalasiKe && (
              <Baris ikon={ArrowUpCircle} label="Dieskalasi ke">
                <p>
                  {detail.eskalasiKe.name ?? "—"}
                  <span className="text-muted-foreground"> · {detail.eskalasiKe.role}</span>
                </p>
                {detail.alasanEskalasi && <p className="text-muted-foreground">{detail.alasanEskalasi}</p>}
              </Baris>
            )}

            {detail.status === "SELESAI" && detail.konfirmasiBatasAt && (
              <Baris ikon={Clock} label="Batas konfirmasi pelapor">
                <p>{formatWaktu(detail.konfirmasiBatasAt)} WIB</p>
                <p className="text-muted-foreground">Lewat batas ini tiket ditutup otomatis.</p>
              </Baris>
            )}

            {detail.ratingKepuasan !== null && (
              <Baris ikon={Star} label="Penilaian pelapor">
                <p className="flex items-center gap-1">
                  {detail.ratingKepuasan}/5
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                </p>
                {detail.komentarKepuasan && (
                  <p className="text-muted-foreground">“{detail.komentarKepuasan}”</p>
                )}
              </Baris>
            )}
          </div>

          {(detail.fotoUrl || detail.videoUrl || detail.fotoPenyelesaianUrl) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* BingkaiFoto/BingkaiVideo: frame rasio tetap — tinggi halaman
                  TIDAK ditentukan dimensi file; klik foto untuk melihat utuh. */}
              {detail.fotoUrl && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    <ImageIcon className="size-3.5" /> Foto dari pelapor
                  </p>
                  <BingkaiFoto src={detail.fotoUrl} alt="Foto bukti dari pelapor" />
                </div>
              )}
              {detail.videoUrl && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    <Video className="size-3.5" /> Video dari pelapor
                  </p>
                  <BingkaiVideo src={urlVideoTeroptimasi(detail.videoUrl)!} />
                </div>
              )}
              {detail.fotoPenyelesaianUrl && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    <CheckCircle2 className="size-3.5" /> Foto bukti penyelesaian
                  </p>
                  <BingkaiFoto src={detail.fotoPenyelesaianUrl} alt="Foto bukti penyelesaian dari petugas" />
                </div>
              )}
            </div>
          )}

          <Separator />

          <div>
            <p className="mb-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Riwayat tindak lanjut
            </p>
            <LinimasaStaf riwayat={detail.riwayat} />
          </div>
        </div>

        {/* ── Kolom kanan: seluruh aksi (sticky) ───────────────────── */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <JudulBagian>Tindakan</JudulBagian>

            <div className="flex gap-2">
              <NativeSelect
                value={pilihPetugas}
                onChange={(e) => setPilihPetugas(e.currentTarget.value)}
                disabled={mengirim}
                aria-label="Pilih petugas"
              >
                <option value="">Pilih petugas…</option>
                {petugas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name ?? p.id} · {p.role}
                  </option>
                ))}
              </NativeSelect>
              <Button
                size="sm"
                className="shrink-0"
                disabled={mengirim || !pilihPetugas}
                onClick={() =>
                  jalankan(() =>
                    kirimJson(`/pengaduan/${detail.id}/tugaskan`, "PATCH", {
                      ditugaskanKeId: pilihPetugas,
                      catatan: catatan.trim() || undefined,
                    }),
                  )
                }
              >
                <UserCheck />
                Tugaskan
              </Button>
            </div>

            <Textarea
              rows={3}
              placeholder="Catatan tindak lanjut… (dipakai oleh tombol di bawah)"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              disabled={mengirim}
            />

            <div className="flex items-center gap-2">
              <Switch
                id="catatan-publik"
                checked={catatanPublik}
                onCheckedChange={setCatatanPublik}
                disabled={mengirim}
              />
              <Label htmlFor="catatan-publik" className="flex items-center gap-1.5 text-xs">
                {catatanPublik ? (
                  <>
                    <MessageSquarePlus className="size-3.5" /> Terlihat oleh pelapor
                  </>
                ) : (
                  <>
                    <Lock className="size-3.5" /> Catatan internal
                  </>
                )}
              </Label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={mengirim || !catatan.trim()}
                onClick={() =>
                  jalankan(() =>
                    kirimJson(`/pengaduan/${detail.id}/catatan`, "POST", {
                      catatan: catatan.trim(),
                      isPublik: catatanPublik,
                    }),
                  )
                }
              >
                {mengirim ? <Spinner className="size-3.5" /> : <Send />}
                Tambah catatan
              </Button>

              {transisi.map((s) => {
                const tampil = statusPengaduanTampilan(s);
                return (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === "DITOLAK" ? "destructive" : "secondary"}
                    disabled={mengirim}
                    onClick={() =>
                      jalankan(() =>
                        kirimJson(`/pengaduan/${detail.id}/status`, "PATCH", {
                          status: s,
                          catatan: catatan.trim() || undefined,
                          isPublik: true,
                        }),
                      )
                    }
                  >
                    {tampil.label}
                  </Button>
                );
              })}
            </div>

            {transisi.length === 0 && !bisaSelesai && (
              <p className="text-xs text-muted-foreground">
                Status tiket ini sudah final — tidak ada transisi yang tersedia.
              </p>
            )}
          </div>

          {/* SELESAI: catatan + foto bukti WAJIB (aturan server) — foto
              diunggah dulu ke /pengaduan/foto, URL-nya ikut PATCH status. */}
          {bisaSelesai && (
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 p-4 dark:border-emerald-900">
              <JudulBagian>Selesaikan tiket</JudulBagian>
              <Textarea
                rows={2}
                placeholder="Ringkasan penyelesaian (wajib, dibaca pelapor)…"
                value={catatanSelesai}
                onChange={(e) => setCatatanSelesai(e.target.value)}
                disabled={mengirim}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="foto-bukti" className="text-xs text-muted-foreground">
                  Foto bukti hasil pekerjaan (wajib)
                </Label>
                <Input
                  id="foto-bukti"
                  type="file"
                  accept="image/*"
                  disabled={mengirim}
                  onChange={(e) => setFotoBukti(e.currentTarget.files?.[0] ?? null)}
                />
              </div>
              <Button
                size="sm"
                className="self-start"
                disabled={mengirim || !catatanSelesai.trim() || !fotoBukti}
                onClick={() =>
                  jalankan(async () => {
                    const form = new FormData();
                    form.set("nomorTiket", detail.nomorTiket);
                    form.set("foto", fotoBukti!);
                    const hasil = await kirimForm<{ url: string; publicId: string }>(
                      "/pengaduan/foto",
                      form,
                    );
                    await kirimJson(`/pengaduan/${detail.id}/status`, "PATCH", {
                      status: "SELESAI",
                      catatanPenyelesaian: catatanSelesai.trim(),
                      fotoPenyelesaianUrl: hasil.url,
                      fotoPenyelesaianPublicId: hasil.publicId,
                      isPublik: true,
                    });
                    setCatatanSelesai("");
                    setFotoBukti(null);
                  })
                }
              >
                {mengirim ? <Spinner className="size-3.5" /> : <CheckCircle2 />}
                Tandai selesai
              </Button>
              <p className="text-xs text-muted-foreground">
                Pelapor melihat catatan & foto ini di halaman pelacakan, lalu mengonfirmasi (atau
                membantah) — tiket TIDAK bisa ditutup dari sisi petugas.
              </p>
            </div>
          )}

          {/* Chat dua arah dengan pelapor — SELALU publik, tampil sebagai
              percakapan di halaman pelacakan warga & app mobile. */}
          {bisaChat && (
            <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
              <JudulBagian>Chat dengan pelapor</JudulBagian>
              <div className="flex gap-2">
                <Input
                  placeholder="Tulis pesan untuk pelapor…"
                  value={pesanChat}
                  onChange={(e) => setPesanChat(e.target.value)}
                  disabled={mengirim}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pesanChat.trim() && !mengirim) {
                      void jalankan(async () => {
                        await kirimJson(`/pengaduan/${detail.id}/chat`, "POST", {
                          pesan: pesanChat.trim(),
                        });
                        setPesanChat("");
                      });
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="shrink-0"
                  disabled={mengirim || !pesanChat.trim()}
                  onClick={() =>
                    jalankan(async () => {
                      await kirimJson(`/pengaduan/${detail.id}/chat`, "POST", {
                        pesan: pesanChat.trim(),
                      });
                      setPesanChat("");
                    })
                  }
                >
                  <MessageCircle />
                  Kirim
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Pesan chat selalu terlihat pelapor (beda dari catatan internal). Balasannya masuk ke
                riwayat sebagai “Chat”.
              </p>
            </div>
          )}

          {detail.status !== "DITUTUP" && (
            <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
              <JudulBagian>Eskalasi ke atasan</JudulBagian>
              <div className="flex gap-2">
                <NativeSelect
                  value={pilihAtasan}
                  onChange={(e) => setPilihAtasan(e.currentTarget.value)}
                  disabled={mengirim}
                  aria-label="Pilih atasan untuk eskalasi"
                >
                  <option value="">Pilih atasan…</option>
                  {petugas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name ?? p.id} · {p.role}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect
                  value={prioritasEskalasi}
                  onChange={(e) => setPrioritasEskalasi(e.currentTarget.value)}
                  disabled={mengirim}
                  className="w-40 shrink-0"
                  aria-label="Naikkan prioritas (opsional)"
                >
                  <option value="">Prioritas tetap</option>
                  {Object.entries(LABEL_PRIORITAS_PENGADUAN).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Textarea
                rows={2}
                placeholder="Alasan eskalasi… (mis. butuh alat berat / keputusan anggaran)"
                value={alasanEskalasi}
                onChange={(e) => setAlasanEskalasi(e.target.value)}
                disabled={mengirim}
              />
              <Button
                size="sm"
                variant="outline"
                className="self-start"
                disabled={mengirim || !pilihAtasan || !alasanEskalasi.trim()}
                onClick={() =>
                  jalankan(async () => {
                    await kirimJson(`/pengaduan/${detail.id}/eskalasi`, "PATCH", {
                      eskalasiKeId: pilihAtasan,
                      alasan: alasanEskalasi.trim(),
                      prioritasBaru: prioritasEskalasi || undefined,
                    });
                    setPilihAtasan("");
                    setAlasanEskalasi("");
                    setPrioritasEskalasi("");
                  })
                }
              >
                <ArrowUpCircle />
                Eskalasi
              </Button>
            </div>
          )}

          {galat && (
            <p className="text-xs text-destructive" role="alert">
              {galat}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
