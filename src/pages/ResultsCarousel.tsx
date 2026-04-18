import * as React from "react"
import { useUser } from "@clerk/clerk-react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from "geojson"
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl"
import type { LayerProps, MapRef } from "react-map-gl/mapbox"
import Map, { NavigationControl, Source, Layer } from "react-map-gl/mapbox"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { useTheme } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useInquiryFlow } from "@/context/InquiryFlowContext"
import { fetchPlacesInPolygonPaginated, type PlaceRow } from "@/lib/fetchPlacesPaginated"
import { supabase } from "@/lib/supabase"

const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN
const BOUNDARY_SOURCE_ID = "suburb-boundary"
const BOUNDARY_LINE_LAYER_ID = "suburb-boundary-line"
const BOUNDARY_FILL_LAYER_ID = "suburb-boundary-fill"
const BUILDINGS_LAYER_ID = "results-3d-buildings"
const PLACES_CIRCLE_LAYER_ID = "places-circle"

let lastSmartResponderRequestKey: string | null = null

type NominatimResult = {
  display_name: string
  geojson?: {
    type?: string
    coordinates?: unknown
  }
}

type ResultSuburb = {
  name: string
  fallbackCenter: [number, number]
}

type VenueSummary = {
  total: number
  byCategory: Record<string, number>
}

type PlaceProperties = {
  id: string
  name: string
  level1_category_name: string
}

type SummaryFeatureProperties = {
  level1_category_name?: string
  category?: string
  level1_category?: string
}

const demoResults: ResultSuburb[] = [
  { name: "Redfern", fallbackCenter: [151.2047, -33.8925] },
  { name: "Darlington", fallbackCenter: [151.1986, -33.8912] },
  { name: "Barangaroo", fallbackCenter: [151.2011, -33.8605] },
]

const clusterLayer: LayerProps = {
  id: "results-clusters",
  type: "circle",
  source: "results-places",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": "#18d0ff",
    "circle-radius": ["step", ["get", "point_count"], 20, 25, 30, 60, 38, 120, 46],
    "circle-opacity": 0.95,
    "circle-stroke-width": 2,
    "circle-stroke-color": "#f8fafc",
  },
}

const clusterCountLayer: LayerProps = {
  id: "results-cluster-count",
  type: "symbol",
  source: "results-places",
  filter: ["has", "point_count"],
  layout: {
    "text-field": ["get", "point_count_abbreviated"],
    "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
    "text-size": 12,
  },
  paint: {
    "text-color": "#0f172a",
  },
}

const venueCircleColorExpression = [
  "match",
  ["get", "level1_category_name"],
  "Dining and Drinking",
  "#FF5733",
  "Retail",
  "#33FF57",
  "Healthcare",
  "#3357FF",
  "Community and Government",
  "#F033FF",
  "Landmarks and Outdoors",
  "#FFD433",
  "#808080",
] as const

const unclusteredLayer: LayerProps = {
  id: PLACES_CIRCLE_LAYER_ID,
  type: "circle",
  source: "results-places",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": venueCircleColorExpression as any,
    "circle-radius": 6,
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
  },
}

function boundaryPaint(isDark: boolean) {
  return {
    fill: {
      "fill-color": isDark ? "#0ea5e9" : "#22c55e",
      "fill-opacity": 0.14,
    },
    line: {
      "line-color": isDark ? "#67e8f9" : "#4ade80",
      "line-width": 6,
      "line-opacity": 0.95,
      "line-blur": 1.5,
    },
  }
}

