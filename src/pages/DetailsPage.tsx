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
  import ReactMarkdown from "react-markdown"
  import type { Components } from "react-markdown"

  import { InquirySidebarStack } from "@/components/InquirySidebarStack"
  import { useTheme } from "@/components/theme-provider"
  import { Badge } from "@/components/ui/badge"
  import { Card, CardContent } from "@/components/ui/card"
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

  const markdownComponents: Components = {
    h1: ({ children }) => <h1 className="text-lg font-semibold tracking-tight text-foreground">{children}</h1>,
    h2: ({ children }) => <h2 className="text-base font-semibold tracking-tight text-foreground">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold tracking-tight text-foreground">{children}</h3>,
    p: ({ children }) => <p className="text-sm leading-6 text-foreground/90">{children}</p>,
    ul: ({ children }) => <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/90">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground/90">{children}</ol>,
    li: ({ children }) => <li className="leading-6">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-border pl-4 text-sm italic text-muted-foreground">{children}</blockquote>
    ),
    code: ({ children, className }) => {
      const isInline = !className
      return isInline ? (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>
      ) : (
        <code className="block rounded-lg bg-muted px-3 py-2 font-mono text-xs leading-6 text-foreground whitespace-pre-wrap">
          {children}
        </code>
      )
    },
    pre: ({ children }) => <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs text-foreground">{children}</pre>,
    a: ({ children, href }) => (
      <a href={href} className="font-medium text-primary underline underline-offset-2">
        {children}
      </a>
    ),
    hr: () => <hr className="border-border" />,
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

  type CachedVenueMixItem = {
    name: string
    value: number
  }

  type CachedAnalysisEntry = {
    population?: number | null
    competitorsPerThousand?: number | null
    seifaDecile?: number | null
    finalScore?: number | null
    venueMix?: CachedVenueMixItem[]
    venueData?: FeatureCollection<Point, PlaceProperties>
    radarData?: Array<Record<string, string | number>>
    aiBriefing?: string
    boundary_geojson?: {
      type?: "Polygon" | "MultiPolygon"
      coordinates?: unknown
    } | null
  }

  type InquiryAnalysisData = CachedAnalysisEntry & {
    active_suburb?: string
    bySuburb?: Record<string, CachedAnalysisEntry>
  }

  export type DetailsPageProps = {
    open: boolean
    onClose: () => void
    scoredResults: ResultSuburb[]
    initialActiveIndex: number
    countsBySuburb: Record<string, number>
    initialAiSummary: string
    cachedData?: InquiryAnalysisData | null
    useInquiryStyleSidebar?: boolean
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

  function normalizeName(value: string) {
    return value.trim().toLowerCase()
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

  function toFeatureFromGeometry(
    geometry: CachedAnalysisEntry["boundary_geojson"]
  ): Feature<Polygon | MultiPolygon> | null {
    if (!geometry?.type) return null
    if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return null

    return {
      type: "Feature",
      geometry: {
        type: geometry.type,
        coordinates: geometry.coordinates as Polygon["coordinates"] | MultiPolygon["coordinates"],
      } as Polygon | MultiPolygon,
      properties: {},
    }
  }

  function getCachedAnalysisForSuburb(
    analysisData: InquiryAnalysisData | null | undefined,
    suburbName: string
  ): CachedAnalysisEntry | null {
    if (!analysisData) return null

    const bySuburb = analysisData.bySuburb
    if (bySuburb && typeof bySuburb === "object") {
      const direct = bySuburb[suburbName]
      if (direct) return direct

      const normalizedTarget = normalizeName(suburbName)
      for (const [key, value] of Object.entries(bySuburb)) {
        if (normalizeName(key) === normalizedTarget) return value
      }
    }

    return analysisData
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

  function toScoreOutOf100(score: number | null | undefined): number | null {
    if (typeof score !== "number" || !isFinite(score)) return null
    const normalized = score <= 1 ? score * 100 : score
    return Math.max(0, Math.min(100, normalized))
  }

  // ── Chart helpers ─────────────────────────────────────────────────────────────

  function ratioByMax(values: number[]): number[] {
    const maxValue = Math.max(...values)
    if (!isFinite(maxValue) || maxValue <= 0) {
      return values.map(() => 0)
    }
    return values.map((value) => Math.max(0, value) / maxValue)
  }

  function buildRadarData(
    suburbs: ResultSuburb[],
    countsBySuburb: Record<string, number>,
    spendingBracket?: "$" | "$$" | "$$$"
  ): Array<Record<string, string | number>> {
    if (!suburbs.length) return []

    if (suburbs.length === 1) {
      const suburb = suburbs[0]
      const label = suburbLabel(suburb)
      const targetDecile =
        spendingBracket === "$"
          ? 2.5
          : spendingBracket === "$$"
            ? 5.5
            : spendingBracket === "$$$"
              ? 8.5
              : 5.5
      const venueCount = countsBySuburb[label] ?? suburb.competitorCount ?? 0
      const population = suburb.population ?? 0
      const seifaDecile = suburb.seifaDecile ?? targetDecile
      const competitors = suburb.competitorsPerThousand ?? 0

      const clamp = (value: number) => Math.max(0, Math.min(1, value))

      const singleSeries = [
        { label: "Low Competition", value: clamp(1 - Math.min(1, competitors / 6)) },
        {
          label: "Wealth Match",
          value: clamp(1 - Math.abs(seifaDecile - targetDecile) / 10),
        },
        { label: "Population", value: clamp(population / 250000) },
        { label: "POI Diversity", value: clamp(venueCount / 40) },
        { label: "Market Size", value: clamp((population * Math.max(seifaDecile, 1)) / 2000000) },
      ]

      return singleSeries.map(({ label, value }) => ({ metric: label, s0: +value.toFixed(3) }))
    }

    const targetDecile =
      spendingBracket === "$"
        ? 2.5
        : spendingBracket === "$$"
          ? 5.5
          : spendingBracket === "$$$"
            ? 8.5
            : 5.5
    const competitors = suburbs.map((s) => s.competitorsPerThousand ?? 0)
    const populations = suburbs.map((s) => s.population ?? 0)
    const poiCounts = suburbs.map((s) => countsBySuburb[suburbLabel(s)] ?? 0)
    const marketSizes = suburbs.map((s) => (s.population ?? 0) * (s.seifaDecile ?? 1))
    const wealthRaw = suburbs.map((s) =>
      Math.max(0, 1 - Math.abs((s.seifaDecile ?? 5) - targetDecile) / 10)
    )

    const compRatios = ratioByMax(competitors)
    const popRatios = ratioByMax(populations)
    const poiRatios = ratioByMax(poiCounts)
    const marketRatios = ratioByMax(marketSizes)
    const wealthRatios = ratioByMax(wealthRaw)

    const axes = [
      { label: "Low Competition", get: (i: number) => +(1 - compRatios[i]).toFixed(3) },
      { label: "Wealth Match", get: (i: number) => +wealthRatios[i].toFixed(3) },
      { label: "Population", get: (i: number) => +popRatios[i].toFixed(3) },
      { label: "POI Diversity", get: (i: number) => +poiRatios[i].toFixed(3) },
      { label: "Market Size", get: (i: number) => +marketRatios[i].toFixed(3) },
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
    cachedData = null,
    useInquiryStyleSidebar = false,
  }: DetailsPageProps) {
    const mapRef = React.useRef<MapRef | null>(null)
    const mapPanelRef = React.useRef<HTMLDivElement | null>(null)
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
    const [localCounts, setLocalCounts] = React.useState<Record<string, number>>(externalCounts)
    const [cachedRadarData, setCachedRadarData] = React.useState<Array<Record<string, string | number>> | null>(null)
    const [cachedVenueMix, setCachedVenueMix] = React.useState<CachedVenueMixItem[] | null>(null)

    const runIdRef = React.useRef(0)
    const needsAiRef = React.useRef(false)

    const activeSuburb = scoredResults[activeIndex] ?? scoredResults[0]
    const activeLabel = suburbLabel(activeSuburb)
    const cachedActiveAnalysis = React.useMemo(
      () => getCachedAnalysisForSuburb(cachedData, activeLabel),
      [cachedData, activeLabel]
    )
    const isDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    const mapStyle = isDark
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/light-v11"
    const cardClassName = "border-border/50 bg-background/60 shadow-2xl shadow-primary/10 backdrop-blur-md"

    const telemetry = React.useMemo(() => aggregateByCategory(venueData), [venueData])

    const donutData = React.useMemo(() => {
      if (cachedVenueMix?.length) {
        return cachedVenueMix.map(({ name, value }) => ({
          name,
          value,
          fill: CATEGORY_COLORS[name] ?? "#888780",
        }))
      }

      return Object.entries(telemetry.byCategory).map(([name, value]) => ({
        name,
        value,
        fill: CATEGORY_COLORS[name] ?? "#888780",
      }))
    }, [cachedVenueMix, telemetry.byCategory])

    const allCounts = React.useMemo(
      () => ({ ...externalCounts, ...localCounts }),
      [externalCounts, localCounts]
    )

    const radarData = React.useMemo(
      () =>
        cachedRadarData?.length
          ? cachedRadarData
          : buildRadarData(scoredResults, allCounts, draft?.spendingBracket),
      [cachedRadarData, scoredResults, allCounts, draft?.spendingBracket]
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
        setCachedRadarData(null)
        setCachedVenueMix(null)
        document.body.style.overflow = "hidden"
      } else {
        setMapLoaded(false)
        setBoundary(null)
        setVenueData({ type: "FeatureCollection", features: [] })
        setBriefingLoading(false)
        setCachedRadarData(null)
        setCachedVenueMix(null)
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

    // Fit map to boundary after the map has resized to its flex container.
    React.useEffect(() => {
      if (!boundary || !mapLoaded || !open) return
      const map = mapRef.current?.getMap()
      if (!map) return
      const { minLng, minLat, maxLng, maxLat } = boundaryToBBox(boundary)

      const timeoutId = window.setTimeout(() => {
        map.resize()
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
          padding: 60,
          pitch: 45,
          bearing: -10,
          duration: 900,
        })
      }, 100)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }, [boundary, mapLoaded, open])

    // Keep Mapbox aware of dynamic flex sizing changes.
    React.useEffect(() => {
      if (!open || !mapLoaded) return

      const panel = mapPanelRef.current
      const map = mapRef.current?.getMap()
      if (!panel || !map) return

      const resizeObserver = new ResizeObserver(() => {
        map.resize()
      })

      const timeoutId = window.setTimeout(() => {
        map.resize()

        if (boundary) {
          const { minLng, minLat, maxLng, maxLat } = boundaryToBBox(boundary)
          map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
            padding: 60,
            pitch: 45,
            bearing: -10,
            duration: 600,
          })
        }
      }, 100)

      resizeObserver.observe(panel)

      return () => {
        window.clearTimeout(timeoutId)
        resizeObserver.disconnect()
      }
    }, [open, mapLoaded, boundary])

    // Fetch boundary + venues + (conditionally) AI when suburb changes
    React.useEffect(() => {
      if (!open) return
      let cancelled = false
      const runId = ++runIdRef.current

      const load = async () => {
        const label = activeLabel
        const cached = cachedActiveAnalysis
        const cachedBoundary = toFeatureFromGeometry(cached?.boundary_geojson ?? null)
        const hasCachedBriefing = Boolean(cached?.aiBriefing)
        const hasCachedVenueMix = Array.isArray(cached?.venueMix) && cached.venueMix.length > 0

        if (cached) {
          setCachedRadarData(Array.isArray(cached.radarData) ? cached.radarData : [])
          setCachedVenueMix(Array.isArray(cached.venueMix) ? cached.venueMix : [])
          setAiSummary(cached.aiBriefing || initialAiSummary || "Cached analysis loaded.")

          if (cachedBoundary) {
            setBoundary(cachedBoundary)
          }

          if (cached.venueData) {
            setVenueData(cached.venueData)
          }

          const totalFromVenueMix = hasCachedVenueMix
            ? cached.venueMix!.reduce((sum, item) => sum + (item.value ?? 0), 0)
            : 0
          setLocalCounts((prev) => ({ ...prev, [label]: totalFromVenueMix }))
          setBriefingLoading(false)
          needsAiRef.current = true

          if (cachedBoundary && hasCachedVenueMix && hasCachedBriefing && cached.venueData) {
            return
          }
        }

        if (cachedBoundary) {
          setBoundary(cachedBoundary)
        }

        if (hasCachedVenueMix) {
          const cachedTotal = cached!.venueMix!.reduce((sum, item) => sum + (item.value ?? 0), 0)
          setLocalCounts((prev) => ({ ...prev, [label]: cachedTotal }))
        }

        if (hasCachedBriefing) {
          setAiSummary(cached!.aiBriefing!)
        }

        if (cachedBoundary && hasCachedVenueMix && hasCachedBriefing && cached?.venueData) {
          return
        }

        const foundBoundary = cachedBoundary ?? (await fetchNominatimBoundary(label))
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
    }, [open, activeIndex, cachedData, cachedActiveAnalysis, activeLabel, initialAiSummary]) // eslint-disable-line react-hooks/exhaustive-deps

    const topVenueMix = [...donutData].sort((a, b) => b.value - a.value).slice(0, 5)
    const activeScore = toScoreOutOf100(activeSuburb.finalScore)
    const aiStatus = `TARGETING: ${suburbLabel(activeSuburb)}`

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
        <div className="relative flex h-[95vh] max-h-[95vh] w-[min(96vw,1480px)] flex-col overflow-hidden rounded-2xl border border-border/40 bg-background shadow-2xl">

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
                  className="transition-all"
                >
                  <Badge
                    variant={i === activeIndex ? "default" : "secondary"}
                    className="px-3 py-1 text-xs"
                    style={i === activeIndex ? { background: SUBURB_COLORS[i], color: "#fff" } : undefined}
                  >
                    #{i + 1} {suburbLabel(suburb)}
                  </Badge>
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
          <div className="flex h-[calc(100vh-120px)] min-h-0 w-full flex-row gap-6 p-6">

            {/* ── Column 1: Stats / charts ─────────────────────────────────── */}
            <div className="w-[320px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-2">
                <div className="space-y-4">
                  <section>
                    <p className="mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                      Suburb Comparison
                    </p>
                    {radarData.length > 0 ? (
                      <Card className="h-fit shrink-0 border-border/70 bg-muted/20 shadow-none">
                        <CardContent className="p-4">
                      <ChartContainer config={radarChartConfig} className="mx-auto h-[240px] w-full">
                        <RadarChart
                          data={radarData}
                          margin={{ top: 12, right: 48, bottom: 12, left: 48 }}
                        >
                          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                          <PolarGrid />
                          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9 }} />
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
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="flex h-[240px] items-center justify-center">
                        <Skeleton className="h-36 w-36 rounded-full" />
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
                      {scoredResults.map((suburb, i) => (
                        <div key={suburbLabel(suburb)} className="flex items-center gap-1">
                          <span className="size-2 shrink-0 rounded-full" style={{ background: SUBURB_COLORS[i] }} />
                          <span className="text-[9px] text-muted-foreground">#{i + 1} {suburbLabel(suburb)}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <Card className="h-fit shrink-0 border-border/70 bg-muted/20 shadow-none">
                      <CardContent className="">
                        <div className="grid grid-cols-2 gap-0.5">
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
                                activeScore != null
                                  ? `${activeScore.toFixed(0)} / 100`
                                  : "N/A",
                            },
                          ].map(({ label, value }) => (
                            <div key={label} className="rounded-md border border-border/60 bg-background/60 px-2 py-1.5">
                              <p className="truncate text-[8px] font-semibold tracking-wide text-muted-foreground uppercase">
                                {label}
                              </p>
                              <p className="mt-0.5 text-xs font-semibold leading-none tabular-nums text-foreground">
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </section>

                  <section>
                    <p className="mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                      Venue Mix
                    </p>
                    {donutData.length > 0 ? (
                      <Card className="h-fit shrink-0 border-border/70 bg-muted/20 shadow-none">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <ChartContainer config={donutChartConfig} className="h-[170px] w-[170px] shrink-0">
                              <PieChart>
                                <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                                <Pie
                                  data={donutData}
                                  dataKey="value"
                                  nameKey="name"
                                  innerRadius={46}
                                  outerRadius={72}
                                  paddingAngle={donutData.length > 1 ? 2 : 0}
                                />
                              </PieChart>
                            </ChartContainer>

                            <div className="flex flex-1 flex-col gap-2 min-w-0">
                              {topVenueMix.map((category) => (
                                <div key={category.name} className="flex items-center justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="size-2.5 rounded-full" style={{ background: category.fill }} />
                                    <span className="truncate text-xs text-foreground">{category.name}</span>
                                  </div>
                                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                                    {category.value}
                                  </span>
                                </div>
                              ))}
                              <div className="mt-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                                Total venues: <span className="font-semibold text-foreground">{telemetry.total}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="flex h-[180px] items-center justify-center rounded-xl border border-border bg-muted/20 text-xs text-muted-foreground">
                        {boundary ? "No venues found" : "Loading..."}
                      </div>
                    )}
                  </section>
                </div>
            </div>

            {/* ── Column 2: Top-down map ───────────────────────────────────── */}
            <div ref={mapPanelRef} className="flex-1 min-w-0 relative rounded-xl overflow-hidden border border-border">
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
                  {activeScore != null && (
                    <p className="text-xs font-semibold tabular-nums" style={{ color: activeColor }}>
                      {activeScore.toFixed(0)} / 100
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

            {/* ── Column 3: AI briefing + current selection ─────────────────── */}
            <div className={useInquiryStyleSidebar ? "w-[min(430px,calc(100%-2rem))] shrink-0 min-h-0 flex flex-col gap-4 pl-2" : "w-[350px] shrink-0 min-h-0 flex flex-col gap-4 pl-2"}>
              {useInquiryStyleSidebar ? (
                <InquirySidebarStack
                  aiSummary={aiSummary}
                  briefingLoading={briefingLoading}
                  aiStatus={aiStatus}
                  areaLabel={suburbLabel(activeSuburb)}
                  venueCount={telemetry.total}
                  wealthDecile={activeSuburb.seifaDecile}
                  competitorsPerThousand={activeSuburb.competitorsPerThousand}
                  axelScore={activeScore}
                  venueByCategory={telemetry.byCategory}
                  onFreeView={onClose}
                  onDeepDive={() => {}}
                  deepDiveDisabled={true}
                  markdownComponents={markdownComponents}
                  cardClassName={cardClassName}
                />
              ) : (
                <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card overflow-hidden">
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
                        {draft.businessType} · {draft.spendingBracket}
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
                        <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-ul:my-2 prose-ol:my-2 dark:prose-invert [&_*]:break-words">
                          <ReactMarkdown>{aiSummary}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
