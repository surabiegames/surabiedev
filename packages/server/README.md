# Backend API (Hono) — PERUMDA Tirtawening

Semua endpoint bisnis ada di `/api/v1/*` dan **wajib login**. `/api/auth/*`
ditangani Auth.js lewat `@hono/auth-js`. Titik masuk Next.js cuma satu file
(`app/api/[[...route]]/route.ts`) yang mem-`handle()` `app` dari
`server/app.ts` — semua logic hidup di `server/**`.

## Struktur

```
server/
  app.ts                    perakitan app: logger, secureHeaders, auth, mount modul, onError
  lib/
    errors.ts               AppError + errorHandler (semua error -> satu envelope)
    validate.ts             pembungkus zValidator -> 422 berformat envelope
    response.ts             ok() / created() / paginated()
    pagination.ts           query schema + buildSkipTake/buildMeta
    periode.ts              konversi thbl (202605) <-> DateTime
    spatial.ts              SEMUA raw SQL PostGIS (satu-satunya tempat)
    audit.ts                recordAudit() — dipanggil di dalam transaksi mutasi
    crud-factory.ts         CRUD generik (model referensi non-geo)
    geo-crud-factory.ts     CRUD generik + kolom `area` (GeoJSON)
  middleware/rbac.ts        requireRole() + ROLE_GROUPS
  modules/<domain>/         router (+ schema/service bila logic-nya tebal)
```

## Kontrak response

Sukses tunggal: `{ "success": true, "data": {...} }`
Sukses list: `{ "success": true, "data": [...], "meta": { page, pageSize, total, totalPages } }`
Error: `{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }`

| Kode HTTP | Kapan |
|---|---|
| 400 `BAD_REQUEST` | aturan bisnis dilanggar; FK tidak ada (Prisma P2003) |
| 401 | belum login |
| 403 `FORBIDDEN` | role tidak cukup |
| 404 `NOT_FOUND` | data tidak ada (juga Prisma P2025) |
| 409 `CONFLICT` | duplikat/unique (P2002), state bentrok (mis. bayar 2x) |
| 422 `VALIDATION_ERROR` | zod gagal, `details: [{path, message}]` |

## RBAC

`ROLE_GROUPS` (kumulatif): `ADMIN` ⊂ `MANAGEMENT_UP` ⊂ `SUPERVISOR_UP` ⊂ `STAFF_UP` ⊂ `ANY`.
Endpoint tanpa `requireRole()` = terbuka untuk semua user yang login (termasuk
role `USER`/pelanggan): **POST /pengaduan**, **GET /pengaduan/saya**,
**POST /laporan-mandiri**, **GET /users/me**, **PATCH /users/:id/password**
(dirinya sendiri).

## Daftar endpoint