async function fetchNominatimBoundary(query: string): Promise<Feature<Polygon | MultiPolygon> | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&polygon_geojson=1&addressdetails=1&limit=5&email=your_email@example.com`
  const response = await fetch(url)
  const results = (await response.json()) as NominatimResult[]

  const match = results.find(
    (item) => item.geojson?.type === "Polygon" || item.geojson?.type === "MultiPolygon"
  )

  if (!match?.geojson?.type || !match.geojson.coordinates) {
    return null
  }

  if (match.geojson.type !== "Polygon" && match.geojson.type !== "MultiPolygon") {
    return null
  }

  return {
    type: "Feature",
    geometry: {
      type: match.geojson.type,
      coordinates: match.geojson.coordinates as Polygon["coordinates"] | MultiPolygon["coordinates"],
    } as Polygon | MultiPolygon,
    properties: {},
  }
}

function aggregateVenueSummary(
  venues: FeatureCollection<Point, SummaryFeatureProperties>
): VenueSummary {
  return venues.features.reduce<VenueSummary>(
    (summary, feature) => {
      const category =
        feature.properties?.level1_category_name ??
        feature.properties?.category ??
        feature.properties?.level1_category ??
        "Uncategorized"

      summary.total += 1
      summary.byCategory[category] = (summary.byCategory[category] ?? 0) + 1
      return summary
    },
    {
      total: 0,
      byCategory: {},
    }
  )
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function extractCoordinates(row: PlaceRow): [number, number] | null {
  const directLng = toNumber(row.longitude ?? row.lng)
  const directLat = toNumber(row.latitude ?? row.lat)

  if (directLng !== null && directLat !== null) {
    return [directLng, directLat]
  }

  const geom = row.geom
  if (!geom || !Array.isArray(geom.coordinates) || geom.coordinates.length < 2) {
    return null
  }

  const geomLng = toNumber(geom.coordinates[0])
  const geomLat = toNumber(geom.coordinates[1])

  if (geomLng === null || geomLat === null) {
    return null
  }

  return [geomLng, geomLat]
}

function toFeatureCollection(rows: PlaceRow[]): FeatureCollection<Point, PlaceProperties> {
  const features: Feature<Point, PlaceProperties>[] = []

  rows.forEach((row, index) => {
    const coordinates = extractCoordinates(row)
    if (!coordinates) {
      return
    }

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates,
      },
      properties: {
        id: String(row.id ?? index),
        name: row.name ?? row.venue_name ?? "Unknown Venue",
        level1_category_name: row.level1_category_name ?? "Uncategorized",
      },
    })
  })

  return {
    type: "FeatureCollection",
    features,
  }
}

function boundaryToBBox(boundary: Feature<Polygon | MultiPolygon>) {
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

  if (boundary.geometry.type === "Polygon") {
    boundary.geometry.coordinates.forEach((ring) => {
      ring.forEach(([lng, lat]) => visit(lng, lat))
    })
  } else {
    boundary.geometry.coordinates.forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach(([lng, lat]) => visit(lng, lat))
      })
    })
  }

  return { minLng, minLat, maxLng, maxLat }
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
        minzoom: 14,
        paint: {
          "fill-extrusion-color": isDark ? "#334155" : "#d6cec2",
          "fill-extrusion-height": ["coalesce", ["get", "height"], 0],
          "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
          "fill-extrusion-opacity": isDark ? 0.8 : 0.72,
        },
      },
      labelLayer
    )
  } catch {
    // Ignore styles where building source-layer is unavailable.
  }
}

export function ResultsCarouselPage() {
  const navigate = useNavigate()
  const mapRef = React.useRef<MapRef | null>(null)
  const { theme } = useTheme()
  const { draft, setDraft } = useInquiryFlow()
  const { user } = useUser()

  const [activeIndex, setActiveIndex] = React.useState(0)
  const [mapLoaded, setMapLoaded] = React.useState(false)
  const [boundary, setBoundary] = React.useState<Feature<Polygon | MultiPolygon> | null>(null)
  const [venueData, setVenueData] = React.useState<FeatureCollection<Point, PlaceProperties>>({
    type: "FeatureCollection",
    features: [],
  })
  const [aiSummary, setAiSummary] = React.useState("Assessing suburb profile for your business plan...")
  const [briefingLoading, setBriefingLoading] = React.useState(false)
  const [saveLoading, setSaveLoading] = React.useState(false)
  const [countsBySuburb, setCountsBySuburb] = React.useState<Record<string, number>>({})
  const [fetchMessage, setFetchMessage] = React.useState<string | null>(null)
  const prevCountRef = React.useRef(0)
  const activeRunIdRef = React.useRef(0)
  const rotationRequestRef = React.useRef<number | null>(null)
  const rotationMoveEndHandlerRef = React.useRef<(() => void) | null>(null)
  const exitToDashboardRef = React.useRef(false)

  const activeSuburb = demoResults[activeIndex]

  const telemetry = React.useMemo(() => {
    return venueData.features.reduce(
      (acc, feature) => {
        const category = feature.properties.level1_category_name
        acc.total += 1
        acc.byCategory[category] = (acc.byCategory[category] ?? 0) + 1
        return acc
      },
      {
        total: 0,
        byCategory: {} as Record<string, number>,
      }
    )
  }, [venueData])

  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const mapStyle = isDark
    ? "mapbox://styles/mapbox/dark-v11"
    : "mapbox://styles/mapbox/light-v11"

  React.useEffect(() => {
    if (!draft) {
      if (exitToDashboardRef.current) {
        return
      }
      navigate("/inquiry/new", { replace: true })
      return
    }

    exitToDashboardRef.current = false
  }, [draft, navigate])

  React.useEffect(() => {
    const currentCount = telemetry.total

    if (currentCount > prevCountRef.current) {
      console.log(
        `📈 TELEMETRY: Raw Venue Count increased from ${prevCountRef.current} to ${currentCount}`
      )
    }

    prevCountRef.current = currentCount
  }, [telemetry.total])

  const stopCameraRotation = React.useCallback(() => {
    if (rotationRequestRef.current !== null) {
      cancelAnimationFrame(rotationRequestRef.current)
      rotationRequestRef.current = null
    }

    const map = mapRef.current?.getMap()
    if (map && rotationMoveEndHandlerRef.current) {
      map.off("moveend", rotationMoveEndHandlerRef.current)
      rotationMoveEndHandlerRef.current = null
    }
  }, [])

  const startCameraRotation = React.useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map || !map.getStyle()) {
      return
    }

    if (rotationRequestRef.current !== null) {
      cancelAnimationFrame(rotationRequestRef.current)
      rotationRequestRef.current = null
    }

    const rotateCamera = () => {
      const liveMap = mapRef.current?.getMap()
      if (!liveMap || !liveMap.getStyle()) {
        rotationRequestRef.current = null
        return
      }

      const curr = liveMap.getBearing()
      liveMap.setBearing(curr + 0.03)
      rotationRequestRef.current = requestAnimationFrame(rotateCamera)
    }

    rotationRequestRef.current = requestAnimationFrame(rotateCamera)
  }, [])

  const fetchData = React.useCallback(
    async (
      suburb: ResultSuburb,
      activeDraft: NonNullable<typeof draft>,
      shouldCancel: () => boolean
    ) => {
      setFetchMessage("Fetching local data...")
      setBriefingLoading(false)

      const foundBoundary = await fetchNominatimBoundary(suburb.name)
      if (shouldCancel()) {
        return
      }

      if (!foundBoundary) {
        setBoundary(null)
        setVenueData({ type: "FeatureCollection", features: [] })
        setFetchMessage(null)
        setAiSummary(`No boundary data could be resolved for ${suburb.name}.`)
        return
      }

      setBoundary(foundBoundary)

      const bbox = boundaryToBBox(foundBoundary)
      const map = mapRef.current?.getMap()
      if (map) {
        stopCameraRotation()

        const onMoveEnd = () => {
          if (rotationMoveEndHandlerRef.current) {
            map.off("moveend", rotationMoveEndHandlerRef.current)
            rotationMoveEndHandlerRef.current = null
          }

          startCameraRotation()
        }

        rotationMoveEndHandlerRef.current = onMoveEnd
        map.on("moveend", onMoveEnd)

        map.flyTo({
          center: [(bbox.minLng + bbox.maxLng) / 2, (bbox.minLat + bbox.maxLat) / 2],
          zoom: 15.5,
          pitch: 60,
          bearing: 0,
          essential: true,
          duration: 1400,
        })
      }

      const { rows: resultRows, error: fetchError } = await fetchPlacesInPolygonPaginated(
        foundBoundary.geometry,
        null,
        {
          pageSize: 1000,
          maxPages: 20,
        }
      )

      if (shouldCancel()) {
        return
      }

      if (fetchError) {
        setVenueData({ type: "FeatureCollection", features: [] })
        setFetchMessage(null)
        setAiSummary(`Unable to fetch local venues: ${fetchError}`)
        return
      }

      if (resultRows.length === 0) {
        setVenueData({ type: "FeatureCollection", features: [] })
        setFetchMessage(null)
        setAiSummary(`No local venues were found for ${suburb.name}.`)
        return
      }

      const nextVenueData = toFeatureCollection(resultRows)
      setVenueData(nextVenueData)

      const venueSummary = aggregateVenueSummary(nextVenueData as FeatureCollection<Point, SummaryFeatureProperties>)
      const requestKey = `${suburb.name}:${nextVenueData.features.length}:${JSON.stringify(venueSummary.byCategory)}`

      if (lastSmartResponderRequestKey === requestKey) {
        setFetchMessage(null)
        return
      }

      lastSmartResponderRequestKey = requestKey
      setFetchMessage("AI is analyzing area...")
      setBriefingLoading(true)

      const { data: response, error: invokeError } = await supabase.functions.invoke("smart-responder", {
        body: {
          businessType: activeDraft.businessType,
          targetAudience: activeDraft.targetAudience,
          spendingBracket: activeDraft.spendingBracket,
          suburbName: suburb.name,
          venueData: resultRows,
          venueSummary,
        },
      })

      if (shouldCancel()) {
        return
      }

      if (invokeError) {
        console.error("AI Function Error Details:", invokeError)
        setAiSummary(`Unable to generate briefing: ${invokeError.message}`)
        setBriefingLoading(false)
        setFetchMessage(null)
        return
      }

      const result =
        typeof response === "string"
          ? response
          : response?.briefing ??
            response?.summary ??
            response?.text ??
            JSON.stringify(response, null, 2)

      setAiSummary(result)
      setBriefingLoading(false)
      setFetchMessage(null)
    },
    [draft, startCameraRotation, stopCameraRotation]
  )

  React.useEffect(() => {
    if (!draft) {
      return
    }

    const activeDraft = draft
    let cancelled = false
    const runId = activeRunIdRef.current + 1
    activeRunIdRef.current = runId

    void fetchData(activeSuburb, activeDraft, () => cancelled || activeRunIdRef.current !== runId)

    return () => {
      cancelled = true
      stopCameraRotation()
    }
  }, [activeSuburb, draft, fetchData, stopCameraRotation])

  React.useEffect(() => {
    return () => {
      stopCameraRotation()
    }
  }, [stopCameraRotation])

  React.useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !mapLoaded) {
      return
    }

    const ensure3DBuildings = () => {
      if (!map.getStyle()) {
        return
      }

      apply3DBuildings(map, isDark)
    }

    ensure3DBuildings()
    map.on("style.load", ensure3DBuildings)

    return () => {
      map.off("style.load", ensure3DBuildings)
    }
  }, [isDark, mapLoaded])

  React.useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !mapLoaded || !map.getStyle()) {
      return
    }

    if (map.getLayer(PLACES_CIRCLE_LAYER_ID)) {
      map.setPaintProperty(PLACES_CIRCLE_LAYER_ID, "circle-color", venueCircleColorExpression as any)
      map.setPaintProperty(PLACES_CIRCLE_LAYER_ID, "circle-stroke-color", "#ffffff")
      map.setPaintProperty(PLACES_CIRCLE_LAYER_ID, "circle-stroke-width", 2)
    }

    if (map.getSource(BOUNDARY_SOURCE_ID) && boundary) {
      const payload: FeatureCollection<Polygon | MultiPolygon> = {
        type: "FeatureCollection",
        features: [boundary],
      }

      const existing = map.getSource(BOUNDARY_SOURCE_ID) as GeoJSONSource | undefined
      if (existing) {
        existing.setData(payload)
      }

      const paints = boundaryPaint(isDark)

      if (map.getLayer(BOUNDARY_FILL_LAYER_ID)) {
        map.setPaintProperty(BOUNDARY_FILL_LAYER_ID, "fill-color", paints.fill["fill-color"])
        map.setPaintProperty(BOUNDARY_FILL_LAYER_ID, "fill-opacity", paints.fill["fill-opacity"])
      }

      if (map.getLayer(BOUNDARY_LINE_LAYER_ID)) {
        map.setPaintProperty(BOUNDARY_LINE_LAYER_ID, "line-color", paints.line["line-color"])
        map.setPaintProperty(BOUNDARY_LINE_LAYER_ID, "line-width", paints.line["line-width"])
        map.setPaintProperty(BOUNDARY_LINE_LAYER_ID, "line-opacity", paints.line["line-opacity"])
        map.setPaintProperty(BOUNDARY_LINE_LAYER_ID, "line-blur", paints.line["line-blur"])
      }
    }
  }, [boundary, isDark, mapLoaded, venueData])

  React.useEffect(() => {
    if (!boundary) {
      return
    }

    const map = mapRef.current?.getMap()
    if (!map || !mapLoaded) {
      return
    }

    const clearBoundary = () => {
      if (map.getLayer(BOUNDARY_LINE_LAYER_ID)) {
        map.removeLayer(BOUNDARY_LINE_LAYER_ID)
      }
      if (map.getLayer(BOUNDARY_FILL_LAYER_ID)) {
        map.removeLayer(BOUNDARY_FILL_LAYER_ID)
      }
      if (map.getSource(BOUNDARY_SOURCE_ID)) {
        map.removeSource(BOUNDARY_SOURCE_ID)
      }
    }

    const drawBoundary = () => {
      const payload: FeatureCollection<Polygon | MultiPolygon> = {
        type: "FeatureCollection",
        features: [boundary],
      }

      const existing = map.getSource(BOUNDARY_SOURCE_ID) as GeoJSONSource | undefined
      if (existing) {
        existing.setData(payload)
      } else {
        map.addSource(BOUNDARY_SOURCE_ID, {
          type: "geojson",
          data: payload,
        })
      }

      if (!map.getLayer(BOUNDARY_FILL_LAYER_ID)) {
        const paints = boundaryPaint(isDark)
        map.addLayer({
          id: BOUNDARY_FILL_LAYER_ID,
          type: "fill",
          source: BOUNDARY_SOURCE_ID,
          paint: paints.fill,
        })
      }

      if (!map.getLayer(BOUNDARY_LINE_LAYER_ID)) {
        const paints = boundaryPaint(isDark)
        map.addLayer({
          id: BOUNDARY_LINE_LAYER_ID,
          type: "line",
          source: BOUNDARY_SOURCE_ID,
          paint: paints.line,
        })
      }
    }

    const applyVisualLayers = () => {
      if (!map.getStyle()) {
        return
      }

      apply3DBuildings(map, isDark)
      drawBoundary()
    }

    applyVisualLayers()
    map.on("style.load", applyVisualLayers)
    map.on("styledata", applyVisualLayers)

    return () => {
      map.off("style.load", applyVisualLayers)
      map.off("styledata", applyVisualLayers)
      clearBoundary()
    }
  }, [boundary, isDark, mapLoaded])

  React.useEffect(() => {
    setCountsBySuburb((prev) => ({
      ...prev,
      [activeSuburb.name]: telemetry.total,
    }))
  }, [activeSuburb.name, telemetry.total])

  const goNext = () => setActiveIndex((value) => (value + 1) % demoResults.length)
  const goPrevious = () => setActiveIndex((value) => (value - 1 + demoResults.length) % demoResults.length)
  const jumpToSuburb = (index: number) => setActiveIndex(index)

  const handleExitWithoutSaving = () => {
    exitToDashboardRef.current = true
    setDraft(null)
    toast.info("Exited inquiry without saving.")
    navigate("/dashboard", { replace: true })
  }

  const handleSaveInquiry = async () => {
    if (!draft || !user) {
      return
    }

    setSaveLoading(true)

    const { error: insertError } = await supabase.from("inquiries").insert({
      user_id: user.id,
      business_type: draft.businessType,
      target_audience: draft.targetAudience,
      spending_bracket: draft.spendingBracket,
      results_data: {
        suburbs: demoResults.map((result) => result.name),
        active_suburb: activeSuburb.name,
        venue_counts_by_suburb: countsBySuburb,
        telemetry_by_category: telemetry.byCategory,
      },
    })

    if (insertError) {
      toast.error(`Failed to save inquiry: ${insertError.message}`)
      setSaveLoading(false)
      return
    }

    toast.success("Inquiry saved successfully.")
    exitToDashboardRef.current = true
    setDraft(null)
    setSaveLoading(false)
    navigate("/dashboard", { replace: true })
  }

  return (
    <main className="relative h-svh w-full overflow-hidden">
      {mapboxToken ? (
        <Map
          ref={mapRef}
          onLoad={() => setMapLoaded(true)}
          mapboxAccessToken={mapboxToken}
          initialViewState={{
            longitude: demoResults[0].fallbackCenter[0],
            latitude: demoResults[0].fallbackCenter[1],
            zoom: 14.7,
            pitch: 60,
            bearing: -20,
          }}
          dragRotate={true}
          mapStyle={mapStyle}
          style={{ width: "100%", height: "100%" }}
        >
          <NavigationControl position="bottom-right" />
          <Source
            id="results-places"
            type="geojson"
            data={venueData}
            cluster={true}
            clusterMaxZoom={14}
            clusterRadius={45}
          >
            <Layer {...clusterLayer} />
            <Layer {...clusterCountLayer} />
            <Layer {...unclusteredLayer} />
          </Source>
        </Map>
      ) : (
        <div className="h-full w-full bg-muted" />
      )}

      <div className="absolute top-4 left-1/2 z-50 w-[min(1100px,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl border border-white/20 bg-background/55 px-4 py-3 shadow-2xl backdrop-blur-xl md:px-6">
        <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[220px_1fr_auto] md:gap-4">
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">3D Results Carousel</p>
            <h1 className="text-lg font-semibold">{activeSuburb.name}</h1>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/20 bg-background/40 px-3 py-2">
            {demoResults.map((suburb, index) => {
              const isActive = index === activeIndex

              return (
                <React.Fragment key={suburb.name}>
                  <button
                    type="button"
                    onClick={() => jumpToSuburb(index)}
                    className={`relative rounded-full px-3 py-1 text-sm transition-all duration-300 ${
                      isActive
                        ? "bg-primary/20 text-primary shadow-[0_0_14px_rgba(56,189,248,0.45)]"
                        : "bg-background/40 text-muted-foreground hover:bg-background/60 hover:text-foreground"
                    }`}
                  >
                    {suburb.name}
                    {isActive ? (
                      <span className="pointer-events-none absolute right-2 bottom-0 left-2 h-0.5 rounded-full bg-primary shadow-[0_0_10px_rgba(56,189,248,0.85)]" />
                    ) : null}
                  </button>
                  {index < demoResults.length - 1 ? (
                    <ChevronRight className="size-4 text-muted-foreground/70" />
                  ) : null}
                </React.Fragment>
              )
            })}
          </div>

          <div className="flex justify-self-end gap-2">
            <Button
              variant="secondary"
              className="rounded-2xl"
              onClick={handleExitWithoutSaving}
              disabled={saveLoading}
            >
              Exit Without Saving
            </Button>
            <Button className="rounded-2xl" onClick={handleSaveInquiry} disabled={saveLoading || !draft}>
              {saveLoading ? "Saving..." : "Save Inquiry"}
            </Button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 z-70 -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-full border border-white/25 bg-background/65 p-2 shadow-2xl backdrop-blur-xl">
          <Button
            size="icon"
            variant="outline"
            className="rounded-full border-white/30 bg-background/70 shadow"
            onClick={goPrevious}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <p className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Navigate</p>
          <Button
            size="icon"
            variant="outline"
            className="rounded-full border-white/30 bg-background/70 shadow"
            onClick={goNext}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </div>

      <Card className="absolute top-24 right-4 bottom-4 z-50 w-[min(430px,calc(100%-2rem))] border-border/50 bg-background/65 shadow-2xl backdrop-blur-xl md:right-6">
        <CardHeader>
          <CardTitle>Intelligence Briefing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 rounded-2xl border border-border/60 bg-background/35 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Suburb:</span> {activeSuburb.name}
            </p>
            <p>
              <span className="text-muted-foreground">Raw Venue Count:</span> {telemetry.total}
            </p>
            {fetchMessage ? <p className="text-muted-foreground">{fetchMessage}</p> : null}
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/35 p-3">
            <p className="mb-2 text-xs tracking-wide text-primary uppercase">AI Summary</p>
            {briefingLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <ScrollArea className="h-[50svh] pr-2">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
              </ScrollArea>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
