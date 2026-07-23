// features/beranda/components/nav-links.ts — satu daftar tautan layanan
// publik, dipakai header desktop, sheet mobile, dan footer. Ubah di sini,
// ketiganya ikut.
export const NAV_LAYANAN = [
  { href: "/cek-tagihan", label: "Cek Tagihan", deskripsi: "Lihat tagihan & riwayat 12 periode" },
  { href: "/lapor-meter", label: "Lapor Meter", deskripsi: "Kirim angka meter + foto bukti" },
  { href: "/pengaduan", label: "Pengaduan", deskripsi: "Laporkan gangguan & lacak tiket" },
] as const