| Prefix | Isi | Baca | Tulis |
|---|---|---|---|
| `/me` | session saat ini | login | — |
| `/divisi`, `/bagian`, `/sub-bagian` | struktur organisasi | STAFF_UP | ADMIN |
| `/pencatat` | jembatan petugas lapangan ↔ User (+ `_count.penugasanRute`) | STAFF_UP | SUPERVISOR_UP |
| `/penugasan-rute` | pemetaan rute↔petugas many-to-many berurut (halaman Pemetaan Rute): `?pencatatId=`, `/ringkasan`, `POST`, `DELETE /:id`, `PATCH /urutan` | STAFF_UP | SUPERVISOR_UP |
| `/target-kinerja` | target bulanan/tahunan | STAFF_UP | MANAGEMENT_UP |
| `/tarif` | TarifGolongan + `/:id/blok` (tarif progresif); `?hanyaAktif=true` menyaring blok berlaku saat ini (dipakai estimasi mobile) | STAFF_UP | ADMIN |
| `/golongan-besar`, `/dma` | referensi | STAFF_UP | ADMIN |
| `/konfigurasi` | key-value (`isRahasia` disamarkan non-SUPER_ADMIN) | STAFF_UP | ADMIN |
| `/wilayah-adm` … `/zona`, `/rute` | hierarki wilayah + `area` GeoJSON; `/rute/:id/urutan-pelanggan` (PATCH, urutan kunjungan `noUrutRute`) | STAFF_UP | ADMIN (urutan-pelanggan: SUPERVISOR_UP) |
| `/kecamatan`, `/kelurahan` | wilayah pemerintahan + `area` | STAFF_UP | ADMIN |
| `/wilayah/lookup?lat&lng` | reverse point-in-polygon | STAFF_UP | — |
| `/pelanggan` | CRUD, soft delete, `/:id/restore`, `/near` | STAFF_UP | SUPERVISOR_UP (hapus/restore: MANAGEMENT_UP) |
| `/meter` | pasang/ganti meter (auto-histori) | STAFF_UP | SUPERVISOR_UP |
| `/pembacaan` | PembacaanMeter resmi | STAFF_UP | STAFF_UP |
| `/tagihan` | generate dari pembacaan, `/simulasi`, `/:id/status` | STAFF_UP | SUPERVISOR_UP (status: MANAGEMENT_UP) |
| `/tagihan-lain` | pungutan non-air insidental | STAFF_UP | SUPERVISOR_UP |
| `/pembayaran` | ledger + `/:id/konfirmasi` | STAFF_UP | SUPERVISOR_UP |
| `/pengaduan` | aduan + `/near`, `/statistik`, `/petugas`, `/saya`, `/:id/tugaskan`, `/:id/status`, `/:id/catatan`, `/:id/eskalasi` | STAFF_UP (`/petugas`: SUPERVISOR_UP; `/saya`: ANY login) | create: ANY; catatan: STAFF_UP; tugaskan/status/eskalasi: SUPERVISOR_UP |
| `/laporan-harian` | + `/rute-saya` (paket RBM petugas token: rute dari `PenugasanRute` many-to-many berurut → banyak rute per petugas, `rutes[]` + `pelanggan` datar lintas rute terurut, target/terbaca total, stand lalu, riwayat 3 periode, `beaBeban`/`beaAdmin` tagihan terakhir untuk estimasi total, sudahDicatat), `/batch` (sinkronisasi borongan offline, respons per-record TERSIMPAN/DUPLIKAT/GAGAL — pola dev_store_data Aurora), `/foto` (multipart bukti stand/segel/rumah/video → URL), `/import-backup` (multipart impor cadangan lapangan: `berkas` = ZIP **atau** berkas lepasan bernama `periode_tipe_nomor.jpg`, `tipe` berulang memilih stand/rumah/segel/video/catatan; CSV `catatan` → `simpanLaporan` idempoten DUPLIKAT, foto → DILAMPIRKAN ke pembacaan yang ada / TANPA_PENCATATAN bila belum dicatat; reuse simpanBerkas+simpanLaporan), `/:id/verif1`, `/:id/verif2`, `/:id/verif3`, `/:id/reject`, `/:id/unverify` | STAFF_UP | STAFF_UP (V1/reject: SUPERVISOR_UP; V2: MANAGEMENT_UP; V3: SENIOR_UP; unverify: mengikuti ring yang dibatalkan). POST //batch mengisi sendiri `pencatatId` (dari akun token), snapshot nama/alamat, dan `jarakMeter` (jarak GPS titik catat ↔ pelanggan, raw SQL ST_DistanceSphere) bila tidak dikirim |
| `/laporan-mandiri` | + `/:id/verify`, `/:id/reject`, `/:id/unverify` | STAFF_UP | create: ANY; verify/unverify: STAFF_UP |
| `/mutasi`, `/pemutusan`, `/potensi` | mutasi/pemutusan/prospek (+geo) | STAFF_UP | SUPERVISOR_UP |
| `/users` | manajemen akun, `/me`, `/:id/role`, `/:id/status`, `/:id/password` | MANAGEMENT_UP | ADMIN |
| `/audit-log` | read-only | MANAGEMENT_UP | — (hanya via recordAudit internal) |
| `/perangkat` | `/token` (POST/DELETE) — token push FCM per perangkat | — | STAFF_UP |
| `/notifikasi` | inbox in-app + `/:id/baca`, `/baca-semua` (terikat userId sesi) | login | login |

