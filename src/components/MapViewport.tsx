import * as React from "react"
import { Link, useNavigate } from "react-router-dom"
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from "geojson"
import type { ExpressionSpecification, GeoJSONSource } from "mapbox-gl"
import type { Map as MapboxMap } from "mapbox-gl"
import Map, {
  Layer,
  type LayerProps,
  type MapMouseEvent,
  type MapRef,
  NavigationControl,
  Source,
} from "react-map-gl/mapbox"

import { FilterPanel } from "@/components/FilterPanel"
import { SearchBar, type SearchResultItem } from "@/components/SearchBar"
import { useTheme } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { PLACE_CATEGORY_OPTIONS } from "@/lib/place-categories"
import { supabase } from "@/lib/supabase"
<<<<<<< HEAD
import { useSupabasePlaces } from "../hooks/useSupabasePlaces"
=======
import { buildSelection, CATEGORY_ICON_MAP } from "@/lib/selectionIcons"
import type { ClusterSelection } from "@/types/selection"
import { MapPin } from "lucide-react"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
>>>>>>> 2bffc34e8eea357aab9617a8ab2c728d3fa9341c

const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN

const BOUNDARY_SOURCE_ID   = "area-boundary"
const BOUNDARY_LINE_LAYER_ID = "area-border"
const BOUNDARY_FILL_LAYER_ID = "area-fill"
const BUILDINGS_LAYER_ID = "3d-buildings"

const CATEGORY_COLORS: Record<string, string> = {
  "Arts and Entertainment":            "#0d4c3c",
  "Business and Professional Service": "#003f5c",
  "Community and Government":          "#2c4875",
  "Dining and Drinking":               "#8a508f",
  Event:                               "#bc5090",
  "Health and Medicine":               "#ff6361",
  "Landmarks and Outdoors":            "#ff8531",
  Retail:                              "#ffa600",
  "Sports and Recreation":             "#ffd380",
  "Travel and Transportation":         "#0db488",
}

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type MapboxSuggestion = SearchResultItem

type NominatimResult = {
  display_name: string
  geojson?: {
    type?: string
    coordinates?: unknown
  }
}

type MapViewportProps = {
  region: string
}

// ---------------------------------------------------------------------------
// Module-level constants (NO hooks here)
// ---------------------------------------------------------------------------

const defaultCategories = ["Dining and Drinking", "Health and Medicine", "Retail"]

const defaultSelection: ClusterSelection = {
  type:  "none",
  label: "No active selection",
  count: 0,
  icon:  MapPin,
  color: "#6b7280",
}

// ---------------------------------------------------------------------------
// Mapbox layer specs
// ---------------------------------------------------------------------------

const clusterRadiusExpression: ExpressionSpecification = [
  "step",
  ["get", "point_count"],
  20,
  25,
  30,
  60,
  38,
  120,
  46,
]

const categoryColorExpression: ExpressionSpecification = [
  "match",
  ["get", "level1_category_name"],
  "Arts and Entertainment",            CATEGORY_COLORS["Arts and Entertainment"],
  "Business and Professional Service", CATEGORY_COLORS["Business and Professional Service"],
  "Community and Government",          CATEGORY_COLORS["Community and Government"],
  "Dining and Drinking",               CATEGORY_COLORS["Dining and Drinking"],
  "Event",                             CATEGORY_COLORS.Event,
  "Health and Medicine",               CATEGORY_COLORS["Health and Medicine"],
  "Landmarks and Outdoors",            CATEGORY_COLORS["Landmarks and Outdoors"],
  "Retail",                            CATEGORY_COLORS.Retail,
  "Sports and Recreation",             CATEGORY_COLORS["Sports and Recreation"],
  "Travel and Transportation",         CATEGORY_COLORS["Travel and Transportation"],
  "#9ca3af",
]

