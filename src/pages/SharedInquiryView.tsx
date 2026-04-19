import * as React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { MarketRadarChart } from "@/components/charts/MarketRadarChart"
import { VenueMixChart } from "@/components/charts/VenueMixChart"
import { PreviewMap, type HoveredInquiry } from "@/components/PreviewMap"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

type SharedInquiry = {
  id: string
  business_type: string
  spending_bracket: string
  created_at: string
  public: boolean
  analysis_data?: {
    population?: number | null
    competitorsPerThousand?: number | null
    seifaDecile?: number | null
    finalScore?: number | null
    aiBriefing?: string
    radarData?: Array<Record<string, string | number>>
    venueMix?: Array<{ name: string; value: number; fill?: string }>
    boundary_geojson?: {
      type?: "Polygon" | "MultiPolygon"
      coordinates?: unknown
    } | null
    bySuburb?: Record<
      string,
      {
        boundary_geojson?: {
          type?: "Polygon" | "MultiPolygon"
          coordinates?: unknown
        } | null
      }
    >
  } | null
  results_data: {
    suburbs?: string[]
    active_suburb?: string
    fallback_center?: [number, number]
    boundary_geojson?: {
      type?: "Polygon" | "MultiPolygon"
      coordinates?: unknown
    }
  } | null
}

type ViewState = "loading" | "not-found" | "access-denied" | "success"