Di luar `/api/v1`: `POST /api/mobile/auth/login` & `POST /api/mobile/auth/google`
(pintu masuk aplikasi Flutter, tanpa login, rate-limited — lihat bagian
"API untuk aplikasi mobile" di bawah).

## Aturan bisnis yang ditegakkan di API (bukan di DB)

Hal-hal berikut **tidak bisa** dijamin constraint database, jadi API adalah
satu-satunya penjaganya — jangan menulis ke tabel ini lewat jalur lain:

1. **Satu meter aktif per pelanggan** — `POST /meter` menonaktifkan meter lama
   dalam transaksi yang sama (Prisma tidak punya partial unique index).
2. **XOR pembayaran** — tepat satu dari `tagihanId`/`tagihanLainId`
   (tidak ada relasi polymorphic native di Prisma).
3. **Nominal tagihan dihitung server** dari `TarifBlok` progresif yang berlaku
   pada periode — client tidak pernah mengirim `jmlHargaAir`/`totalTagihan`.
4. **Pelunasan hanya lewat `/pembayaran/:id/konfirmasi`** — `PATCH
   /tagihan/:id/status` sengaja menolak `SUDAH_BAYAR` supaya setiap pelunasan
   selalu punya baris ledger.
5. **`Pelanggan` soft delete** — tidak pernah hard delete.
6. **`divisiKode`/`subBagianKode` disinkronkan otomatis** dari `divisiId`/
   `subBagianId` saat POST/PATCH user (keduanya dibaca langsung di JWT).
7. **User tidak bisa mengubah role/status dirinya sendiri.**
8. **`/pemutusan` tidak pernah mengubah `Pelanggan.status`** — konsisten dengan
   keputusan seed (lihat `prisma/README.md`).
9. **Verifikasi laporan lapangan BERJENJANG dan berurutan** (spesifikasi:
   `features/dashboard/components/verifikasi/tabel.md`): V1 Supervisor
   (periksa + `standAkhirRevisi` + pilih `meterVerifId`/`blokTarifVerif`) →
   V2 Manager (validasi) → V3 Senior Manager (approve final). PembacaanMeter
   resmi HANYA dibuat di `/:id/verif3` — jangan menambah jalur pintas yang
   membuat pembacaan dari laporan tanpa melewati ketiga ring. `reject`
   (cek ulang) mereset semua ring; `unverify` membatalkan tepat SATU tahap
   terakhir dan menolak menghapus pembacaan yang sudah dipakai `Tagihan`.
   Kolom legacy `isVerified`/`verifiedAt`/`verifiedById` tetap dipakai sebagai
   penanda final/tolak supaya filter `statusVerif`, stats, dan baris hasil
   sistem lama terbaca tanpa backfill.
10. **Status pengaduan HANYA lewat `transisiPengaduan()`** (`modules/pengaduan/
    alur.ts`) — jangan pernah `prisma.pengaduan.update({ data: { status } })`.
    Fungsi itu menolak transisi tak sah (matriks `TRANSISI`), menulis
    `RiwayatPengaduan` dalam transaksi yang sama, dan mengurus efek samping
    berpasangan (`responsAt`, `ditanganiMulai`, `selesaiAt`, jeda SLA). Versi
    pertama modul ini menimpa kolom status langsung — hasilnya perubahan
    status tanpa jejak sama sekali.
11. **Tiket ditutup PELAPOR, bukan petugas** — `PATCH /pengaduan/:id/status`
    menolak `DITUTUP` & `DIBUKA_KEMBALI` secara eksplisit; keduanya hanya lewat
    `POST /api/public/pengaduan/:nomorTiket/konfirmasi|buka-kembali`. Kalau
    petugas boleh menutup sendiri, angka kepuasan jadi karangan.
12. **Target SLA dihitung sekali saat tiket dibuat lalu DISIMPAN**, tidak
    dihitung ulang saat dibaca (`modules/pengaduan/sla.ts`) — supaya mengubah
    matriks SLA tidak diam-diam menulis ulang sejarah tiket lama.
