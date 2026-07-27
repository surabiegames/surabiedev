# TASK: Restrukturisasi Skema Database, Logic Seeding, dan Sinkronisasi Data Pelanggan & Meter

Saya ingin memperbaiki arsitektur database, skema tabel, serta mekanisme data seeding pada aplikasi ini agar data yang dihasilkan AKURAT, SINKRON, dan SIAP PRODUKSI sebagai dasar data resmi penagihan pelanggan.

---

## 1. PEMAHAMAN SUMBER DATA (CSV SOURCE MAPPING)

Tolong pahami peran dan sifat dari 4 file sumber data berikut:

1. `lapdatameter.csv` (Data Transaksional Utama - Hasil Catat Meter Aurora)
   - Sifat: Data mentah lapangan (ground truth) dari aplikasi pencatatan petugas yang saat ini berjalan.
   - Fungsi: Menjadi dasar riwayat angka stand meter (awal/akhir) dan pemakaian aktual per pelanggan/bulan.

2. `PBPK202605-PW5.csv` (Data Penambah - Pasang Baru / Sambungan Baru)
   - Sifat: Data pelanggan baru dari Bagian Langganan.
   - Fungsi: Menjadi PENAMBAH ke daftar Sambungan Langsung (SL) aktif dan target pencatatan meter petugas untuk periode bulan berikutnya.

3. `r-nomor.csv` (Data Pengurang - Pemutusan Pelanggan)
   - Sifat: Data pelanggan yang diputus/non-aktif.
   - Fungsi: Menjadi PENGURANG jumlah SL aktif. Menghentikan target pencatatan meter untuk petugas terkait pada bulan berikutnya.

4. `ProgresCater.csv` (Data Agregasi / Rekapitulasi Laporan STI)
   - Sifat: Data laporan rekapitulasi/penggabungan (historical/aggregate).
   - Fungsi: Digunakan sebagai pembanding/validasi rekap data, bukan sebagai tabel transaksi mentah utama.

---

## 2. ATURAN BISNIS & LOGIKA SINKRONISASI (BUSINESS LOGIC)

1. **Status Sambungan Langsung (SL) & Status Pelanggan:**
   - Total SL Aktif Bulan (T) = (SL Aktif Bulan T-1) + (Data Penambah PBPK) - (Data Pengurang R-Nomor).
   - Pelanggan yang ada di `r-nomor.csv` harus diubah statusnya menjadi `NON_AKTIF` / `MUTASI_PUTUS`, sehingga tidak ter-generate sebagai tugas catat meter di periode berjalan/selanjutnya.
   - Pelanggan di `PBPK` harus terdaftar ke tabel Master Pelanggan dan otomatis ter-assign ke rute/petugas catat meter (cater) sesuai wilayahnya.

2. **Akurasi Data Tagihan (Billing Accuracy):**
   - Stand Akhir bulan lalu (T-1) = Stand Awal bulan ini (T).
   - Pemakaian = Stand Akhir - Stand Awal.
   - Data dari `lapdatameter.csv` harus tervalidasi konsistensinya terhadap master pelanggan sebelum masuk ke tabel transaksi resmi.

---

## 3. INSTRUKSI EKSEKUSI UNTUK CLAUDE CODE

Tolong lakukan langkah-langkah berikut secara berurutan:

### Langkah 1: Audit Skema Database saat Ini
- Periksa skema database/Prisma/Migration saat ini.
- Pastikan ada pemisahan yang jelas antara:
  - `Master Pelanggan` (Master Data)
  - `Transaksi Catat Meter` (Transactional)
  - `Log Mutasi SL` (PBPK & Pemutusan)
  - `Petugas / Rute Cater` (Assignment)

### Langkah 2: Buat / Perbarui Script Seeder per File (Modular Seeding)
Buat script seed yang dapat dijalankan secara **INDEPENDEN & BERURUTAN** (modular):

1. `seed:01-master-pelanggan` -> Memuat master awal + baseline.
2. `seed:02-lapdatameter` -> Memuat riwayat pencatatan meter aktual dari Aurora.
3. `seed:03-pbpk` -> Memproses data penambah pelanggan baru.
4. `seed:04-r-nomor` -> Memproses data pemutusan/pengurang SL aktif.
5. `seed:05-progres-cater` -> Memuat/mencocokkan data rekapitulasi STI.

> Catatan: Setiap script seeder harus memiliki fungsi *idempotent* (menggunakan upsert / cek keberadaan data agar tidak terjadi duplikasi jika dijalankan ulang).

### Langkah 3: Validasi & Reconcile Data
- Buat query / utility function untuk mengecek konsistensi data setelah seed dijalankan.
- Tampilkan ringkasan (summary) di terminal setelah seeder selesai:
  - Jumlah SL Aktif
  - Jumlah Penambahan (PBPK)
  - Jumlah Pengurangan (R-Nomor)
  - Total Target Cater Periode Berjalan

---

Tolong tinjau instruksi ini dan berikan rekomendasi perubahan skema tabel/Prisma schema terlebih dahulu sebelum kita mengeksekusi pembuatan file seeder-nya.