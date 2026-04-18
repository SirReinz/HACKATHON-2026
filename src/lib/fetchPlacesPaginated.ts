import type { MultiPolygon, Polygon } from "geojson"

import { supabase } from "@/lib/supabase"

export type PlaceRow = {
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

type FetchPlacesOptions = {
  pageSize?: number
  maxPages?: number
}

type FetchPlacesResult = {
  rows: PlaceRow[]
  error: string | null
}

const DEFAULT_PAGE_SIZE = 1000
const DEFAULT_MAX_PAGES = 20

export async function fetchPlacesInPolygonPaginated(
  selectedGeometry: Polygon | MultiPolygon,
  categories: string[] | null,
  options?: FetchPlacesOptions
): Promise<FetchPlacesResult> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE
  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES
  const allRows: PlaceRow[] = []

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize
    const to = from + pageSize - 1

    const { data, error } = await supabase
      .rpc("get_places_in_polygon", {
        geojson_polygon: JSON.stringify(selectedGeometry),
        category_filter: categories && categories.length > 0 ? categories : null,
      })
      .range(from, to)

    if (error) {
      return {
        rows: [],
        error: error.message,
      }
    }

    const pageRows = Array.isArray(data) ? (data as PlaceRow[]) : []
    allRows.push(...pageRows)

    if (pageRows.length < pageSize) {
      break
    }
  }

  return {
    rows: allRows,
    error: null,
  }
}