13. **Akun warga mandiri (role `USER`) + tautan tiket otomatis.**
    `POST /api/public/auth/register` (`modules/publik/akun-warga.router.ts`)
    membalikkan sebagian dari "tidak ada signup" HANYA untuk role `USER`
    paling rendah — tidak pernah menerima role/status/field organisasi dari
    body, dan tidak menyentuh alur akun internal (STAFF ke atas tetap
    admin-provisioned lewat `POST /users`). `POST /api/public/pengaduan`
    memanggil `getSessionUserOpsional()` (`lib/session.ts`) SEBELUM membaca
    body request — WAJIB urutan itu: jalur cookie-nya (`getAuthUser`
    `@hono/auth-js`) mengkloning `c.req.raw` termasuk body stream-nya, dan
    kloning itu throw kalau body sudah dikonsumsi lebih dulu. Kalau
    pelapor kebetulan sedang login (cookie web atau Bearer mobile), tiket
    otomatis tertaut lewat `olehId` pada entri linimasa `DIBUAT` — TANPA
    kolom baru di `Pengaduan`. `GET /pengaduan/saya` (terbuka untuk
    SIAPA PUN yang login, bukan cuma STAFF_UP) membaca balik penanda yang
    sama untuk "riwayat pengaduan saya".
14. **Siklus pengaduan lengkap (2026-07-19).** Status baru `TERVERIFIKASI`
    (triase operator STAFF; STAFF tetap TIDAK bisa menugaskan) dan
    `MENUJU_LOKASI` (petugas berangkat; ikut mengisi `responsAt`/
    `ditanganiMulai`). `PATCH /pengaduan/:id/status` kini **STAFF_UP**
    dengan aturan di handler: STAFF hanya boleh memverifikasi atau
    menggerakkan tiket yang ditugaskan kepadanya (`TRANSISI_PETUGAS` di
    alur.ts) — versi SUPERVISOR_UP lama membuat seluruh app petugas 403.
    `SELESAI` WAJIB `catatanPenyelesaian` + `fotoPenyelesaianUrl`
    (`POST /pengaduan/foto`) dan mengisi `konfirmasiBatasAt` dari
    konfigurasi `pengaduan.batasKonfirmasiJam` (default 72). **Auto-close
    tanpa cron**: jalur MALAS di endpoint publik (GET/konfirmasi/
    buka-kembali/chat menutup tiket kedaluwarsa sebelum melayani) + sweep
    `POST /pengaduan/tutup-otomatis` untuk penjadwal eksternal — keduanya
    lewat `modules/pengaduan/otomatis.ts`, selalu via `transisiPengaduan`
    (aksi `DITUTUP_OTOMATIS`), tidak pernah updateMany. **Chat dua arah**
    lewat riwayat aksi `CHAT` selalu `isPublik` (`POST /pengaduan/:id/chat`
    sisi petugas, `POST /api/public/pengaduan/:nomorTiket/chat` sisi
    pelapor; ditolak setelah DITUTUP). **Auto-tag wilayah** saat tiket
    dibuat: `ST_Contains` kelurahan→kecamatan (`modules/pengaduan/
    wilayah.ts`; null selama polygon kelurahan belum di-seed), tersaring
    lewat `?kelurahanId=`/`?kecamatanId=`. `transisiTersedia` di
    `GET /pengaduan/:id` kini DISARING per role pemanggil.
15. **Langganan tertaut akun warga (`LanggananWarga` + `/langganan-saya`).**
    Sejak 2026-07-19 register warga WAJIB `nomorLangganan` (diverifikasi ADA
    lewat `verifikasiPelanggan()`, bukan diverifikasi MILIK) dan otomatis
    tertaut sebagai langganan UTAMA; akun boleh menautkan sampai 5 nomor
    (`modules/publik/langganan-saya.router.ts`, mounted di
    `/api/v1/langganan-saya` TANPA requireRole — pemakainya role `USER`,
    semua query terikat `userId` sesi). Karena klaim tautan hanya butuh tahu
    nomornya, endpoint ini TIDAK BOLEH membuka data melebihi
    `GET /api/public/pelanggan/:nomorLangganan` (alamat tetap disamarkan,
    tagihan hanya agregat tunggakan) — plus rate limit per-AKUN dan kuota
    tautan sebagai rem enumerasi. Invariant: setiap akun warga selalu punya
    tepat satu tautan utama dan minimal satu tautan (tautan terakhir tidak
    bisa dihapus; hapus utama = tautan tertua naik).

