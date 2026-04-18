import { useLocation } from "react-router-dom"

import { MapViewport } from "@/components/MapViewport"

export function MapPage() {
  const location = useLocation()

  const region =
    typeof location.state === "object" &&
    location.state !== null &&
    "region" in location.state
      ? String(location.state.region)
      : "australia"

  const initialArea =
    typeof location.state === "object" &&
    location.state !== null &&
    "initialArea" in location.state
      ? String(location.state.initialArea)
      : undefined

  return <MapViewport region={region} initialArea={initialArea} />
}
