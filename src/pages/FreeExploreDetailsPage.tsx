import * as React from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { DetailsPage, type ResultSuburb } from "@/pages/DetailsPage"

type FreeExploreDetailsState = {
  areaLabel?: string
  briefing?: string
  venueCount?: number
  population?: number | null
  wealthDecile?: number | null
  venuePerThousand?: number | null
  axelScore?: number | null
}

function buildFreeExploreResult(state: FreeExploreDetailsState): ResultSuburb {
  const areaLabel = state.areaLabel?.trim() || "Free Explore"

  return {
    name: areaLabel,
    displayName: areaLabel,
    fallbackCenter: [151.2093, -33.8688],
    finalScore:
      state.axelScore !== null && state.axelScore !== undefined
        ? Math.max(0, Math.min(1, state.axelScore / 100))
        : 0.68,
    competitorsPerThousand:
      state.venuePerThousand !== null && state.venuePerThousand !== undefined
        ? state.venuePerThousand
        : 1.2,
    seifaDecile:
      state.wealthDecile !== null && state.wealthDecile !== undefined
        ? state.wealthDecile
        : 5.5,
    population:
      state.population !== null && state.population !== undefined
        ? state.population
        : 120000,
    competitorCount: state.venueCount ?? 0,
  }
}

export function FreeExploreDetailsPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const state =
    typeof location.state === "object" && location.state !== null
      ? (location.state as FreeExploreDetailsState)
      : {}

  const areaLabel = state.areaLabel?.trim()

  React.useEffect(() => {
    if (!areaLabel) {
      navigate("/explore", { replace: true })
    }
  }, [areaLabel, navigate])

  if (!areaLabel) {
    return null
  }

  const scoredResults = [buildFreeExploreResult(state)]
  const countsBySuburb = {
    [scoredResults[0].displayName ?? scoredResults[0].name]: state.venueCount ?? 0,
  }

  return (
    <DetailsPage
      open={true}
      onClose={() => {
        navigate("/explore", {
          replace: true,
          state: { region: "australia", initialArea: areaLabel },
        })
      }}
      scoredResults={scoredResults}
      initialActiveIndex={0}
      countsBySuburb={countsBySuburb}
      initialAiSummary={state.briefing ?? `Analyzing ${areaLabel}...`}
    />
  )
}