const clusterLayer: LayerProps = {
  id:     "clusters",
  type:   "circle",
  source: "places",
  filter: ["has", "point_count"],
  paint: {
    "circle-color":        "#00e5ff",
    "circle-radius":       clusterRadiusExpression,
    "circle-opacity":      0.95,
    "circle-stroke-width": 3,
    "circle-stroke-color": "#f8fafc",
    "circle-blur":         0.1,
  },
}

const clusterCountLayer: LayerProps = {
  id:     "cluster-count",
  type:   "symbol",
  source: "places",
  filter: ["has", "point_count"],
  layout: {
    "text-field": ["get", "point_count_abbreviated"],
    "text-font":  ["Open Sans Bold", "Arial Unicode MS Bold"],
    "text-size":  12,
  },
  paint: {
    "text-color": "#111827",
  },
}

const unclusteredLayer: LayerProps = {
  id:     "unclustered-point",
  type:   "circle",
  source: "places",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color":        categoryColorExpression,
    "circle-radius":       8,
    "circle-stroke-width": 2.8,
    "circle-stroke-color": "#ffffff",
    "circle-blur":         0.08,
  },
}

<<<<<<< HEAD
function boundaryToBBox(boundary: Feature<Polygon | MultiPolygon>) {
=======
// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function boundaryToBBox(boundary: Feature<Polygon | MultiPolygon>): BBox {
>>>>>>> 2bffc34e8eea357aab9617a8ab2c728d3fa9341c
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

function safeSetPaint(
  map: MapboxMap,
  layerId: string,
  property: string,
  value: string | number,
) {
  try {
    ;(map as unknown as {
      setPaintProperty: (layer: string, prop: string, val: string | number) => void
    }).setPaintProperty(layerId, property, value)
  } catch {
    // Ignore missing/incompatible paint properties for style layers.
  }
}

function applyMapStyleTweaks(map: MapboxMap, isDark: boolean) {
  const style  = map.getStyle()
  const layers = style?.layers ?? []

  for (const layer of layers) {
    if (layer.type === "background") {
      safeSetPaint(map, layer.id, "background-color", isDark ? "#101317" : "#f1f3f5")
    }
    if (layer.type === "fill" && layer.id.includes("land")) {
      safeSetPaint(map, layer.id, "fill-color", isDark ? "#161b22" : "#eceff3")
    }
    if (layer.type === "fill" && layer.id.includes("water")) {
      safeSetPaint(map, layer.id, "fill-color", isDark ? "#0f2235" : "#d7e3f5")
    }
    if (layer.type === "line" && layer.id.includes("road")) {
      safeSetPaint(map, layer.id, "line-color",   isDark ? "#2d3440" : "#9aa3af")
      safeSetPaint(map, layer.id, "line-opacity",  isDark ? 0.9 : 0.8)
    }
    if (layer.type === "line" && (layer.id.includes("admin") || layer.id.includes("boundary"))) {
      safeSetPaint(map, layer.id, "line-color",   isDark ? "#4b5563" : "#111827")
      safeSetPaint(map, layer.id, "line-width",   isDark ? 1.25 : 1.05)
      safeSetPaint(map, layer.id, "line-opacity", isDark ? 0.95 : 0.9)
    }
  }
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
          "fill-extrusion-color": isDark ? "#273244" : "#c9c3b8",
          "fill-extrusion-height": ["coalesce", ["get", "height"], 0],
          "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
          "fill-extrusion-opacity": isDark ? 0.78 : 0.72,
        },
      },
      labelLayer
    )
  } catch {
    // Some styles may not expose the building source-layer; ignore safely.
  }
}

