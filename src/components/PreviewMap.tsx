import * as React from "react"
import type { Feature, MultiPolygon, Polygon, Position } from "geojson"
import type { Map as MapboxMap } from "mapbox-gl"
import type { LayerProps, MapRef } from "react-map-gl/mapbox"
import Map, { Layer, Source } from "react-map-gl/mapbox"
import { useTheme } from "@/components/theme-provider"

const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN

type BoundaryGeometry = Polygon | MultiPolygon

export type HoveredInquiry = {
  id: string
  title: string
  activeSuburb: string
  fallbackCenter?: [number, number]
  boundaryGeojson?: BoundaryGeometry | null
}

type PreviewMapProps = {
  hoveredInquiry: HoveredInquiry | null
}

const AUSTRALIA_IDLE_CENTER: [number, number] = [133.7, -25.2]
const BUILDINGS_LAYER_ID = "preview-3d-buildings"

const maskLayer: LayerProps = {
  id: "preview-mask-fill",
  type: "fill",
  source: "preview-mask",
  paint: {
    "fill-color": "#020617",
    "fill-opacity": 0.72,
    "fill-antialias": false,
  },
}

function normalizeRing(ring: Position[]): Position[] {
  if (!ring.length) return ring
  const first = ring[0]
  const last = ring[ring.length - 1]

  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...ring, [first[0], first[1]]]
  }

  return ring
}

function outerRingFromBoundary(boundary: BoundaryGeometry): Position[] | null {
  if (boundary.type === "Polygon") {
    return boundary.coordinates[0] ?? null
  }

  let selected: Position[] | null = null
  let maxScore = Number.NEGATIVE_INFINITY

  boundary.coordinates.forEach((polygon) => {
    const ring = polygon[0]
    if (!ring || ring.length < 3) return

    let minLng = Number.POSITIVE_INFINITY
    let minLat = Number.POSITIVE_INFINITY
    let maxLng = Number.NEGATIVE_INFINITY
    let maxLat = Number.NEGATIVE_INFINITY

    ring.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng)
      minLat = Math.min(minLat, lat)
      maxLng = Math.max(maxLng, lng)
      maxLat = Math.max(maxLat, lat)
    })

    const score = (maxLng - minLng) * (maxLat - minLat)
    if (score > maxScore) {
      maxScore = score
      selected = ring
    }
  })

  return selected
}

function buildMaskFeature(boundary: BoundaryGeometry | null | undefined): Feature<Polygon> | null {
  if (!boundary) return null

  const holeRing = outerRingFromBoundary(boundary)
  if (!holeRing || holeRing.length < 3) return null

  const worldRing: Position[] = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ]

  const normalizedHole = [...normalizeRing(holeRing)].reverse()

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [worldRing, normalizedHole],
    },
  }
}

function boundaryToBBox(boundary: BoundaryGeometry): {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
} {
  let minLng = Number.POSITIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLng = Number.NEGATIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY

  const visit = (lng: number, lat: number) => {
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  }

  if (boundary.type === "Polygon") {
    boundary.coordinates.forEach((ring) => {
      ring.forEach(([lng, lat]) => visit(lng, lat))
    })
  } else {
    boundary.coordinates.forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach(([lng, lat]) => visit(lng, lat))
      })
    })
  }

  return { minLng, minLat, maxLng, maxLat }
}

async function fetchBoundaryAndCenter(
  suburb: string,
): Promise<{ center: [number, number] | null; boundary: BoundaryGeometry | null }> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${suburb}, NSW, Australia`)}&format=json&polygon_geojson=1&limit=1`,
  )

  if (!response.ok) {
    return { center: null, boundary: null }
  }

  const results = (await response.json()) as Array<{
    lon?: string
    lat?: string
    geojson?: { type?: string; coordinates?: unknown }
  }>

  const first = results[0]
  if (!first) {
    return { center: null, boundary: null }
  }

  const lon = Number(first.lon)
  const lat = Number(first.lat)
  const center: [number, number] | null =
    Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null

  const type = first.geojson?.type
  const coordinates = first.geojson?.coordinates

  if (type === "Polygon" || type === "MultiPolygon") {
    return {
      center,
      boundary: {
        type,
        coordinates: coordinates as Polygon["coordinates"] | MultiPolygon["coordinates"],
      } as BoundaryGeometry,
    }
  }

  return { center, boundary: null }
}

function apply3DBuildings(map: MapboxMap, isDark: boolean) {
  if (map.getLayer(BUILDINGS_LAYER_ID)) {
    return
  }

  const labelLayer = map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id

  try {
    map.addLayer(
      {
        id: BUILDINGS_LAYER_ID,
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 13,
        paint: {
          "fill-extrusion-color": isDark ? "#334155" : "#d6cec2",
          "fill-extrusion-height": ["coalesce", ["get", "height"], 0],
          "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
          "fill-extrusion-opacity": isDark ? 0.82 : 0.74,
        },
      },
      labelLayer,
    )
  } catch {
    // Ignore styles where building source-layer is unavailable.
  }
}