export function SharedInquiryView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [state, setState] = React.useState<ViewState>("loading")
  const [inquiry, setInquiry] = React.useState<SharedInquiry | null>(null)

  React.useEffect(() => {
    let cancelled = false

    const loadSharedInquiry = async () => {
      if (!id) {
        setState("not-found")
        return
      }

      const { data, error } = await supabase
        .from("inquiries")
        .select("id, business_type, spending_bracket, created_at, public, analysis_data, results_data")
        .eq("id", id)
        .single()

      if (cancelled) return

      if (error || !data) {
        setState("not-found")
        return
      }

      const inquiry = data as SharedInquiry

      if (!inquiry.public) {
        setState("access-denied")
        return
      }

      setInquiry(inquiry)
      setState("success")
    }

    void loadSharedInquiry()

    return () => {
      cancelled = true
    }
  }, [id])

  const toHoveredInquiry = React.useCallback((): HoveredInquiry | null => {
    if (!inquiry) return null

    const activeSuburb =
      inquiry.results_data?.active_suburb ?? inquiry.results_data?.suburbs?.[0] ?? "Unknown suburb"
    const normalizedActive = activeSuburb.trim().toLowerCase()
    const bySuburbBoundary = inquiry.analysis_data?.bySuburb
      ? Object.entries(inquiry.analysis_data.bySuburb).find(
          ([name]) => name.trim().toLowerCase() === normalizedActive
        )?.[1]?.boundary_geojson
      : null

    const boundaryRaw =
      bySuburbBoundary ?? inquiry.analysis_data?.boundary_geojson ?? inquiry.results_data?.boundary_geojson

    const boundaryGeojson =
      boundaryRaw?.type && (boundaryRaw.type === "Polygon" || boundaryRaw.type === "MultiPolygon")
        ? {
            type: boundaryRaw.type,
            coordinates: boundaryRaw.coordinates as any,
          }
        : null

    const fallbackCenter = Array.isArray(inquiry.results_data?.fallback_center)
      ? inquiry.results_data?.fallback_center
      : undefined

    return {
      id: inquiry.id,
      title: inquiry.business_type,
      activeSuburb,
      boundaryGeojson,
      fallbackCenter,
    }
  }, [inquiry])

  const hoveredInquiry = toHoveredInquiry()
  const hoveredAnalysis = inquiry?.analysis_data ?? null
  const hoveredRadarData =
    hoveredAnalysis && Array.isArray(hoveredAnalysis.radarData) ? hoveredAnalysis.radarData : []
  const hoveredVenueMix =
    hoveredAnalysis && Array.isArray(hoveredAnalysis.venueMix) ? hoveredAnalysis.venueMix : []

  if (state === "loading") {
    return (
      <main className="min-h-svh bg-background text-foreground flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center text-muted-foreground">Loading inquiry...</CardContent>
        </Card>
      </main>
    )
  }

  if (state === "not-found") {
    return (
      <main className="min-h-svh bg-background text-foreground flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-center text-2xl">404</CardTitle>
          </CardHeader>
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-muted-foreground">This inquiry could not be found.</p>
            <Button onClick={() => navigate("/")} variant="default">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (state === "access-denied") {
    return (
      <main className="min-h-svh bg-background text-foreground flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-muted-foreground">This inquiry is private and cannot be accessed.</p>
            <Button onClick={() => navigate("/")} variant="default">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="fixed top-0 right-0 left-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-400 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-0.5">
              <span className="block text-2xl leading-none font-semibold tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
                AXEL
              </span>
              <p className="text-[11px] leading-none tracking-[0.2em] text-muted-foreground uppercase">
                Shared Inquiry
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto flex max-w-400 gap-6 px-4 pt-20 pb-4 lg:px-6">
        <div className="min-h-0 h-[calc(100svh-5.5rem)] min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-card shadow-[0_10px_30px_rgba(15,23,42,0.12)] dark:shadow-[0_10px_45px_rgba(2,6,23,0.45)]">
          <div className="flex h-full min-w-0 flex-col">
            <div className="border-b border-border bg-background/95 px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{inquiry?.business_type}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {inquiry ? new Date(inquiry.created_at).toLocaleString() : ""} • Spend: {inquiry?.spending_bracket}
                </p>
              </div>
            </div>

            <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
              <PreviewMap hoveredInquiry={hoveredInquiry} />
              {hoveredInquiry ? (
                hoveredAnalysis && (hoveredRadarData.length > 0 || hoveredVenueMix.length > 0) ? (
                  <div className="absolute top-3 right-3 bottom-3 z-20 w-[min(25%,320px)] min-w-60">
                    <div className="flex h-full min-h-0 flex-col gap-2">
                      {hoveredRadarData.length > 0 ? (
                        <div className="h-40 min-h-0 overflow-hidden rounded-xl bg-slate-950/35 backdrop-blur-sm">
                          <MarketRadarChart data={hoveredRadarData} className="h-full w-full" />
                        </div>
                      ) : null}

                      {hoveredVenueMix.length > 0 ? (
                        <div className="min-h-0 overflow-hidden rounded-xl bg-slate-950/35 backdrop-blur-sm">
                          <div className="flex h-full min-h-0 flex-col gap-2 p-2">
                            <div className="flex min-h-0 justify-center">
                              <VenueMixChart data={hoveredVenueMix} className="h-36 w-full max-w-44" />
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null
              ) : null}
            </div>
          </div>
        </div>

        <div className="shrink-0 w-96 space-y-4 h-[calc(100svh-5.5rem)] overflow-y-auto">
          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">AI Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground leading-relaxed">
                {hoveredAnalysis?.aiBriefing || "No AI briefing available."}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Current Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Population</span>
                  <span className="font-semibold text-foreground">
                    {hoveredAnalysis?.population?.toLocaleString() || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Competitors / 1k</span>
                  <span className="font-semibold text-foreground">
                    {hoveredAnalysis?.competitorsPerThousand?.toFixed(1) || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Wealth Decile</span>
                  <span className="font-semibold text-foreground">{hoveredAnalysis?.seifaDecile || "—"}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">AXEL Score</span>
                  <span className="text-lg font-bold text-cyan-500">
                    {Math.round(hoveredAnalysis?.finalScore ?? 0)}
                  </span>
                </div>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-cyan-500 to-cyan-400 transition-all"
                    style={{ width: `${Math.min((hoveredAnalysis?.finalScore ?? 0), 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
