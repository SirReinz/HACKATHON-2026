// @ts-nocheck
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type RequestBody = {
  businessType?: string
  spendingBracket?: string
}

type AxelRow = {
  display_name?: string | null
  sa2_name?: string | null
  population_2025?: number | null
  seifa_decile?: number | null
  pois_per_1000_people?: number | null
  seifa_score?: number | null
  centroid_lng?: number | null
  centroid_lat?: number | null
}

type ResultSuburb = {
  name: string
  displayName?: string
  fallbackCenter: [number, number]
  finalScore: number
  competitorsPerThousand: number
  seifaDecile: number
  population: number
  competitorCount: number
}

function targetDecile(bracket: string): number {
  if (bracket === "$") return 2.5
  if (bracket === "$$$") return 8.5
  return 5.5
}

function computeScore(row: AxelRow, decileTarget: number): number {
  const decile = Number(row.seifa_decile ?? 5)
  const pop = Number(row.population_2025 ?? 0)
  const pois = Number(row.pois_per_1000_people ?? 0)

  const wealthMatch = Math.max(0, 1 - Math.abs(decile - decileTarget) / 10)
  const popScore = Math.min(1, pop / 250000)
  const marketSize = Math.min(1, (pop * Math.max(decile, 1)) / 2_000_000)
  const lowCompetition = Math.max(0, 1 - Math.min(1, pois / 20))

  return wealthMatch * 0.35 + popScore * 0.25 + marketSize * 0.2 + lowCompetition * 0.2
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as RequestBody
    const bracket = body.spendingBracket ?? "$$"
    const decileTarget = targetDecile(bracket)

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // Try to fetch with centroid columns first; fall back to basic columns if they don't exist
    let rows: AxelRow[] = []
    const { data: withCentroids, error: e1 } = await supabase
      .from("axel_master")
      .select("display_name, sa2_name, population_2025, seifa_decile, pois_per_1000_people, seifa_score, centroid_lng, centroid_lat")
      .not("seifa_decile", "is", null)
      .not("population_2025", "is", null)
      .gt("population_2025", 0)

    if (!e1 && withCentroids?.length) {
      rows = withCentroids as AxelRow[]
    } else {
      const { data: basic, error: e2 } = await supabase
        .from("axel_master")
        .select("display_name, sa2_name, population_2025, seifa_decile, pois_per_1000_people, seifa_score")
        .not("seifa_decile", "is", null)
        .not("population_2025", "is", null)
        .gt("population_2025", 0)

      if (e2 || !basic?.length) {
        console.error("axel_master query failed:", e2)
        return new Response(JSON.stringify({ error: "Failed to query suburb data" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      rows = basic as AxelRow[]
    }

    const results: ResultSuburb[] = rows
      .map((row) => {
        const name = String(row.sa2_name ?? row.display_name ?? "Unknown")
        const displayName = row.display_name ? String(row.display_name) : undefined
        const lng = Number(row.centroid_lng ?? 151.2093)
        const lat = Number(row.centroid_lat ?? -33.8688)
        const pois = Number(row.pois_per_1000_people ?? 0)
        const pop = Number(row.population_2025 ?? 0)
        const decile = Number(row.seifa_decile ?? 5)
        const score = computeScore(row, decileTarget)

        return {
          name,
          displayName,
          fallbackCenter: [lng, lat] as [number, number],
          finalScore: Math.round(score * 100),
          competitorsPerThousand: Math.round(pois * 10) / 10,
          seifaDecile: decile,
          population: pop,
          competitorCount: Math.round((pois * pop) / 1000),
        }
      })
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 3)

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    console.error("score-suburbs error:", message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
