import * as React from "react"
import { Link } from "react-router-dom"
import type { FeatureCollection, Point } from "geojson"
import type { ExpressionSpecification, GeoJSONSource } from "mapbox-gl"
import { Search, X } from "lucide-react"
import Map, {
  Layer,
  type LayerProps,
  type MapMouseEvent,
  type MapRef,
  NavigationControl,
  Source,
} from "react-map-gl/mapbox"

import { FilterPanel } from "@/components/FilterPanel"
import { useTheme } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { type BBox, useSupabasePlaces } from "@/hooks/useSupabasePlaces"
import { supabase } from "@/lib/supabase"

const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN

type ClusterSelection = {
  type: "cluster" | "point" | "none"
  label: string
  count: number
}

type GeocodeFeature = {
  id: string
  place_name: string
  center: [number, number]
}

type MapViewportProps = {
  region: string
}

const defaultCategories = [
  "Dining and Drinking",
  "Health and Medicine",
  "Retail",
]

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

const clusterLayer: LayerProps = {
  id: "clusters",
  type: "circle",
  source: "places",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": "#0ea5e9",
    "circle-radius": clusterRadiusExpression,
    "circle-opacity": 0.82,
    "circle-stroke-width": 2,
    "circle-stroke-color": "#f8fafc",
  },
}

const clusterCountLayer: LayerProps = {
  id: "cluster-count",
  type: "symbol",
  source: "places",
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

const unclusteredLayer: LayerProps = {
  id: "unclustered-point",
  type: "circle",
  source: "places",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": [
      "match",
      ["get", "level1_category_name"],
      "Dining and Drinking",
      "#2563eb",
      "Health and Medicine",
      "#10b981",
      "Retail",
      "#f59e0b",
      "#64748b",
    ],
    "circle-radius": 8,
    "circle-stroke-width": 1.5,
    "circle-stroke-color": "#ffffff",
  },
}

function getCurrentBounds(map: MapRef): BBox | null {
  const bounds = map.getBounds()
  if (!bounds) {
    return null
  }

  return {
    minLng: bounds.getWest(),
    minLat: bounds.getSouth(),
    maxLng: bounds.getEast(),
    maxLat: bounds.getNorth(),
  }
}

