// features/publik/lib/compress-image.ts — kecilkan foto di browser sebelum
// diunggah. Foto langsung dari kamera HP modern bisa 8-15 MB; mengecilkannya
// di client menghemat kuota data pelapor (banyak yang melapor dari sinyal
// seluler) dan mempercepat unggah. Backend TETAP memvalidasi ukuran & isi
// berkas sendiri lewat magic bytes (server/lib/storage.ts) — ini murni
// optimisasi UX, bukan validasi.
const SISI_MAKS = 1200
const KUALITAS = 0.8

export async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  let { width, height } = bitmap
  if (width > SISI_MAKS || height > SISI_MAKS) {
    if (width > height) {
      height = Math.round((height * SISI_MAKS) / width)
      width = SISI_MAKS
    } else {
      width = Math.round((width * SISI_MAKS) / height)
      height = SISI_MAKS
    }
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return file // Canvas tidak tersedia (langka) -> unggah aslinya, bukan gagal total.

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", KUALITAS))
  if (!blob) return file

  return new File([blob], "foto-meter.jpg", { type: "image/jpeg" })
}
