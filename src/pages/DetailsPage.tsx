  import * as React from "react"
  import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from "geojson"
  import type { LayerProps, MapRef } from "react-map-gl/mapbox"
  import Map, { Source, Layer } from "react-map-gl/mapbox"
  import {
    Pie,
    PieChart,
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
  } from "recharts"
  import { X } from "lucide-react"

  import { useTheme } from "@/components/theme-provider"
  import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
  } from "@/components/ui/chart"
  import { ScrollArea } from "@/components/ui/scroll-area"
  import { Skeleton } from "@/components/ui/skeleton"
  import { useInquiryFlow } from "@/context/InquiryFlowContext"
  import { fetchPlacesInPolygonPaginated, type PlaceRow } from "@/lib/fetchPlacesPaginated"
  import { supabase } from "@/lib/supabase"

  // ── Constants ─────────────────────────────────────────────────────────────────

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN

  const SUBURB_COLORS = ["#1D9E75", "#378ADD", "#D85A30"] as const

  const CATEGORY_COLORS: Record<string, string> = {
    "Dining and Drinking": "#D85A30",
    "Retail": "#378ADD",
    "Health and Medicine": "#1D9E75",
    "Business and Professional Services": "#7F77DD",
    "Business and Professional Service": "#7F77DD",
    "Travel and Transportation": "#BA7517",
    "Arts and Entertainment": "#D4537E",
    "Landmarks and Outdoors": "#639922",
    "Sports and Recreation": "#888780",
    "Community and Government": "#534AB7",
    "Event": "#B4B2A9",
  }

  // ── Types ─────────────────────────────────────────────────────────────────────

  export type ResultSuburb = {
    name: string
    displayName?: string
    fallbackCenter: [number, number]
    finalScore?: number
    competitorsPerThousand?: number
    seifaDecile?: number
    population?: number
    competitorCount?: number
  }

  type PlaceProperties = {
    id: string
    name: string
    level1_category_name: string
  }

  type NominatimResult = {
    geojson?: { type?: string; coordinates?: unknown }
  }

  export type DetailsPageProps = {
    open: boolean
    onClose: () => void
    scoredResults: ResultSuburb[]
    initialActiveIndex: number
    countsBySuburb: Record<string, number>
    initialAiSummary: string
  }

  // ── Map layer configs ─────────────────────────────────────────────────────────

  const clusterLayer: LayerProps = {
    id: "dd-clusters",
    type: "circle",
    source: "dd-places",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#18d0ff",
      "circle-radius": ["step", ["get", "point_count"], 16, 25, 24, 60, 32],
      "circle-opacity": 0.9,
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#f8fafc",
    },
  }

  const clusterCountLayer: LayerProps = {
    id: "dd-cluster-count",
    type: "symbol",
    source: "dd-places",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
      "text-size": 11,
    },
    paint: { "text-color": "#0f172a" },
  }

  const unclusteredLayer: LayerProps = {
    id: "dd-places-circle",
    type: "circle",
    source: "dd-places",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": "#18d0ff",
      "circle-radius": 4,
      "circle-opacity": 0.8,
      "circle-stroke-width": 1,
      "circle-stroke-color": "#ffffff",
    },
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function suburbLabel(s: ResultSuburb) {
    return s.displayName ?? s.name
  }

  async function fetchNominatimBoundary(
    query: string
  ): Promise<Feature<Polygon | MultiPolygon> | null> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query + ", NSW, Australia"
    )}&format=json&polygon_geojson=1&addressdetails=1&limit=5&email=your_email@example.com`
    const res = await fetch(url)
    const results = (await res.json()) as NominatimResult[]
    const match = results.find(
      (r) => r.geojson?.type === "Polygon" || r.geojson?.type === "MultiPolygon"
    )
    if (!match?.geojson?.type || !match.geojson.coordinates) return null
    if (match.geojson.type !== "Polygon" && match.geojson.type !== "MultiPolygon") return null
    return {
      type: "Feature",
      geometry: {
        type: match.geojson.type,
        coordinates: match.geojson.coordinates as
          | Polygon["coordinates"]
          | MultiPolygon["coordinates"],
      } as Polygon | MultiPolygon,
      properties: {},
    }
  }

  function boundaryToBBox(b: Feature<Polygon | MultiPolygon>) {
    let minLng = Infinity,
      minLat = Infinity,
      maxLng = -Infinity,
      maxLat = -Infinity
    const visit = (lng: number, lat: number) => {
      minLng = Math.min(minLng, lng)
      minLat = Math.min(minLat, lat)
      maxLng = Math.max(maxLng, lng)
      maxLat = Math.max(maxLat, lat)
    }
    if (b.geometry.type === "Polygon") {
      b.geometry.coordinates.forEach((ring) => ring.forEach(([lng, lat]) => visit(lng, lat)))
    } else {
      b.geometry.coordinates.forEach((poly) =>
        poly.forEach((ring) => ring.forEach(([lng, lat]) => visit(lng, lat)))
      )
    }
    return { minLng, minLat, maxLng, maxLat }
  }

  function toNumber(v: unknown): number | null {
    if (typeof v === "number" && isFinite(v)) return v
    if (typeof v === "string") {
      const n = Number(v)
      if (isFinite(n)) return n
    }
    return null
  }

  function toFeatureCollection(rows: PlaceRow[]): FeatureCollection<Point, PlaceProperties> {
    const features: Feature<Point, PlaceProperties>[] = []
    rows.forEach((row, i) => {
      const lng = toNumber(row.longitude ?? row.lng)
      const lat = toNumber(row.latitude ?? row.lat)
      let coords: [number, number] | null =
        lng !== null && lat !== null ? [lng, lat] : null
      if (!coords) {
        const g = row.geom
        if (g && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
          const gl = toNumber(g.coordinates[0])
          const gla = toNumber(g.coordinates[1])
          if (gl !== null && gla !== null) coords = [gl, gla]
        }
      }
      if (!coords) return
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: coords },
        properties: {
          id: String(row.id ?? i),
          name: row.name ?? row.venue_name ?? "Unknown",
          level1_category_name: row.level1_category_name ?? "Uncategorized",
        },
      })
    })
    return { type: "FeatureCollection", features }
  }

  function aggregateByCategory(fc: FeatureCollection<Point, PlaceProperties>) {
    return fc.features.reduce(
      (acc, f) => {
        const cat = f.properties.level1_category_name
        acc.total += 1
        acc.byCategory[cat] = (acc.byCategory[cat] ?? 0) + 1
        return acc
      },
      { total: 0, byCategory: {} as Record<string, number> }
    )
  }

  // ── Chart helpers ─────────────────────────────────────────────────────────────

  function percentileRanks(values: number[]): number[] {
    const n = values.length
    if (n <= 1) return values.map(() => 0.5)
    const sorted = [...values].sort((a, b) => a - b)
    return values.map((v) => sorted.indexOf(v) / (n - 1))
  }

  function buildRadarData(
    suburbs: ResultSuburb[],
    countsBySuburb: Record<string, number>,
    spendingBracket: "$" | "$$" | "$$$"
  ): Array<Record<string, string | number>> {
    if (!suburbs.length) return []
    const targetDecile = spendingBracket === "$" ? 2.5 : spendingBracket === "$$" ? 5.5 : 8.5
    const compRanks = percentileRanks(suburbs.map((s) => s.competitorsPerThousand ?? 0))
    const popRanks = percentileRanks(suburbs.map((s) => s.population ?? 0))
    const poiRanks = percentileRanks(suburbs.map((s) => countsBySuburb[suburbLabel(s)] ?? 0))
    const marketRanks = percentileRanks(
      suburbs.map((s) => (s.population ?? 0) * (s.seifaDecile ?? 1))
    )
    const wealthScores = suburbs.map((s) =>
      Math.max(0, 1 - Math.abs((s.seifaDecile ?? 5) - targetDecile) / 10)
    )
    const axes = [
      { label: "Low Competition", get: (i: number) => +(1 - compRanks[i]).toFixed(3) },
      { label: "Wealth Match", get: (i: number) => +wealthScores[i].toFixed(3) },
      { label: "Population", get: (i: number) => +popRanks[i].toFixed(3) },
      { label: "POI Diversity", get: (i: number) => +poiRanks[i].toFixed(3) },
      { label: "Market Size", get: (i: number) => +marketRanks[i].toFixed(3) },
    ]
    return axes.map(({ label, get }) => {
      const entry: Record<string, string | number> = { metric: label }
      suburbs.forEach((_, i) => {
        entry[`s${i}`] = get(i)
      })
      return entry
    })
  }

  // ── Component ─────────────────────────────────────────────────────────────────

  export function DetailsPage({
    open,
    onClose,
    scoredResults,
    initialActiveIndex,
    countsBySuburb: externalCounts,
    initialAiSummary,
  }: DetailsPageProps) {
    const mapRef = React.useRef<MapRef | null>(null)
    const { draft } = useInquiryFlow()
    const { theme } = useTheme()

    const [activeIndex, setActiveIndex] = React.useState(initialActiveIndex)
    const [mapLoaded, setMapLoaded] = React.useState(false)
    const [boundary, setBoundary] = React.useState<Feature<Polygon | MultiPolygon> | null>(null)
    const [venueData, setVenueData] = React.useState<FeatureCollection<Point, PlaceProperties>>({
      type: "FeatureCollection",
      features: [],
    })
    const [aiSummary, setAiSummary] = React.useState(initialAiSummary)
    const [briefingLoading, setBriefingLoading] = React.useState(false)
    const [hoveredDonut, setHoveredDonut] = React.useState<{
      name: string
      value: number
    } | null>(null)
    const [localCounts, setLocalCounts] = React.useState<Record<string, number>>(externalCounts)

    const runIdRef = React.useRef(0)
    const needsAiRef = React.useRef(false)

    const activeSuburb = scoredResults[activeIndex] ?? scoredResults[0]
    const isDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    const mapStyle = isDark
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/light-v11"

    const telemetry = React.useMemo(() => aggregateByCategory(venueData), [venueData])

    const donutData = React.useMemo(
      () =>
        Object.entries(telemetry.byCategory).map(([name, value]) => ({
          name,
          value,
          fill: CATEGORY_COLORS[name] ?? "#888780",
        })),
      [telemetry.byCategory]
    )

    const allCounts = React.useMemo(
      () => ({ ...externalCounts, ...localCounts }),
      [externalCounts, localCounts]
    )

    const radarData = React.useMemo(
      () =>
        draft ? buildRadarData(scoredResults, allCounts, draft.spendingBracket) : [],
      [scoredResults, allCounts, draft]
    )

    const boundaryGeoJSON = React.useMemo(
      () => ({
        type: "FeatureCollection" as const,
        features: boundary ? [boundary] : [],
      }),
      [boundary]
    )

    // Sync when props change (user switches suburb in parent before opening)
    React.useEffect(() => {
      setActiveIndex(initialActiveIndex)
    }, [initialActiveIndex])

    // Open / close lifecycle
    React.useEffect(() => {
      if (open) {
        setAiSummary(initialAiSummary || "Analyzing suburb…")
        needsAiRef.current = false
        document.body.style.overflow = "hidden"
      } else {
        setMapLoaded(false)
        setBoundary(null)
        setVenueData({ type: "FeatureCollection", features: [] })
        setBriefingLoading(false)
        document.body.style.overflow = ""
      }
      return () => {
        document.body.style.overflow = ""
      }
    }, [open, initialAiSummary])

    // Escape key
    React.useEffect(() => {
      if (!open) return
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose()
      }
      document.addEventListener("keydown", handler)
      return () => document.removeEventListener("keydown", handler)
    }, [open, onClose])

    // Reset donut hover on suburb change
    React.useEffect(() => {
      setHoveredDonut(null)
    }, [activeIndex])

    // Fit map to boundary when both are ready
    React.useEffect(() => {
      if (!boundary || !mapLoaded) return
      const map = mapRef.current?.getMap()
      if (!map) return
      const { minLng, minLat, maxLng, maxLat } = boundaryToBBox(boundary)
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
        padding: 60,
        pitch: 45,
        bearing: -10,
        duration: 900,
      })
    }, [boundary, mapLoaded])

    // Fetch boundary + venues + (conditionally) AI when suburb changes
    React.useEffect(() => {
      if (!open) return
      let cancelled = false
      const runId = ++runIdRef.current

      const load = async () => {
        const label = suburbLabel(activeSuburb)

        const foundBoundary = await fetchNominatimBoundary(label)
        if (cancelled || runIdRef.current !== runId) return
        setBoundary(foundBoundary)

        if (!foundBoundary) return

        const { rows, error } = await fetchPlacesInPolygonPaginated(
          foundBoundary.geometry,
          null,
          { pageSize: 1000, maxPages: 10 }
        )
        if (cancelled || runIdRef.current !== runId) return

        const fc =
          !error && rows.length > 0
            ? toFeatureCollection(rows)
            : ({ type: "FeatureCollection", features: [] } as FeatureCollection<
                Point,
                PlaceProperties
              >)
        setVenueData(fc)
        setLocalCounts((prev) => ({ ...prev, [label]: fc.features.length }))

        // First open uses the passed initialAiSummary — skip AI call
        if (!needsAiRef.current) {
          needsAiRef.current = true
          return
        }

        // Subsequent suburb switches → fresh AI briefing
        if (!draft) return
        setBriefingLoading(true)
        setAiSummary("")

        const summary = aggregateByCategory(fc)
        const venueSample = rows.slice(0, 50).map((r) => ({
          id: String(r.id ?? ""),
          name: r.name ?? r.venue_name ?? "Unknown",
          category: r.level1_category_name ?? "Uncategorized",
        }))

        const { data: response, error: aiError } = await supabase.functions.invoke(
          "smart-responder",
          {
            body: {
              businessType: draft.businessType,
              targetAudience: draft.targetAudience,
              spendingBracket: draft.spendingBracket,
              suburbName: label,
              venueSummary: summary,
              venueSample,
              scoringContext: {
                finalScore: activeSuburb.finalScore,
                competitorsPerThousand: activeSuburb.competitorsPerThousand,
                seifaDecile: activeSuburb.seifaDecile,
                population: activeSuburb.population,
              },
            },
          }
        )
        if (cancelled || runIdRef.current !== runId) return

        if (!aiError) {
          const text =
            typeof response === "string"
              ? response
              : response?.briefing ?? response?.summary ?? JSON.stringify(response)
          setAiSummary(text)
        } else {
          setAiSummary("Unable to generate briefing for this suburb.")
        }
        setBriefingLoading(false)
      }

      void load()
      return () => {
        cancelled = true
      }
    }, [open, activeIndex]) // eslint-disable-line react-hooks/exhaustive-deps

    if (!open) return null

    const activeColor = SUBURB_COLORS[activeIndex] ?? SUBURB_COLORS[0]

    const radarChartConfig: ChartConfig = Object.fromEntries(
      scoredResults.map((suburb, i) => [
        `s${i}`,
        { label: `#${i + 1} ${suburbLabel(suburb)}`, color: SUBURB_COLORS[i] },
      ])
    )

    const donutChartConfig: ChartConfig = Object.fromEntries(
      donutData.map(({ name }) => [
        name,
        { label: name, color: CATEGORY_COLORS[name] ?? "#888780" },
      ])
    )

    return (
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div className="relative flex h-[88vh] w-[min(96vw,1480px)] flex-col overflow-hidden rounded-2xl border border-border/40 bg-background shadow-2xl">

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <header
            className="flex shrink-0 items-center gap-3 border-b border-border/50 px-5 py-3"
            style={{ borderTopColor: activeColor, borderTopWidth: 3 }}
          >
            <div className="flex flex-1 items-center gap-3">
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: activeColor }}
              >
                #{activeIndex + 1}
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Intelligence Deep Dive
                </p>
                <h2 className="text-base font-semibold leading-tight">{suburbLabel(activeSuburb)}</h2>
              </div>
            </div>

            {/* Suburb tabs */}
            <div className="flex items-center gap-1.5">
              {scoredResults.map((suburb, i) => (
                <button
                  key={suburbLabel(suburb)}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-all"
                  style={
                    i === activeIndex
                      ? { background: SUBURB_COLORS[i], color: "#fff" }
                      : { background: "transparent", color: "var(--muted-foreground)" }
                  }
                >
                  #{i + 1} {suburbLabel(suburb)}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="ml-2 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </header>

          {/* ── 3-column body ────────────────────────────────────────────────── */}
          <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr_300px]">

            {/* ── Column 1: Charts ─────────────────────────────────────────── */}
            <ScrollArea className="min-h-0 border-r border-border/50">
              <div className="space-y-5 py-4 pl-4 pr-8">

                {/* Radar */}
                <section>
                  <p className="mb-2 text-[9px] font-bold tracking-widest text-muted-foreground uppercase">
                    Suburb Comparison
                  </p>
                  {radarData.length > 0 ? (
                    <ChartContainer config={radarChartConfig} className="mx-auto h-[240px] w-full">
                      <RadarChart
                        data={radarData}
                        margin={{ top: 12, right: 48, bottom: 12, left: 48 }}
                      >
                        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                        <PolarGrid />
                        <PolarAngleAxis
                          dataKey="metric"
                          tick={{ fontSize: 9 }}
                        />
                        <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
                        {scoredResults.map((suburb, i) => (
                          <Radar
                            key={suburbLabel(suburb)}
                            dataKey={`s${i}`}
                            stroke={`var(--color-s${i})`}
                            fill={`var(--color-s${i})`}
                            fillOpacity={activeIndex === i ? 0.25 : 0.07}
                            strokeWidth={activeIndex === i ? 2.5 : 1.5}
                            dot={activeIndex === i ? { r: 3, fillOpacity: 1 } : false}
                          />
                        ))}
                      </RadarChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex h-[240px] items-center justify-center">
                      <Skeleton className="h-36 w-36 rounded-full" />
                    </div>
                  )}
                  {/* Legend */}
                  <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
                    {scoredResults.map((suburb, i) => (
                      <div key={suburbLabel(suburb)} className="flex items-center gap-1">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: SUBURB_COLORS[i] }}
                        />
                        <span className="text-[9px] text-muted-foreground">
                          #{i + 1} {suburbLabel(suburb)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Stats */}
                <section className="grid grid-cols-2 gap-2">
                  {[
                    {
                      label: "Population",
                      value:
                        activeSuburb.population != null
                          ? activeSuburb.population.toLocaleString()
                          : "N/A",
                    },
                    {
                      label: "Wealth Decile",
                      value:
                        activeSuburb.seifaDecile != null
                          ? `${activeSuburb.seifaDecile} / 10`
                          : "N/A",
                    },
                    {
                      label: "Competitors / 1k",
                      value:
                        activeSuburb.competitorsPerThousand != null
                          ? String(activeSuburb.competitorsPerThousand)
                          : "N/A",
                    },
                    {
                      label: "Axel Score",
                      value:
                        activeSuburb.finalScore != null
                          ? `${(activeSuburb.finalScore * 100).toFixed(0)} / 100`
                          : "N/A",
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2"
                    >
                      <p className="truncate text-[8px] font-bold tracking-widest text-muted-foreground uppercase">
                        {label}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
                    </div>
                  ))}
                </section>

                {/* Donut */}
                <section>
                  <p className="mb-2 text-[9px] font-bold tracking-widest text-muted-foreground uppercase">
                    Venue Mix
                  </p>
                  {donutData.length > 0 ? (
                    <div className="relative">
                      <ChartContainer config={donutChartConfig} className="mx-auto h-[220px] w-full">
                        <PieChart>
                          <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                          <Pie
                            data={donutData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={58}
                            outerRadius={86}
                            paddingAngle={donutData.length > 1 ? 2 : 0}
                            onMouseEnter={(entry) =>
                              setHoveredDonut({
                                name: entry.name as string,
                                value: entry.value as number,
                              })
                            }
                            onMouseLeave={() => setHoveredDonut(null)}
                          />
                        </PieChart>
                      </ChartContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                        {hoveredDonut ? (
                          <>
                            <span className="text-xl font-bold leading-none tabular-nums">
                              {hoveredDonut.value}
                            </span>
                            <span className="mt-0.5 max-w-[80px] text-[9px] leading-tight text-muted-foreground">
                              {hoveredDonut.name}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-xl font-bold leading-none tabular-nums">
                              {telemetry.total}
                            </span>
                            <span className="text-[10px] text-muted-foreground">venues</span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
                      {boundary ? "No venues found" : "Loading…"}
                    </div>
                  )}
                </section>
              </div>
            </ScrollArea>

            {/* ── Column 2: Top-down map ───────────────────────────────────── */}
            <div className="relative min-h-0 overflow-hidden border-r border-border/50">
              {mapboxToken ? (
                <Map
                  ref={mapRef}
                  onLoad={() => setMapLoaded(true)}
                  mapboxAccessToken={mapboxToken}
                  initialViewState={{
                    longitude: activeSuburb.fallbackCenter[0],
                    latitude: activeSuburb.fallbackCenter[1],
                    zoom: 13,
                    pitch: 0,
                    bearing: 0,
                  }}
                  mapStyle={mapStyle}
                  style={{ width: "100%", height: "100%" }}
                  dragRotate={false}
                  pitchWithRotate={false}
                >
                  {/* Boundary */}
                  <Source id="dd-boundary" type="geojson" data={boundaryGeoJSON}>
                    <Layer
                      id="dd-boundary-fill"
                      type="fill"
                      paint={{
                        "fill-color": activeColor,
                        "fill-opacity": 0.12,
                      }}
                    />
                    <Layer
                      id="dd-boundary-line"
                      type="line"
                      paint={{
                        "line-color": activeColor,
                        "line-width": 2.5,
                        "line-opacity": 0.9,
                      }}
                    />
                  </Source>

                  {/* Venues */}
                  <Source
                    id="dd-places"
                    type="geojson"
                    data={venueData}
                    cluster
                    clusterMaxZoom={14}
                    clusterRadius={40}
                  >
                    <Layer {...clusterLayer} />
                    <Layer {...clusterCountLayer} />
                    <Layer {...unclusteredLayer} />
                  </Source>
                </Map>
              ) : (
                <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
                  Map unavailable
                </div>
              )}

              {/* Map overlays */}
              <div className="pointer-events-none absolute bottom-3 inset-x-3 flex justify-between items-end gap-2">
                <div className="rounded-lg border border-white/20 bg-background/80 px-2.5 py-1.5 backdrop-blur-md">
                  <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">
                    {suburbLabel(activeSuburb)}
                  </p>
                  {activeSuburb.finalScore != null && (
                    <p className="text-xs font-semibold tabular-nums" style={{ color: activeColor }}>
                      {(activeSuburb.finalScore * 100).toFixed(0)} / 100
                    </p>
                  )}
                </div>
                {!boundary && (
                  <div className="rounded-lg border border-white/20 bg-background/80 px-2.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur-md">
                    Loading…
                  </div>
                )}
              </div>
            </div>

            {/* ── Column 3: AI briefing ─────────────────────────────────────── */}
            <div className="flex min-h-0 flex-col">
              <div className="shrink-0 border-b border-border/50 px-5 py-3">
                <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">
                  AI Analysis
                </p>
                <p className="text-sm font-semibold">{suburbLabel(activeSuburb)}</p>
              </div>

              {draft && (
                <div className="shrink-0 border-b border-border/50 bg-muted/30 px-5 py-2.5">
                  <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">
                    Inquiry
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {draft.businessType} · {draft.spendingBracket} · {draft.targetAudience}
                  </p>
                </div>
              )}

              <ScrollArea className="min-h-0 flex-1">
                <div className="px-5 py-4">
                  {briefingLoading ? (
                    <div className="space-y-2.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3.5 w-11/12" />
                      <Skeleton className="h-3.5 w-4/5" />
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3.5 w-11/12" />
                      <Skeleton className="h-3.5 w-4/5" />
                      <Skeleton className="h-3.5 w-full" />
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {aiSummary}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    )
  }