export function PreviewMap({ hoveredInquiry }: PreviewMapProps) {
  const mapRef = React.useRef<MapRef | null>(null)
  const orbitFrameRef = React.useRef<number | null>(null)
  const [mapLoaded, setMapLoaded] = React.useState(false)
  const [maskFeature, setMaskFeature] = React.useState<Feature<Polygon> | null>(null)
  const { theme } = useTheme()

  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const mapStyle = isDark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11"

  const stopOrbit = React.useCallback(() => {
    if (orbitFrameRef.current !== null) {
      cancelAnimationFrame(orbitFrameRef.current)
      orbitFrameRef.current = null
    }
  }, [])

  const startOrbit = React.useCallback(() => {
    stopOrbit()

    const rotate = () => {
      const map = mapRef.current?.getMap()
      if (!map || !map.getStyle()) {
        orbitFrameRef.current = null
        return
      }

      map.setBearing(map.getBearing() + 0.05)
      orbitFrameRef.current = requestAnimationFrame(rotate)
    }

    orbitFrameRef.current = requestAnimationFrame(rotate)
  }, [stopOrbit])

  React.useEffect(() => {
    if (!mapLoaded) return

    const map = mapRef.current?.getMap()
    if (!map) return

    let cancelled = false

    const run = async () => {
      if (!hoveredInquiry) {
        setMaskFeature(null)
        map.flyTo({
          center: AUSTRALIA_IDLE_CENTER,
          zoom: 3.5,
          pitch: 50,
          bearing: 0,
          duration: 1800,
          essential: true,
        })
        startOrbit()
        return
      }

      stopOrbit()

      let center = hoveredInquiry.fallbackCenter ?? null
      let boundary = hoveredInquiry.boundaryGeojson ?? null

      if (!center || !boundary) {
        const resolved = await fetchBoundaryAndCenter(hoveredInquiry.activeSuburb)
        if (cancelled) return
        center = center ?? resolved.center
        boundary = boundary ?? resolved.boundary
      }

      if (cancelled) return

      const targetCenter = center ?? AUSTRALIA_IDLE_CENTER
      setMaskFeature(buildMaskFeature(boundary))

      if (boundary) {
        const reapplyMask = () => {
          if (cancelled) return
          setMaskFeature(buildMaskFeature(boundary))
        }

        const onMoveEnd = () => {
          map.off("moveend", onMoveEnd)
          window.clearTimeout(maskRetryTimeout)
          reapplyMask()
        }

        map.on("moveend", onMoveEnd)

        const maskRetryTimeout = window.setTimeout(() => {
          map.off("moveend", onMoveEnd)
          reapplyMask()
        }, 450)

        const bbox = boundaryToBBox(boundary)
        map.fitBounds(
          [
            [bbox.minLng, bbox.minLat],
            [bbox.maxLng, bbox.maxLat],
          ],
          {
            padding: { top: 56, right: 48, bottom: 52, left: 48 },
            maxZoom: 16.4,
            pitch: 54,
            bearing: map.getBearing() + 82,
            duration: 2600,
            essential: true,
          },
        )
        return
      }

      map.flyTo({
        center: targetCenter,
        zoom: 15.6,
        pitch: 54,
        bearing: map.getBearing() + 82,
        duration: 2600,
        essential: true,
      })
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [hoveredInquiry, mapLoaded, startOrbit, stopOrbit])

  React.useEffect(() => {
    return () => {
      stopOrbit()
    }
  }, [stopOrbit])

  React.useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const ensure3D = () => {
      if (!map.getStyle()) return
      apply3DBuildings(map, isDark)

      // Re-emit existing mask data when style reloads so the dim overlay is re-mounted.
      setMaskFeature((prev) => {
        if (!prev) return prev

        return {
          ...prev,
          geometry: {
            ...prev.geometry,
            coordinates: prev.geometry.coordinates.map((ring) => [...ring]),
          },
        }
      })
    }

    ensure3D()
    map.on("style.load", ensure3D)

    return () => {
      map.off("style.load", ensure3D)
    }
  }, [isDark])

  if (!mapboxToken) {
    return <div className="h-full w-full bg-muted" />
  }

  return (
    <div className="pointer-events-none h-full w-full overflow-hidden">
      <Map
        ref={mapRef}
        onLoad={() => setMapLoaded(true)}
        mapboxAccessToken={mapboxToken}
        initialViewState={{ longitude: AUSTRALIA_IDLE_CENTER[0], latitude: AUSTRALIA_IDLE_CENTER[1], zoom: 3.5 }}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        interactive={false}
        dragPan={false}
        dragRotate={false}
        scrollZoom={false}
        boxZoom={false}
        doubleClickZoom={false}
        touchZoomRotate={false}
        touchPitch={false}
        keyboard={false}
      >
        {maskFeature ? (
          <Source id="preview-mask" type="geojson" data={maskFeature}>
            <Layer {...maskLayer} />
          </Source>
        ) : null}
      </Map>
    </div>
  )
}
