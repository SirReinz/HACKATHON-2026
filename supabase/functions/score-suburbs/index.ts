// @ts-ignore: Deno remote module import resolves in Supabase Edge runtime.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type BriefingRequest = {
  region?: string
  activeArea?: string
  suburb_name?: string
  pointCount?: number
  categories?: string[]
  businessType?: string
  spendingBracket?: string
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length ? normalized : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item))
}

function buildFallbackBriefing(payload: BriefingRequest): string {
  const suburb = asString(payload.suburb_name) ?? asString(payload.activeArea) ?? "Selected Area"
  const businessType = asString(payload.businessType) ?? "business"
  const spendingBracket = asString(payload.spendingBracket) ?? "$$"
  const region = asString(payload.region) ?? "the region"
  const pointCount = asNumber(payload.pointCount) ?? 0
  const categories = asStringArray(payload.categories)

  const categoryLine = categories.length
    ? `Primary categories in scope: ${categories.join(", ")}.`
    : "No category pre-filter was applied."

  const densityLine =
    pointCount > 0
      ? `Observed venue count in ${suburb}: ${pointCount}.`
      : `Venue count for ${suburb} is still loading; treat this as a directional assessment.`

  return [
    `AXEL briefing for ${suburb} (${region})`,
    `Business model: ${businessType}. Spending profile: ${spendingBracket}.`,
    densityLine,
    categoryLine,
    "Recommendation: run a pilot activation for 4-6 weeks, measure conversion by hour and daypart, then compare CAC and repeat-rate before committing to a long lease.",
  ].join("\n\n")
}

async function generateWithGemini(payload: BriefingRequest): Promise<string | null> {
  // @ts-ignore: Deno global is available in Supabase Edge runtime.
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY")
  if (!geminiApiKey) {
    return null
  }

  const suburb = asString(payload.suburb_name) ?? asString(payload.activeArea) ?? "Selected Area"
  const businessType = asString(payload.businessType) ?? "business"
  const spendingBracket = asString(payload.spendingBracket) ?? "$$"
  const region = asString(payload.region) ?? "the region"
  const pointCount = asNumber(payload.pointCount) ?? 0
  const categories = asStringArray(payload.categories)

  const prompt = [
    "You are a commercial location intelligence analyst.",
    "Provide a concise, practical market-entry assessment in plain English.",
    `Suburb: ${suburb}`,
    `Region: ${region}`,
    `Business type: ${businessType}`,
    `Spending bracket: ${spendingBracket}`,
    `Observed venue count: ${pointCount}`,
    `Categories filter: ${categories.length ? categories.join(", ") : "none"}`,
    "Output sections: Opportunity, Risks, Positioning, Action Plan (3 bullets).",
  ].join("\n")

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={geminiApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 500,
        },
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini request failed (${response.status}): ${errorText}`)
  }

  const payloadJson = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string
        }>
      }
    }>
  }

  const text = payloadJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  return text && text.length ? text : null
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const requestBody = (await req.json()) as BriefingRequest
    const generated = (await generateWithGemini(requestBody)) ?? buildFallbackBriefing(requestBody)

    return new Response(
      JSON.stringify({
        briefing: generated,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"

    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})