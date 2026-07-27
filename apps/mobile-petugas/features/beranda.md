# Redesign beranda — Pencatat Meter

Spesifikasi tata letak dan warna untuk layar beranda aplikasi Pencatat Meter, disesuaikan dengan `MasterPalette` (5 warna paten: Emerald, Teal, Sky, Slate, Rose).

## Pemetaan warna

Semua warna diambil dari `MasterPalette` / `AppAccents` yang sudah ada — tidak ada hue baru.

| Elemen | Warna | Sumber token |
|---|---|---|
| Header background (gradient) | Emerald → Sky 600 | `AppGradients.petugas` |
| Ring progres (terisi) | Emerald 500 | `MasterPalette.emerald` |
| Ring progres (kosong) | Slate 200 | `MasterPalette.slate200` |
| Badge "Offline" bg / teks | Rose 100 / Rose 700 | `MasterPalette.rose100` / `rose700` |
| Card "Dicatat saya" (border kiri) | Emerald 500 | `MasterPalette.emerald` |
| Card "Antre kirim" (border kiri) | Sky 400 | `MasterPalette.sky` |
| Banner "Penyimpanan aman" | Emerald 50 bg / Emerald 700 teks | `emerald50` / `emerald700` |
| Icon "Baca meter" | Emerald 500 | `AppAccents.hijau` |
| Icon "Upload" | Rose 500 | `AppAccents.merah` |
| Icon menu sekunder (Download, Riwayat, dst) | Slate 500 | `AppAccents.ungu` (slate) |
| Teks sekunder / label kecil | Slate 500 | `MasterPalette.slate500` |
| Teks muted / caption | Slate 400 | `MasterPalette.slate` |
| Border / divider | Slate 200 | `MasterPalette.slate200` |
| Background card | Putih / Slate 50 | `slate50` |
| Nomor urut rute (box) | Slate 100 bg / Slate 700 teks | `slate100` / `slate700` |

Catatan: warna "amber" pada `AppAccents` sudah dialihkan ke Rose sesuai keputusan produk 2026-07-19 — jadi badge peringatan apa pun (termasuk status Offline) pakai rumpun Rose, bukan kuning/oranye.

## Struktur & ukuran (dp, untuk Expo / React Native)

### Container & spacing
```
Screen padding horizontal    : 16
Card border radius (besar)   : 16
Card border radius (kecil)   : 12
Gap antar card grid          : 10
Section vertical spacing     : 16–20
```

### Header
```
Header padding                : 16
Header background             : linear-gradient(Emerald 500 → Sky 600), arah 135deg
Icon back/refresh size        : 20 / 18, warna putih
Title font-size                : 14, fontWeight '500', putih
Subtitle font-size             : 13, warna putih 70% opacity atau Sky 100
Badge "Offline" paddingH/V     : 8 / 4, borderRadius 20
Badge "Offline" bg/teks        : Rose 100 / Rose 700
```

### Progress ring (react-native-svg)
```
Ring size (width/height)       : 160 x 160
Radius lingkaran                : 68
strokeWidth                     : 14
Warna stroke terisi             : Emerald 500
Warna stroke kosong             : Slate 200
Center text "0%" font-size      : 30, fontWeight '500', warna Slate 900
Label "terbaca" font-size       : 12, warna Slate 400
```

### Metric cards (Dicatat Saya / Antre Kirim)
```
Card padding                    : 12
Card background                 : Slate 50 / putih
borderLeftWidth                 : 3
borderLeftColor (Dicatat saya)  : Emerald 500
borderLeftColor (Antre kirim)   : Sky 400
Number font-size                : 22, fontWeight '500', Slate 900
Label font-size                 : 12, Slate 500
Grid columns                    : 2, flex:1 masing-masing, gap 10
```

### Grid aplikasi
```
Card padding                    : 14 (utama) / 12 (lainnya)
Icon size utama                 : 22
Icon size lainnya               : 18
Icon "Baca meter"                : Emerald 500
Icon "Upload"                    : Rose 500
Icon menu lainnya                : Slate 500
Label font-size                 : 12 (utama) / 11 (lainnya), Slate 700
Grid columns                    : 2 (bukan 3) — hindari baris menggantung
```

### List "Lanjutkan rute"
```
Row padding                     : 10
Row borderRadius                : 10
Row background                  : Slate 50
Nomor urut box                  : 26 x 26, borderRadius 8, bg Slate 100, teks Slate 700
Judul font-size                 : 13, fontWeight '500', Slate 900
Subjudul font-size              : 11, Slate 400
Chevron size                    : 16, warna Slate 400
Gap antar row                   : 8
```

## Catatan implementasi untuk Claude Code

- Ukuran di atas dalam **dp** (Android) / **pt** (iOS) — skala 1, jangan dikalikan `PixelRatio`.
- Ring progres pakai `react-native-svg`: komponen `Svg`, `Circle`, `Text` dari library tersebut — bukan `<Text>` native React Native di dalam `<Svg>`.
- Gradient header pakai `expo-linear-gradient` (`LinearGradient` dari `'expo-linear-gradient'`), bukan CSS gradient string.
- Grid 2 kolom: pakai `flexDirection:'row', flexWrap:'wrap'` dengan `width:'48%'` per item + `justifyContent:'space-between'`, lebih stabil untuk gap konsisten dibanding `FlatList numColumns`.
- Semua nilai warna WAJIB diimpor dari `palette.ts` (`MasterPalette` / `AppAccents`) — jangan hardcode hex baru di komponen, supaya tetap satu sumber kebenaran warna untuk kedua aplikasi (publik & petugas).
- Grup "Aplikasi utama" (Baca meter, Upload) vs "Lainnya" (Download, Riwayat, Info tagihan, Notifikasi) dipisah jadi 2 section — Cadangan/Backup dipindah keluar dari grid utama (masuk ke menu profil/pengaturan) karena bukan aksi harian petugas.