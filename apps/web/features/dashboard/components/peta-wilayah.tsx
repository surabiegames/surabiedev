"use client"

// features/dashboard/components/peta-wilayah.tsx — peta operasional MapLibre:
// poligon batas kelurahan, titik sambungan pelanggan (ter-cluster), dan
// titik pengaduan aktif.
//
// Basemap: raster OpenStreetMap langsung (tanpa API key). Untuk produksi
// ber-traffic tinggi sebaiknya diganti penyedia tile sendiri/berbayar —
// kebijakan tile.openstreetmap.org melarang beban berat.
//
// Data datang via PROP dari server component (GeoJSON FeatureCollection) —
// komponen ini tidak fetch sendiri.
import * as React from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { FeatureCollection, Geometry, Point } from "geojson"
import type { FC } from "../lib/geo-queries"

const PUSAT_BANDUNG: [number, number] = [107.6098, -6.9147]

export function PetaWilayah({
  kelurahan,
  pelanggan,
  pengaduan,
}: {
  kelurahan: FC
  pelanggan: FC
  pengaduan: FC
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<maplibregl.Map | null>(null)

  const adaData = kelurahan.features.length > 0 || pelanggan.features.length > 0 || pengaduan.features.length > 0

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: PUSAT_BANDUNG,
      zoom: 11.5,
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
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")

    map.on("load", () => {
      // ---- Batas kelurahan ----
      map.addSource("kelurahan", { type: "geojson", data: kelurahan as FeatureCollection })
      map.addLayer({
        id: "kelurahan-isi",
        type: "fill",
        source: "kelurahan",
        paint: { "fill-color": "#0d9488", "fill-opacity": 0.08 },
      })
      map.addLayer({
        id: "kelurahan-garis",
        type: "line",
        source: "kelurahan",
        paint: { "line-color": "#0d9488", "line-width": 1.2, "line-opacity": 0.7 },
      })

      // ---- Titik pelanggan (cluster) ----
      map.addSource("pelanggan", {
        type: "geojson",
        data: pelanggan as FeatureCollection,
        cluster: true,
        clusterRadius: 45,
        clusterMaxZoom: 15,
      })
      map.addLayer({
        id: "pelanggan-cluster",
        type: "circle",
        source: "pelanggan",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#0d9488",
          "circle-opacity": 0.85,
          "circle-radius": ["step", ["get", "point_count"], 14, 100, 20, 1000, 28],
        },
      })
      map.addLayer({
        id: "pelanggan-cluster-angka",
        type: "symbol",
        source: "pelanggan",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11 },
        paint: { "text-color": "#ffffff" },
      })
      map.addLayer({
        id: "pelanggan-titik",
        type: "circle",
        source: "pelanggan",
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-color": "#0d9488", "circle-radius": 5, "circle-stroke-width": 1.5, "circle-stroke-color": "#ffffff" },
      })

      // ---- Titik pengaduan aktif ----
      map.addSource("pengaduan", { type: "geojson", data: pengaduan as FeatureCollection })
      map.addLayer({
        id: "pengaduan-titik",
        type: "circle",
        source: "pengaduan",
        paint: { "circle-color": "#dc2626", "circle-radius": 6, "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" },
      })

      // Popup identitas saat titik diklik.
      map.on("click", "pelanggan-titik", (e) => {
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties as { nama?: string; nomor?: string; status?: string }
        new maplibregl.Popup({ closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font: 12px/1.5 system-ui"><strong>${p.nama ?? ""}</strong><br/><code>${p.nomor ?? ""}</code> · ${p.status ?? ""}</div>`
          )
          .addTo(map)
      })
      map.on("click", "pengaduan-titik", (e) => {
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties as { tiket?: string; jenis?: string; status?: string }
        new maplibregl.Popup({ closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font: 12px/1.5 system-ui"><strong>${p.jenis ?? ""}</strong><br/><code>${p.tiket ?? ""}</code> · ${p.status ?? ""}</div>`
          )
          .addTo(map)
      })
      for (const layer of ["pelanggan-titik", "pengaduan-titik", "pelanggan-cluster"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"))
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""))
      }

      // Zoom masuk saat cluster diklik.
      map.on("click", "pelanggan-cluster", async (e) => {
        const f = e.features?.[0]
        const clusterId = f?.properties?.cluster_id as number | undefined
        if (clusterId === undefined) return
        const src = map.getSource("pelanggan") as maplibregl.GeoJSONSource
        const zoom = await src.getClusterExpansionZoom(clusterId)
        map.easeTo({ center: (f!.geometry as Point).coordinates as [number, number], zoom })
      })

      // Pas-kan tampilan ke data yang ada.
      const semua: number[][] = []
      for (const fc of [kelurahan, pelanggan, pengaduan]) {
        for (const feat of fc.features) {
          const g = feat.geometry as Geometry
          if (g.type === "Point") semua.push(g.coordinates as number[])
        }
      }
      if (semua.length > 0) {
        const lngs = semua.map((c) => c[0]!)
        const lats = semua.map((c) => c[1]!)
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 48, maxZoom: 14, duration: 0 }
        )
      }
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
    // Data datang dari server render sekali — peta tidak perlu di-rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="border border-border/70 bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-2.5">
        <h2 className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Peta Operasional</h2>
        <div className="ml-auto flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 border border-teal-600/70 bg-teal-600/15" /> Batas kelurahan
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-teal-600" /> Sambungan pelanggan
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-red-600" /> Pengaduan aktif
          </span>
        </div>
      </div>

      <div className="relative">
        <div ref={containerRef} className="h-[calc(100dvh-22rem)] min-h-96 w-full" />
        {!adaData && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <p className="pointer-events-auto max-w-md border border-border bg-background/95 px-4 py-3 text-center text-xs leading-relaxed text-muted-foreground shadow-sm">
              Belum ada data spasial yang terisi — poligon batas kelurahan dan koordinat pelanggan belum diimpor.
              Peta akan hidup otomatis begitu kolom <code className="font-mono">area</code> / <code className="font-mono">koordinat</code> terisi.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
