// app/(public)/lapor-meter/page.tsx — /lapor-meter
//
// Page tipis: metadata + rakit fitur lewat kerangka HalamanPublik (satu
// bahasa visual dengan beranda). Lihat FRONTEND.md.
import type { Metadata } from "next";
import { LaporMeterForm } from "@/features/public/components/lapor-meter-form";
import {
  HalamanPublik,
  AsideBlok,
  LangkahList,
  KartuBerbingkai,
} from "@/features/public/components/halaman-publik";

export const metadata: Metadata = {
  title: "Lapor meter mandiri",
  description:
    "Laporkan sendiri angka meter air Anda ke PERUMDA Tirtawening Kota Bandung",
};

const LANGKAH = [
  {
    judul: "Cari nomor langganan Anda",
    detail:
      "Ketik 11 digit nomor — identitas sambungan muncul otomatis untuk dicocokkan.",
  },
  {
    judul: "Foto meter & isi angkanya",
    detail:
      "Potret angka hitam pada meter air sebagai bukti, lalu tulis angkanya.",
  },
  {
    judul: "Petugas memverifikasi",
    detail:
      "Laporan berstatus menunggu sampai foto dicek petugas — baru menjadi dasar tagihan.",
  },
] as const;

export default function LaporMeterPage() {
  return (
    <HalamanPublik
      eyebrow="Layanan Mandiri · 24 Jam"
      judul="Laporkan angka meter Anda — biar tagihan sesuai pemakaian."
      lede="Petugas tidak sempat mampir bulan ini? Kirim sendiri angka meter beserta foto bukti. Satu laporan per bulan, diverifikasi petugas sebelum dipakai menghitung tagihan."
      aside={
        <>
          <AsideBlok label="Cara kerjanya">
            <LangkahList langkah={LANGKAH} />
          </AsideBlok>

          <AsideBlok label="Syarat foto">
            <ul className="list-inside space-y-1.5">
              <li>Angka pada meter terbaca jelas, tidak buram.</li>
              <li>
                Format JPG, PNG, atau WEBP — foto besar dikecilkan otomatis.
              </li>
              <li>Abaikan angka merah; yang dilaporkan angka hitam.</li>
            </ul>
          </AsideBlok>
        </>
      }
    >
      <KartuBerbingkai
        label="Formulir · Lapor Meter"
        chip="1 Laporan / Bulan"
        className="p-0"
      >
        <LaporMeterForm />
      </KartuBerbingkai>
    </HalamanPublik>
  );
}