export function MapViewport({ region }: MapViewportProps) {
  const mapRef = React.useRef<MapRef | null>(null)
  const { theme } = useTheme()

  const [selectedCategories, setSelectedCategories] = React.useState<string[]>(defaultCategories)
  const [queryBBox, setQueryBBox] = React.useState<BBox | null>(null)
  const [activeAreaLabel, setActiveAreaLabel] = React.useState<string | null>(null)
  const [selection, setSelection] = React.useState<ClusterSelection>({
    type: "none",
    label: "No active selection",
    count: 0,
  })
  const [briefing, setBriefing] = React.useState(
    "Search an area or click 'Search This Area' to load map intelligence."
  )
  const [isBriefingLoading, setIsBriefingLoading] = React.useState(false)

  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<GeocodeFeature[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [pendingSearchAreaLabel, setPendingSearchAreaLabel] = React.useState<string | null>(null)

  const { data, loading, error, telemetry } = useSupabasePlaces(queryBBox, selectedCategories)

  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const mapStyle = isDark
    ? "mapbox://styles/mapbox/satellite-streets-v12"
    : "mapbox://styles/mapbox/streets-v12"

  React.useEffect(() => {
    if (!mapboxToken) {
      return
    }

    const normalized = searchQuery.trim()
    if (normalized.length < 2) {
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setSearchLoading(true)
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalized)}.json?access_token=${mapboxToken}&autocomplete=true&limit=6`,
          { signal: controller.signal }
        )
        const payload = (await response.json()) as { features?: GeocodeFeature[] }
        setSearchResults(payload.features ?? [])
        setSearchOpen(true)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 320)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [searchQuery])

  const runSearchForCurrentBounds = React.useCallback(
    (label: string) => {
      if (!mapRef.current) {
        return
      }

      const bbox = getCurrentBounds(mapRef.current)
      if (!bbox) {
        return
      }

      setQueryBBox(bbox)
      setActiveAreaLabel(label)
      setSelection({
        type: "none",
        label: "No active selection",
        count: 0,
      })
    },
    []
  )

  const handleSearchAreaClick = React.useCallback(() => {
    runSearchForCurrentBounds(activeAreaLabel ?? "Current map area")
  }, [activeAreaLabel, runSearchForCurrentBounds])

  const handleSearchResultSelect = React.useCallback((feature: GeocodeFeature) => {
    setSearchQuery(feature.place_name)
    setSearchOpen(false)
    setPendingSearchAreaLabel(feature.place_name)

    if (!mapRef.current) {
      return
    }

    mapRef.current.flyTo({
      center: feature.center,
      zoom: 12,
      duration: 1200,
      essential: true,
    })
  }, [])

  const handleMapMoveEnd = React.useCallback(() => {
    if (pendingSearchAreaLabel) {
      runSearchForCurrentBounds(pendingSearchAreaLabel)
      setPendingSearchAreaLabel(null)
    }
  }, [pendingSearchAreaLabel, runSearchForCurrentBounds])

  const generateBriefing = React.useCallback(
    async (pointCount: number) => {
      setIsBriefingLoading(true)
      const { data: response, error: invokeError } = await supabase.functions.invoke(
        "generate-briefing",
        {
          body: {
            region,
            pointCount,
            categories: selectedCategories,
            activeArea: activeAreaLabel,
          },
        }
      )

      if (invokeError) {
        setBriefing(`Unable to generate briefing: ${invokeError.message}`)
        setIsBriefingLoading(false)
        return
      }

      const result =
        typeof response === "string"
          ? response
          : response?.briefing ??
            response?.summary ??
            response?.text ??
            JSON.stringify(response, null, 2)

      setBriefing(result)
      setIsBriefingLoading(false)
    },
    [activeAreaLabel, region, selectedCategories]
  )

  const handleMapClick = React.useCallback(
    (event: MapMouseEvent) => {
      if (!mapRef.current || !activeAreaLabel) {
        return
      }

      const map = mapRef.current.getMap()
      const features = map.queryRenderedFeatures(event.point, {
        layers: ["clusters", "unclustered-point"],
      })

      if (!features.length) {
        return
      }

      const feature = features[0]
      const source = map.getSource("places") as GeoJSONSource | undefined
      const layerId = feature.layer?.id

      if (layerId === "clusters" && source) {
        const clusterId = feature.properties?.cluster_id
        const pointCount = Number(feature.properties?.point_count ?? 0)

        source.getClusterExpansionZoom(clusterId, (zoomError, zoom) => {
          if (zoomError || typeof zoom !== "number") {
            return
          }

          if (feature.geometry.type !== "Point") {
            return
          }

          map.easeTo({
            center: feature.geometry.coordinates as [number, number],
            zoom,
            duration: 450,
          })
        })

        setSelection({
          type: "cluster",
          label: `Cluster in ${activeAreaLabel}`,
          count: pointCount,
        })

        void generateBriefing(pointCount)
        return
      }

      if (layerId === "unclustered-point") {
        const category = String(feature.properties?.level1_category_name ?? "Venue")
        setSelection({
          type: "point",
          label: category,
          count: 1,
        })
      }
    },
    [activeAreaLabel, generateBriefing]
  )

  const clearSelection = React.useCallback(() => {
    setQueryBBox(null)
    setActiveAreaLabel(null)
    setSearchResults([])
    setSearchOpen(false)
    setSelection({
      type: "none",
      label: "No active selection",
      count: 0,
    })
    setBriefing("Search an area or click 'Search This Area' to load map intelligence.")
  }, [])

  const sourceData = React.useMemo(() => data as FeatureCollection<Point>, [data])

  const desktopCardClassName =
    "border-border/50 bg-background/60 shadow-2xl shadow-primary/10 backdrop-blur-md"

  return (
    <main className="relative h-svh w-full overflow-hidden">
      {mapboxToken ? (
        <Map
          ref={mapRef}
          mapboxAccessToken={mapboxToken}
          initialViewState={{ longitude: 133.7751, latitude: -25.2744, zoom: 3.8 }}
          mapStyle={mapStyle}
          style={{ width: "100%", height: "100%" }}
          onMoveEnd={handleMapMoveEnd}
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

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/5 via-transparent to-black/20 dark:from-black/30 dark:to-black/55" />

      <div className="absolute top-5 right-5 z-40">
        <ThemeToggle />
      </div>

      <Card className="absolute top-5 left-1/2 z-40 w-[min(760px,calc(100%-2rem))] -translate-x-1/2 border-border/50 bg-background/60 shadow-2xl shadow-primary/10 backdrop-blur-md">
        <CardContent className="p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => {
                const value = event.target.value
                setSearchQuery(value)
                if (value.trim().length < 2) {
                  setSearchResults([])
                  setSearchOpen(false)
                }
              }}
              onFocus={() => setSearchOpen(searchResults.length > 0)}
              className="h-11 rounded-2xl pr-3 pl-9"
              placeholder="Search suburb, postcode, or state (e.g. Parramatta, 2000, NSW)"
            />

            {searchOpen ? (
              <div className="absolute right-0 left-0 mt-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-lg">
                <Command>
                  <CommandList>
                    {searchLoading ? (
                      <div className="space-y-2 p-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-4/5" />
                      </div>
                    ) : null}
                    <CommandEmpty>No places found.</CommandEmpty>
                    <CommandGroup heading="Mapbox Results">
                      {searchResults.map((feature) => (
                        <CommandItem
                          key={feature.id}
                          value={feature.place_name}
                          onSelect={() => handleSearchResultSelect(feature)}
                        >
                          {feature.place_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="absolute top-24 left-6 z-30 hidden w-[min(360px,calc(100%-3rem))] md:block">
        <FilterPanel
          selectedCategories={selectedCategories}
          onChangeCategories={setSelectedCategories}
          onSearchArea={handleSearchAreaClick}
          loading={loading}
          error={error}
        />
      </div>

      <Card className={`absolute top-24 right-6 z-30 hidden w-[min(420px,calc(100%-3rem))] md:block ${desktopCardClassName}`}>
        <CardHeader>
          <CardTitle>AI Overview &amp; Description</CardTitle>
        </CardHeader>
        <CardContent>
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

      <Card className={`absolute right-6 bottom-6 z-30 hidden w-[min(360px,calc(100%-3rem))] md:block ${desktopCardClassName}`}>
        <CardHeader>
          <CardTitle>Current Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Active Area:</span>{" "}
            {activeAreaLabel ?? "No active search area"}
          </p>
          <p>
            <span className="text-muted-foreground">Selection:</span> {selection.label}
          </p>
          <p>
            <span className="text-muted-foreground">Selected Count:</span> {selection.count}
          </p>
          <p>
            <span className="text-muted-foreground">Venue Count:</span> {telemetry.total}
          </p>
          <div className="space-y-1">
            {Object.entries(telemetry.byCategory).map(([name, count]) => (
              <p key={name}>
                <span className="text-muted-foreground">{name}:</span> {count}
              </p>
            ))}
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

      <div className="absolute bottom-6 left-6 z-30 hidden md:block">
        <Button asChild variant="secondary" className="rounded-full">
          <Link to="/">Back</Link>
        </Button>
      </div>

      <div className="absolute right-3 bottom-3 left-3 z-30 space-y-2 md:hidden">
        <Card className={desktopCardClassName}>
          <CardContent className="p-3">
            <details open>
              <summary className="cursor-pointer py-1 text-sm font-medium">Filter of Area</summary>
              <div className="pt-3">
                <FilterPanel
                  compact
                  selectedCategories={selectedCategories}
                  onChangeCategories={setSelectedCategories}
                  onSearchArea={handleSearchAreaClick}
                  loading={loading}
                  error={error}
                />
              </div>
            </details>
          </CardContent>
        </Card>

        <Card className={desktopCardClassName}>
          <CardContent className="p-3">
            <details>
              <summary className="cursor-pointer py-1 text-sm font-medium">AI Overview</summary>
              <div className="pt-3">
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

        <Card className={desktopCardClassName}>
          <CardContent className="space-y-3 p-3 text-sm">
            <details>
              <summary className="cursor-pointer py-1 text-sm font-medium">Current Selection</summary>
              <div className="space-y-2 pt-3">
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
                <Button asChild variant="secondary" className="w-full rounded-2xl">
                  <Link to="/">Back</Link>
                </Button>
              </div>
            </details>
          </CardContent>
        </Card>
      </div>

      {searchOpen ? (
        <button
          type="button"
          aria-label="Close search results"
          className="absolute inset-0 z-20"
          onClick={() => setSearchOpen(false)}
        />
      ) : null}

      {searchOpen ? (
        <button
          type="button"
          aria-label="Close"
          className="absolute top-[26px] right-[max(1rem,calc(50%-370px))] z-50 rounded-full bg-background/60 p-1 backdrop-blur"
          onClick={() => {
            setSearchOpen(false)
            setSearchResults([])
          }}
        >
          <X className="size-4" />
        </button>
      ) : null}
    </main>
  )
}
