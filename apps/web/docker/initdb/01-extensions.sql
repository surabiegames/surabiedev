-- Dijalankan otomatis SEKALI saat volume database pertama kali dibuat
-- (tidak akan jalan lagi kalau volume sudah ada isinya).
-- Tambahkan CREATE EXTENSION lain di sini kalau project butuh.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy search nama pelanggan, dll
CREATE EXTENSION IF NOT EXISTS unaccent;  -- pencarian tanpa peduli aksen