async function fetchNominatimBoundary(query: string): Promise<{
  boundary: Feature<Polygon | MultiPolygon>
  label: string
} | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&polygon_geojson=1&addressdetails=1&limit=5&email=your_email@example.com`

  const response = await fetch(url)
  const results  = (await response.json()) as NominatimResult[]

  const match = results.find(
    (item) => item.geojson?.type === "Polygon" || item.geojson?.type === "MultiPolygon",
  )

  if (!match?.geojson?.type || !match.geojson.coordinates) return null
  if (match.geojson.type !== "Polygon" && match.geojson.type !== "MultiPolygon") return null

  const boundary: Feature<Polygon | MultiPolygon> = {
    type: "Feature",
    geometry: {
      type: match.geojson.type,
      coordinates: match.geojson.coordinates as
        | Polygon["coordinates"]
        | MultiPolygon["coordinates"],
    } as Polygon | MultiPolygon,
    properties: {},
  }

  const label = match.display_name.split(",")[0]?.trim() || query
  return { boundary, label }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MapViewport({ region }: MapViewportProps) {
<<<<<<< HEAD
  const navigate = useNavigate()
  const mapRef = React.useRef<MapRef | null>(null)
=======
  const mapRef    = React.useRef<MapRef | null>(null)
>>>>>>> 2bffc34e8eea357aab9617a8ab2c728d3fa9341c
  const { theme } = useTheme()

  // --- state ----------------------------------------------------------------
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>(defaultCategories)
<<<<<<< HEAD
  const [queryGeometry, setQueryGeometry] = React.useState<Polygon | MultiPolygon | null>(null)
  const [queryTrigger, setQueryTrigger] = React.useState(0)
  const [highlightBoundary, setHighlightBoundary] = React.useState<
    Feature<Polygon | MultiPolygon> | null
  >(null)
  const [activeAreaLabel, setActiveAreaLabel] = React.useState<string | null>(null)
  const [selection, setSelection] = React.useState<ClusterSelection>({
    type: "none",
    label: "No active selection",
    count: 0,
  })
  const [briefing, setBriefing] = React.useState(
    "Search and select an area to highlight its true boundary and extract business intelligence."
=======
  const [queryBBox,           setQueryBBox]          = React.useState<BBox | null>(null)
  const [highlightBoundary,   setHighlightBoundary]  = React.useState<Feature<Polygon | MultiPolygon> | null>(null)
  const [pendingQueryBBox,    setPendingQueryBBox]   = React.useState<BBox | null>(null)
  const [activeAreaLabel,     setActiveAreaLabel]    = React.useState<string | null>(null)
  const [selection,           setSelection]          = React.useState<ClusterSelection>(defaultSelection)
  const [briefing,            setBriefing]           = React.useState(
    "Search and select an area to highlight its true boundary and extract business intelligence.",
>>>>>>> 2bffc34e8eea357aab9617a8ab2c728d3fa9341c
  )
  const [isBriefingLoading, setIsBriefingLoading] = React.useState(false)
  const [searchQuery,       setSearchQuery]        = React.useState("")
  const [searchResults,     setSearchResults]      = React.useState<MapboxSuggestion[]>([])
  const [searchLoading,     setSearchLoading]      = React.useState(false)
  const [searchOpen,        setSearchOpen]         = React.useState(false)

<<<<<<< HEAD
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<MapboxSuggestion[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)

  const { data, loading, error, telemetry } = useSupabasePlaces(
    queryGeometry,
    selectedCategories,
    queryTrigger
  )
=======
  // --- data -----------------------------------------------------------------
  const { data, loading, error, telemetry } = useSupabasePlaces(queryBBox, selectedCategories)
>>>>>>> 2bffc34e8eea357aab9617a8ab2c728d3fa9341c

  // --- derived --------------------------------------------------------------
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const mapStyle = isDark
    ? "mapbox://styles/mapbox/dark-v11"
    : "mapbox://styles/mapbox/light-v11"

  // --- effects --------------------------------------------------------------

  // Mapbox geocoder search
  React.useEffect(() => {
    if (!mapboxToken) return

    const normalized = searchQuery.trim()
    if (normalized.length < 2) return

    const controller = new AbortController()
    const timeout    = window.setTimeout(async () => {
      setSearchLoading(true)
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalized)}.json?access_token=${mapboxToken}&autocomplete=true&limit=8&types=place,postcode,locality`,
          { signal: controller.signal },
        )
        const payload = (await response.json()) as {
          features?: Array<{ id: string; place_name: string }>
        }
        setSearchResults(
          (payload.features ?? []).map((f) => ({ id: f.id, label: f.place_name })),
        )
        setSearchOpen(true)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 280)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [searchQuery])

  // Boundary + style tweaks
  React.useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const clearBoundaryLayers = () => {
      if (map.getLayer(BOUNDARY_LINE_LAYER_ID)) map.removeLayer(BOUNDARY_LINE_LAYER_ID)
      if (map.getLayer(BOUNDARY_FILL_LAYER_ID)) map.removeLayer(BOUNDARY_FILL_LAYER_ID)
      if (map.getSource(BOUNDARY_SOURCE_ID))    map.removeSource(BOUNDARY_SOURCE_ID)
    }

    const drawBoundaryLayers = () => {
      if (!highlightBoundary) {
        clearBoundaryLayers()
        return
      }

      const sourcePayload: FeatureCollection<Polygon | MultiPolygon> = {
        type:     "FeatureCollection",
        features: [highlightBoundary],
      }

      const existing = map.getSource(BOUNDARY_SOURCE_ID) as GeoJSONSource | undefined
      if (existing) {
        existing.setData(sourcePayload)
      } else {
        map.addSource(BOUNDARY_SOURCE_ID, { type: "geojson", data: sourcePayload })
      }

      if (!map.getLayer(BOUNDARY_FILL_LAYER_ID)) {
        map.addLayer({
          id:     BOUNDARY_FILL_LAYER_ID,
          type:   "fill",
          source: BOUNDARY_SOURCE_ID,
          paint:  { "fill-color": "#ffbf00", "fill-opacity": 0.1 },
        })
      }

      if (!map.getLayer(BOUNDARY_LINE_LAYER_ID)) {
        map.addLayer({
          id:     BOUNDARY_LINE_LAYER_ID,
          type:   "line",
          source: BOUNDARY_SOURCE_ID,
          paint:  { "line-color": "#ffbf00", "line-width": 3, "line-blur": 1, "line-opacity": 1 },
        })
      }

      const bbox = boundaryToBBox(highlightBoundary)
      map.fitBounds(
        [[bbox.minLng, bbox.minLat], [bbox.maxLng, bbox.maxLat]],
        { padding: 54, duration: 920, maxZoom: 13.8 },
      )

    }

    if (map.isStyleLoaded()) {
      applyMapStyleTweaks(map, isDark)
      apply3DBuildings(map, isDark)
      drawBoundaryLayers()
    }

    const handleStyleData = () => {
      if (!map.isStyleLoaded()) return
      applyMapStyleTweaks(map, isDark)
      apply3DBuildings(map, isDark)
      drawBoundaryLayers()
    }

    map.on("styledata", handleStyleData)