## Dua jebakan yang sudah kena & sudah diperbaiki (jangan diulang)

- **Jangan pakai `Prisma.raw()`/`Prisma.join()` di modul ini.** Fragmen raw
  diam-diam berubah jadi bind parameter (`FROM $3` → `syntax error at or near
  "$3"`) karena `instanceof Sql` gagal saat modul di-reload HMR sementara
  PrismaClient di-cache `globalThis`. Semua raw SQL memakai
  `$queryRawUnsafe`/`$executeRawUnsafe` dengan identifier dari whitelist `GEO`
  + positional params. Detail di header `lib/spatial.ts`.
- **Jangan pakai `instanceof` untuk mengenali error lintas modul.** Alasan yang
  sama membuat pemetaan error Prisma jadi dead code (P2002 lolos jadi 500).
  `lib/errors.ts` memakai cek struktural (`/^P\d{4}$/`, `name === "ZodError"`).
- **`trustHost: true` wajib di `auth.config.ts`** — tanpanya `pnpm build &&
  pnpm start` membuat SEMUA endpoint 401 (`UntrustedHost`), padahal `next dev`
  tampak normal. Set juga `AUTH_URL` ke origin kanonik di produksi.

## API untuk aplikasi mobile (Flutter)

Browser memakai cookie sesi Auth.js; aplikasi native memakai **Bearer
token**. Blanket auth di `/api/v1` adalah `verifyAuthFleksibel()`
(`server/lib/mobile-token.ts`): menerima cookie **atau** header
`Authorization: Bearer <token>` — default-nya tetap 401.

Alur:

1. **Login** — `POST /api/mobile/auth/login` body
   `{ "identifier": "<email atau username>", "password": "..." }`, atau
   **Google** — `POST /api/mobile/auth/google` body `{ "idToken": "..." }`
   (hasil `google_sign_in` di Flutter). Keduanya tanpa login, ber-rate-limit
   per IP, dan mengikuti aturan akun yang sama dengan web: email harus sudah
   terdaftar (tidak ada pendaftaran mandiri), status harus `ACTIVE`, pesan
   gagal seragam untuk semua sebab.
2. Respons sukses:
   `{ tokenType: "Bearer", accessToken, expiresInSeconds, expiresAt, user }`.
   Simpan `accessToken` di secure storage (mis. `flutter_secure_storage`).
3. Panggil endpoint `/api/v1/*` mana pun dengan header
   `Authorization: Bearer <accessToken>`. RBAC per-role berlaku persis sama.
4. Token berumur **7 hari** dan (seperti sesi web ber-strategy JWT) **tidak
   bisa dicabut sebelum kedaluwarsa** — menonaktifkan user menutup login
   berikutnya, bukan token yang masih hidup. 401 = minta pengguna login ulang.

Format token = JWE Auth.js (secret `AUTH_SECRET`) dengan **salt berbeda**
dari cookie web (`authjs.mobile-token` vs `authjs.session-token`) — token
mobile tidak bisa dipakai sebagai cookie sesi, dan sebaliknya.

Uji cepat:

```bash
TOKEN=$(curl -s -X POST localhost:3000/api/mobile/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"<user>","password":"<pass>"}' | jq -r .data.accessToken)
curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/api/v1/me
```

Env terkait:

- `AUTH_GOOGLE_MOBILE_IDS` — daftar client ID OAuth tambahan (dipisah koma)
  yang boleh menjadi `aud` idToken. Aplikasi Android/iOS punya client ID
  sendiri di project Google Cloud yang sama — daftarkan di sini; web client
  (`AUTH_GOOGLE_ID`) selalu ikut diterima.
