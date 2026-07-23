// app/(dashboard)/dashboard/wilayah/page.tsx — /dashboard/wilayah
//
// Server component mengambil GeoJSON langsung dari PostGIS (features/
// dashboard/lib/geo-queries.ts) lalu mengoper ke peta MapLibre di client.
import type { Metadata } from "next"
import { HalamanDasbor } from "@/features/dashboard/components/halaman-dasbor"
import { PetaWilayah } from "@/features/dashboard/components/peta-wilayah"
import { batasKelurahanFC, titikPelangganFC, titikPengaduanFC } from "@/features/dashboard/lib/geo-queries"

export const metadata: Metadata = { title: "Wilayah & peta" }

export default async function WilayahPage() {
  const [kelurahan, pelanggan, pengaduan] = await Promise.all([
    batasKelurahanFC(),
    titikPelangganFC(),
    titikPengaduanFC(),
  ])

  return (
    <HalamanDasbor
      eyebrow="Data Induk"
      judul="Wilayah & peta operasional"
      deskripsi="Batas kelurahan, sebaran sambungan pelanggan, dan titik pengaduan aktif dalam satu peta."
      aksi={
        <span className="border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wide text-primary uppercase">
          {kelurahan.features.length} poligon · {pelanggan.features.length.toLocaleString("id-ID")} titik
        </span>
      }
    >
      <PetaWilayah kelurahan={kelurahan} pelanggan={pelanggan} pengaduan={pengaduan} />
    </HalamanDasbor>
  )
}
