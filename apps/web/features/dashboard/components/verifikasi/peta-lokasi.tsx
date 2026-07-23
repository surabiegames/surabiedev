"use client"

// features/dashboard/components/verifikasi/peta-lokasi.tsx — peta mini
// lokasi rumah pelanggan di panel verifikasi. MapLibre + raster OSM, sama
// seperti PetaWilayah (tanpa API key; untuk traffic produksi tinggi ganti
// penyedia tile sendiri — kebijakan tile.openstreetmap.org).
//
// Sumber koordinat: Pelanggan.geoLat/geoLong (Float biasa). Kolom PostGIS
// `koordinat` tidak bisa dibaca lewat include Prisma (Unsupported) — geoLat/
// geoLong memang dipertahankan di schema sebagai pasangan yang bisa
// di-serialize langsung.
import * as React from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { ChevronDown, MapPin } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible"

function PetaMini({ lat, lng }: { lat: number; lng: number }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<maplibregl.Map | null>(null)

  React.useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [lng, lat],
      zoom: 15,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
    })
    new maplibregl.Marker({ color: "var(--primary)" }).setLngLat([lng, lat]).addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [lat, lng])

  return <div ref={containerRef} className="h-36 w-full border border-border" />
}

export function PetaLokasi({ lat, lng }: { lat: number | null | undefined; lng: number | null | undefined }) {
  // ~46168.x = placeholder Excel date serial di data legacy (lihat komentar
  // geoLat di pelanggan.prisma) — perlakukan sebagai "tidak ada koordinat".
  const valid =
    typeof lat === "number" && typeof lng === "number" && lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141

  if (!valid) {
    return (
      <div className="flex items-center gap-2.5 border border-dashed border-border px-3 py-2.5">
        <MapPin className="size-4 shrink-0 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">Koordinat rumah pelanggan belum tersedia.</p>
      </div>
    )
  }

  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 border border-border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-accent">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
          <MapPin className="size-3.5 text-muted-foreground" />
          Lokasi rumah pelanggan
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        {/* Peta baru dibuat saat panel dibuka (Collapsible unmount saat
            tertutup) — tidak membebani tiap pemilihan baris. */}
        <PetaMini lat={lat} lng={lng} />
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-block text-[11px] font-medium text-primary underline-offset-4 hover:underline"
        >
          Buka di peta penuh ↗
        </a>
      </CollapsibleContent>
    </Collapsible>
  )
}