- `CORS_ORIGINS` — origin browser lintas-origin yang diizinkan (dipisah
  koma). Hanya relevan untuk Flutter **Web**/dev tools; Flutter Android/iOS
  tidak memakai CORS sama sekali. Default: `http://localhost:46139`.

Catatan Flutter (Dio):

```dart
final dio = Dio(BaseOptions(baseUrl: "https://<host>/api/v1"));
dio.options.headers["Authorization"] = "Bearer $accessToken";
// Envelope: { success, data, meta?, error? } — lihat "Kontrak response".
```

## Langkah pertama: bikin akun admin (WAJIB, sekali saja)

Database tidak punya user sama sekali setelah seed, dan **tidak ada satu pun
jalur untuk membuat admin pertama lewat API** — Google menolak email yang
belum terdaftar, Credentials butuh User yang sudah ada, dan `POST /users`
butuh SUPER_ADMIN yang sudah login. Pemutus lingkaran itu satu-satunya adalah:

```bash
BOOTSTRAP_ADMIN_EMAIL=nama.anda@gmail.com pnpm db:bootstrap-admin
```

Email HARUS sama persis dengan akun Google yang dipakai login — itulah yang
dicocokkan Auth.js. Idempoten (aman diulang). Setelah admin pertama ada, buat
akun lain lewat `POST /api/v1/users` dan hapus `BOOTSTRAP_ADMIN_*` dari
environment.

Opsional: tambahkan `BOOTSTRAP_ADMIN_USERNAME` + `BOOTSTRAP_ADMIN_PASSWORD`
(min 8 karakter) bila ingin akun ini juga bisa masuk lewat Credentials sebagai
cadangan saat Google bermasalah.

## Login (Google OAuth) — syarat di sisi Google

Halaman `/login` hanya menyediakan Google. Agar berfungsi, **Authorized
redirect URI** di Google Cloud Console (APIs & Services → Credentials → OAuth
2.0 Client ID yang dipakai `AUTH_GOOGLE_ID`) harus memuat persis:

```
http://localhost:3000/api/auth/callback/google     # development
https://<domain-produksi>/api/auth/callback/google  # produksi
```

Kalau belum terdaftar, Google menolak dengan `redirect_uri_mismatch` sebelum
aplikasi ini sempat dipanggil.

Tiga hal yang membuat alur "akun di-provision admin, user tinggal login
Google" ini bisa jalan — semuanya sudah terpasang, jangan dicabut:

| Di mana | Apa | Kalau dicabut |
|---|---|---|
| `auth.config.ts` | `allowDangerousEmailAccountLinking: true` pada provider Google | Setiap akun hasil bootstrap/`POST /users` **mustahil** login: Auth.js melempar `OAuthAccountNotLinked` karena User-nya ada tapi baris `Account` belum |
| `auth.ts` | `linkAccount` yang menyaring field ke kolom `Account` yang benar-benar ada | Login Google **gagal 500 di percobaan pertama**: Google mengirim `expires_in` di respons token, Auth.js tidak membuangnya, Prisma menolak `Unknown argument 'expires_in'` (sudah direproduksi) |
| `auth.ts` | `callbacks.signIn` menolak email tak terdaftar | Siapa pun dengan akun Google bisa masuk |

## Uji cepat

```bash
pnpm dev
curl -s localhost:3000/api/v1/pelanggan          # 401 tanpa login
# login (Credentials):
CSRF=$(curl -sc /tmp/c.txt localhost:3000/api/auth/csrf | jq -r .csrfToken)
curl -sc /tmp/c.txt -b /tmp/c.txt -X POST localhost:3000/api/auth/callback/credentials \
  -d "csrfToken=$CSRF&username=<user>&password=<pass>"
curl -s -b /tmp/c.txt localhost:3000/api/v1/me
```

Verifikasi yang **wajib** dijalankan sebelum rilis (bukan cuma `tsc`):
`pnpm build && pnpm start`, lalu login + panggil minimal satu endpoint geo —
dua bug di atas (UntrustedHost & raw SQL) lolos dari typecheck dan hanya
ketahuan lewat request sungguhan.