<<<<<<< HEAD

    return () => {
      map.off("styledata", handleStyleData)
    }
  }, [highlightBoundary, isDark])
=======
    return () => { map.off("styledata", handleStyleData) }
  }, [highlightBoundary, isDark, pendingQueryBBox])
>>>>>>> 2bffc34e8eea357aab9617a8ab2c728d3fa9341c

  // --- callbacks ------------------------------------------------------------

  const generateBriefing = React.useCallback(
    async (pointCount: number) => {
      setIsBriefingLoading(true)
      const { data: response, error: invokeError } = await supabase.functions.invoke(
<<<<<<< HEAD
        "smart-responder",
        {
          body: {
            region,
            pointCount,
            categories: selectedCategories,
            activeArea: activeAreaLabel,
          },
        }
=======
        "generate-briefing",
        { body: { region, pointCount, categories: selectedCategories, activeArea: activeAreaLabel } },
>>>>>>> 2bffc34e8eea357aab9617a8ab2c728d3fa9341c
      )

      if (invokeError) {
        setBriefing(`Unable to generate briefing: ${invokeError.message}`)
        setIsBriefingLoading(false)
        return
      }

      const result =
        typeof response === "string"
          ? response
          : response?.briefing ?? response?.summary ?? response?.text ?? JSON.stringify(response, null, 2)

      setBriefing(result)
      setIsBriefingLoading(false)
    },
    [activeAreaLabel, region, selectedCategories],
  )

  const handleSearchResultSelect = React.useCallback(async (feature: MapboxSuggestion) => {
    setQueryGeometry(null)
    setSearchLoading(true)
    try {
      const nominatimMatch = await fetchNominatimBoundary(feature.label)

      if (!nominatimMatch) {
        setBriefing("Unable to extract a true administrative boundary for this result. Try another area.")
        return
      }

      setSearchQuery(feature.label)
      setSearchOpen(false)
      setSearchResults([])
      setActiveAreaLabel(nominatimMatch.label)
      // ✅ Uses buildSelection — consistent with the updated ClusterSelection type
      setSelection(buildSelection("none", "No active selection", 0))
      setBriefing(`Targeting Area: ${nominatimMatch.label}. Extracting local business intelligence...`)
      setHighlightBoundary(nominatimMatch.boundary)
      setQueryGeometry(nominatimMatch.boundary.geometry)
      setQueryTrigger((value) => value + 1)
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const handleSearchAreaClick = React.useCallback(() => {
<<<<<<< HEAD
    if (!highlightBoundary) {
      return
    }

    setQueryGeometry(highlightBoundary.geometry)
    setQueryTrigger((value) => value + 1)
=======
    if (!highlightBoundary) return
    setQueryBBox(boundaryToBBox(highlightBoundary))
>>>>>>> 2bffc34e8eea357aab9617a8ab2c728d3fa9341c
  }, [highlightBoundary])

  const handleMapClick = React.useCallback(
    (event: MapMouseEvent) => {
      if (!mapRef.current || !activeAreaLabel) return

      const map      = mapRef.current.getMap()
      const features = map.queryRenderedFeatures(event.point, {
        layers: ["clusters", "unclustered-point"],
      })

      if (!features.length) return

      const feature = features[0]
      const source  = map.getSource("places") as GeoJSONSource | undefined
      const layerId = feature.layer?.id

      // Cluster click
      if (layerId === "clusters" && source) {
        const clusterId  = feature.properties?.cluster_id
        const pointCount = Number(feature.properties?.point_count ?? 0)

        source.getClusterExpansionZoom(clusterId, (zoomError, zoom) => {
          if (zoomError || typeof zoom !== "number") return
          if (feature.geometry.type !== "Point") return
          map.easeTo({
            center:   feature.geometry.coordinates as [number, number],
            zoom,
            duration: 450,
          })
        })

        // ✅ Replaced
        setSelection(buildSelection("cluster", `Cluster in ${activeAreaLabel}`, pointCount))
        void generateBriefing(pointCount)
        return
      }

      // Individual point click
      if (layerId === "unclustered-point") {
        // ✅ Replaced
        const category = String(feature.properties?.level1_category_name ?? "Venue")
        setSelection(buildSelection("point", category, 1, category))
      }
    },
    [activeAreaLabel, generateBriefing],
  )

  const clearSelection = React.useCallback(() => {
    setQueryGeometry(null)
    setHighlightBoundary(null)
    setActiveAreaLabel(null)
    setSearchResults([])
    setSearchOpen(false)
    // ✅ Replaced
    setSelection(buildSelection("none", "No active selection", 0))
    setBriefing("Search and select an area to highlight its true boundary and extract business intelligence.")
  }, [])

  // --- derived render values ------------------------------------------------

  const sourceData = React.useMemo(() => data as FeatureCollection<Point>, [data])

  const cardClassName =
    "border-border/50 bg-background/60 shadow-2xl shadow-primary/10 backdrop-blur-md"

  const aiStatus = activeAreaLabel
    ? `TARGETING: ${activeAreaLabel}`
    : "READY: SELECT TARGET AREA"

  // --- render ---------------------------------------------------------------

  return (
    <main className="relative h-svh w-full overflow-hidden">
      {mapboxToken ? (
        <Map
          ref={mapRef}
          mapboxAccessToken={mapboxToken}
          initialViewState={{ longitude: 151.2093, latitude: -33.8688, zoom: 9 }}
          mapStyle={mapStyle}
          style={{ width: "100%", height: "100%" }}
          keyboard={false}
          interactiveLayerIds={["clusters", "unclustered-point"]}
          onClick={handleMapClick}
        >
          <NavigationControl position="bottom-right" />
          <Source
            id="places"
            type="geojson"
            data={sourceData}
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

<<<<<<< HEAD
      <div className="pointer-events-none absolute inset-0 z-10 bg-linear-to-b from-black/5 via-transparent to-black/20 dark:from-black/30 dark:to-black/55" />
=======
      {/* Gradient overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/5 via-transparent to-black/20 dark:from-black/30 dark:to-black/55" />
>>>>>>> 2bffc34e8eea357aab9617a8ab2c728d3fa9341c

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-50 md:top-5 md:right-5">
        <ThemeToggle />
      </div>

      {/* Search bar */}
      <div className="absolute top-4 left-1/2 z-50 w-[min(960px,calc(100%-0.75rem))] -translate-x-1/2 md:top-5 md:w-[min(920px,calc(100%-2rem))]">
        <SearchBar
          value={searchQuery}
          onValueChange={(value) => {
            setSearchQuery(value)
            if (value.trim().length < 2) {
              setSearchResults([])
              setSearchOpen(false)
            }
          }}
          results={searchResults}
          loading={searchLoading}
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onSelectResult={(item) => { void handleSearchResultSelect(item) }}
        />
      </div>

      {/* Filter panel — desktop */}
      <div className="absolute top-22 left-4 z-40 hidden w-[min(370px,calc(100%-2rem))] md:block lg:top-24 lg:left-6">
        <FilterPanel
          selectedCategories={selectedCategories}
          onChangeCategories={setSelectedCategories}
          onSelectAllCategories={() => setSelectedCategories([...PLACE_CATEGORY_OPTIONS])}
          onClearCategories={() => setSelectedCategories([])}
          onSearchArea={handleSearchAreaClick}
          categoryColors={CATEGORY_COLORS}
          searchEnabled={Boolean(highlightBoundary)}
          loading={loading}
          error={error}
        />
      </div>

      {/* AI Overview card — desktop */}
      <Card className={`absolute top-22 right-4 z-40 hidden w-[min(430px,calc(100%-2rem))] md:block lg:top-24 lg:right-6 ${cardClassName}`}>
        <CardHeader>
          <CardTitle>AI Overview &amp; Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs font-medium tracking-wide text-primary uppercase">{aiStatus}</p>
          {isBriefingLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ) : (
            <ScrollArea className="h-44 pr-3">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{briefing}</p>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Selection card — desktop */}
      <Card className={`absolute right-4 bottom-4 z-40 hidden w-[min(370px,calc(100%-2rem))] md:block lg:right-6 lg:bottom-6 ${cardClassName}`}>
        <CardHeader>
          <CardTitle>Current Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">

          {/* Icon + label header */}
          <div className="flex items-center gap-2">
            <selection.icon
              size={18}
              style={{ color: selection.color }}
              strokeWidth={2}
            />
            <span className="font-medium" style={{ color: selection.color }}>
              {selection.label}
            </span>
          </div>

          <p>
            <span className="text-muted-foreground">Active Area:</span>{" "}
            {activeAreaLabel ?? "No active search area"}
          </p>
          <p>
            <span className="text-muted-foreground">Selected Count:</span> {selection.count}
          </p>
          <p>
            <span className="text-muted-foreground">Venue Count:</span> {telemetry.total}
          </p>
<<<<<<< HEAD
          <div className="space-y-1">
            {Object.entries(telemetry.byCategory as Record<string, number>).map(([name, count]) => (
              <p key={name}>
                <span className="text-muted-foreground">{name}:</span> {count}
              </p>
            ))}
=======

          {/* Category breakdown with icons */}
          <div className="space-y-1 pt-1">
            {Object.entries(telemetry.byCategory).map(([name, count]) => {
              const meta = CATEGORY_ICON_MAP[name]
              const Icon = meta?.icon
              return (
                <div key={name} className="flex items-center gap-2">
                  {Icon && (
                    <Icon size={13} style={{ color: meta.color }} strokeWidth={2} />
                  )}
                  <span className="text-muted-foreground">{name}:</span>
                  <span>{count}</span>
                </div>
              )
            })}
>>>>>>> 2bffc34e8eea357aab9617a8ab2c728d3fa9341c
          </div>

          <div className="mt-3 flex gap-2">
            <Button variant="outline" className="flex-1 rounded-2xl" onClick={clearSelection}>
              Clear Selection
            </Button>
            <Button asChild className="flex-1 rounded-2xl">
              <Link to="/details">Deep Dive</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* User profile */}
      <div className="absolute bottom-4 left-4 z-40 lg:bottom-6 lg:left-6">
        <Button
          variant="secondary"
          className="rounded-2xl border-border/60 bg-background/70 shadow-2xl backdrop-blur-md"
          onClick={() => navigate("/dashboard")}
        >
          Back to Dashboard
        </Button>
      </div>

      {/* Mobile panels */}
      <div className="absolute right-3 bottom-3 left-3 z-40 space-y-2 md:hidden">
        <Card className={cardClassName}>
          <CardContent className="p-3">
            <details open>
              <summary className="cursor-pointer py-1 text-sm font-medium">Filter of Area</summary>
              <div className="pt-3">
                <FilterPanel
                  compact
                  selectedCategories={selectedCategories}
                  onChangeCategories={setSelectedCategories}
                  onSelectAllCategories={() => setSelectedCategories([...PLACE_CATEGORY_OPTIONS])}
                  onClearCategories={() => setSelectedCategories([])}
                  onSearchArea={handleSearchAreaClick}
                  categoryColors={CATEGORY_COLORS}
                  searchEnabled={Boolean(highlightBoundary)}
                  loading={loading}
                  error={error}
                />
              </div>
            </details>
          </CardContent>
        </Card>

        <Card className={cardClassName}>
          <CardContent className="p-3">
            <details>
              <summary className="cursor-pointer py-1 text-sm font-medium">AI Overview</summary>
              <div className="pt-3">
                <p className="mb-2 text-xs font-medium tracking-wide text-primary uppercase">{aiStatus}</p>
                {isBriefingLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-11/12" />
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{briefing}</p>
                )}
              </div>
            </details>
          </CardContent>
        </Card>

        <Card className={cardClassName}>
          <CardContent className="space-y-3 p-3 text-sm">
            <details>
              <summary className="cursor-pointer py-1 text-sm font-medium">Current Selection</summary>
              <div className="space-y-2 pt-3">

                {/* Icon + label — mobile */}
                <div className="flex items-center gap-2">
                  <selection.icon
                    size={16}
                    style={{ color: selection.color }}
                    strokeWidth={2}
                  />
                  <span className="font-medium" style={{ color: selection.color }}>
                    {selection.label}
                  </span>
                </div>

                <p>
                  <span className="text-muted-foreground">Active Area:</span>{" "}
                  {activeAreaLabel ?? "No active search area"}
                </p>
                <p>
                  <span className="text-muted-foreground">Venue Count:</span> {telemetry.total}
                </p>
                <Button variant="outline" className="w-full rounded-2xl" onClick={clearSelection}>
                  Clear Selection
                </Button>
                <Button asChild className="w-full rounded-2xl">
                  <Link to="/details">Deep Dive</Link>
                </Button>
              </div>
            </details>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
