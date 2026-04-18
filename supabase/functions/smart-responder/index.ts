// @ts-nocheck
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RequestBody = {
  region?: string
  pointCount?: number
  categories?: string[]
  activeArea?: string
  businessType?: string
  targetAudience?: string
  spendingBracket?: string
  suburbName?: string
  venueSummary?: {
    total?: number
    byCategory?: Record<string, number>
  }
  venueSample?: Array<{
    id?: string
    name?: string
    category?: string
  }>
  scoringContext?: {
    finalScore?: number
    competitorsPerThousand?: number
    seifaDecile?: number
    population?: number
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('smart-responder: incoming request')

  try {
    let body: RequestBody

    try {
      body = (await req.json()) as RequestBody
    } catch (error) {
      console.error('smart-responder: invalid JSON body', error)
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const businessType = body.businessType || 'Retail Business'
    const targetAudience = body.targetAudience || 'General Public'
    const spendingBracket = body.spendingBracket || '$$'
    const suburbName = body.suburbName || 'the selected area'
    const region = body.region || 'Australia'
    const pointCount = body.pointCount ?? body.venueSummary?.total ?? 0
    const categories = Array.isArray(body.categories) ? body.categories.slice(0, 20) : []
    const activeArea = body.activeArea || suburbName
    const venueSummary = body.venueSummary ?? { total: 0, byCategory: {} }
    const venueSample = Array.isArray(body.venueSample) ? body.venueSample.slice(0, 50) : []
    const scoringContext = body.scoringContext ?? {}

    const isMapBriefing = body.region !== undefined || body.pointCount !== undefined || body.activeArea !== undefined

    const systemPrompt = isMapBriefing
      ? `You are AXEL, a commercial real estate intelligence AI.

  You are analyzing a search area for business opportunities.

  Search Parameters:
  - Region: ${region}
  - Target Area: ${activeArea}
  - Venues Found: ${pointCount}
  - Categories: ${categories.join(', ') || 'Various'}

  Location intelligence summary:
  ${JSON.stringify(venueSummary, null, 2)}

  Sample local venues:
  ${JSON.stringify(venueSample, null, 2)}

  Provide a brief, professional analysis of this location in 3-4 sentences:
  1. Describe the market saturation and opportunity level
  2. Comment on category diversity
  3. Suggest potential business synergies
  4. Rate overall attractiveness (1-5 stars equivalent)

  Be concise and data-driven.`
      : `You are AXEL, a Senior Commercial Real Estate AI.

  The user is evaluating:
  - Business Type: ${businessType}
  - Target Audience: ${targetAudience}
  - Spending Bracket: ${spendingBracket}
  - Suburb: ${suburbName}

  Location intelligence summary:
  ${JSON.stringify(venueSummary, null, 2)}

  Scoring context:
  ${JSON.stringify(scoringContext, null, 2)}

  Sample local venues:
  ${JSON.stringify(venueSample, null, 2)}

  Provide a concise, professional briefing using this structure:
  Overview:
  Key Insights:
  Considerations:
  Verdict:

  Keep it practical, specific, and avoid mentioning that you are an AI.`

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      console.error('smart-responder: missing GEMINI_API_KEY')
      return new Response(
        JSON.stringify({
          briefing:
            'Overview: AI briefing is temporarily unavailable.\nKey Insights: Gemini is not configured for this project yet.\nConsiderations: Please add GEMINI_API_KEY to Supabase Edge Function secrets.\nVerdict: The location data is available, but the AI analysis is currently disabled.',
          fallback: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const generatedText = await generateWithGemini(apiKey, systemPrompt)

    if (!generatedText) {
      return new Response(
        JSON.stringify({
          briefing:
            'Overview: The AI analysis is temporarily unavailable.\nKey Insights: The request was received, but Gemini did not return a usable response.\nConsiderations: Check the edge function logs and Gemini API key.\nVerdict: Use the current venue summary as a fallback until the AI service is healthy.',
          fallback: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(JSON.stringify({ briefing: generatedText }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('FULL ERROR:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function generateWithGemini(apiKey: string, prompt: string): Promise<string | null> {
  try {
    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${geminiModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
        }),
      }
    )

    const rawText = await response.text()

    if (!response.ok) {
      console.error('smart-responder: Gemini returned non-OK response', response.status, rawText)
      return null
    }

    let parsed: {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
      }>
      error?: { message?: string }
    }

    try {
      parsed = JSON.parse(rawText) as typeof parsed
    } catch (error) {
      console.error('smart-responder: Gemini returned non-JSON payload', error, rawText)
      return null
    }

    if (parsed.error) {
      console.error('smart-responder: Gemini response error', parsed.error)
      return null
    }

    const text = parsed.candidates?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('')
      .trim()

    return text || null
  } catch (error) {
    console.error('smart-responder: Gemini crash', error)
    return null
  }
}
