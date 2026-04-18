import * as React from "react"
import type { Feature, FeatureCollection, Point } from "geojson"

import { supabase } from "@/lib/supabase"

export type BBox = {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

type PlaceRow = {
  id?: string | number
  name?: string
  venue_name?: string
  level1_category_name?: string
  longitude?: number
  latitude?: number
  lng?: number
  lat?: number
  geom?: {
    type?: string
    coordinates?: [number, number]
  }
}

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

export function useSupabasePlaces(bbox: BBox | null, categories: string[]) {
  const [data, setData] = React.useState<
    FeatureCollection<Point, PlaceProperties>
  >(emptyCollection)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const categoryKey = React.useMemo(() => [...categories].sort().join("|"), [categories])

  const fetchPlaces = React.useCallback(async () => {
    if (!bbox) {
      setData(emptyCollection)
      return
    }

    setLoading(true)
    setError(null)

    const { data: rows, error: rpcError } = await supabase.rpc(
      "get_places_in_bbox",
      {
        min_lng: bbox.minLng,
        min_lat: bbox.minLat,
        max_lng: bbox.maxLng,
        max_lat: bbox.maxLat,
        category_filter: categories.length ? categories : null,
      }
    )

    if (rpcError) {
      setError(rpcError.message)
      setData(emptyCollection)
      setLoading(false)
      return
    }

    const resultRows = Array.isArray(rows) ? (rows as PlaceRow[]) : []
    setData(toFeatureCollection(resultRows))
    setLoading(false)
  }, [bbox, categories])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPlaces()
  }, [fetchPlaces, categoryKey])

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
