import * as React from "react"
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from "geojson"

import { fetchPlacesInPolygonPaginated, type PlaceRow } from "@/lib/fetchPlacesPaginated"

type PlaceProperties = {
  id: string
  name: string
  level1_category_name: string
}

const emptyCollection: FeatureCollection<Point, PlaceProperties> = {
  type: "FeatureCollection",
  features: [],
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function extractCoordinates(row: PlaceRow): [number, number] | null {
  const directLng = toNumber(row.longitude ?? row.lng)
  const directLat = toNumber(row.latitude ?? row.lat)

  if (directLng !== null && directLat !== null) {
    return [directLng, directLat]
  }

  const geom = row.geom
  if (!geom || !Array.isArray(geom.coordinates) || geom.coordinates.length < 2) {
    return null
  }

  const geomLng = toNumber(geom.coordinates[0])
  const geomLat = toNumber(geom.coordinates[1])

  if (geomLng === null || geomLat === null) {
    return null
  }

  return [geomLng, geomLat]
}

function toFeatureCollection(
  rows: PlaceRow[]
): FeatureCollection<Point, PlaceProperties> {
  return {
    type: "FeatureCollection",
    features: rows
      .map((row, index) => {
        const coordinates = extractCoordinates(row)
        if (!coordinates) {
          return null
        }

        const feature: Feature<Point, PlaceProperties> = {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates,
          },
          properties: {
            id: String(row.id ?? index),
            name: row.name ?? row.venue_name ?? "Unknown Venue",
            level1_category_name: row.level1_category_name ?? "Uncategorized",
          },
        }

        return feature
      })
      .filter((feature): feature is NonNullable<typeof feature> => feature !== null),
  }
}

export function useSupabasePlaces(
  selectedGeometry: Polygon | MultiPolygon | null,
  categories: string[],
  queryTrigger: number
) {
  const [data, setData] = React.useState<
    FeatureCollection<Point, PlaceProperties>
  >(emptyCollection)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const requestVersionRef = React.useRef(0)

  const fetchPlaces = React.useCallback(async () => {
    requestVersionRef.current += 1
    const requestVersion = requestVersionRef.current

    if (!selectedGeometry || queryTrigger <= 0) {
      setData(emptyCollection)
      setLoading(false)
      setError(null)
      return
    }

    // Clear stale points immediately for new explicit searches.
    setData(emptyCollection)
    setLoading(true)
    setError(null)

    const { rows, error: fetchError } = await fetchPlacesInPolygonPaginated(
      selectedGeometry,
      categories,
      {
        pageSize: 1000,
        maxPages: 20,
      }
    )

    if (fetchError) {
      if (requestVersion !== requestVersionRef.current) {
        return
      }

      setError(fetchError)
      setData(emptyCollection)
      setLoading(false)
      return
    }

    if (requestVersion !== requestVersionRef.current) {
      return
    }

    setData(toFeatureCollection(rows))
    setLoading(false)
  }, [categories, queryTrigger, selectedGeometry])

  React.useEffect(() => {
    void fetchPlaces()
  }, [fetchPlaces])

  const telemetry = React.useMemo(() => {
    const counts = data.features.reduce(
      (acc, feature) => {
        const category = feature.properties.level1_category_name
        acc.total += 1
        acc.byCategory[category] = (acc.byCategory[category] ?? 0) + 1
        return acc
      },
      {
        total: 0,
        byCategory: {} as Record<string, number>,
      }
    )

    return counts
  }, [data])

  return {
    data,
    loading,
    error,
    telemetry,
    refetch: fetchPlaces,
  }
}
