import {
  CircleDot,
  Layers,
  MapPin,
  Utensils,
  HeartPulse,
  ShoppingBag,
  Landmark,
  Briefcase,
  Users,
  Trophy,
  Plane,
  Calendar,
  Palette,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { SelectionType, ClusterSelection } from "@/types/selection"

// Maps level1_category_name → icon + color
export const CATEGORY_ICON_MAP: Record<string, { icon: LucideIcon; color: string }> = {
  "Arts and Entertainment":            { icon: Palette,    color: "#ff4df0" },
  "Business and Professional Service": { icon: Briefcase,  color: "#9d4dff" },
  "Community and Government":          { icon: Users,      color: "#4f8cff" },
  "Dining and Drinking":               { icon: Utensils,   color: "#ff4da6" },
  "Event":                             { icon: Calendar,   color: "#ff8a00" },
  "Health and Medicine":               { icon: HeartPulse, color: "#00f0a4" },
  "Landmarks and Outdoors":            { icon: Landmark,   color: "#3bff6d" },
  "Retail":                            { icon: ShoppingBag,color: "#ffd200" },
  "Sports and Recreation":             { icon: Trophy,     color: "#00e5ff" },
  "Travel and Transportation":         { icon: Plane,      color: "#35b6ff" },
}

// Fallbacks per selection type
const SELECTION_DEFAULTS: Record<SelectionType, { icon: LucideIcon; color: string }> = {
  cluster: { icon: Layers,    color: "#00e5ff" },
  point:   { icon: CircleDot, color: "#9ca3af" },
  none:    { icon: MapPin,    color: "#6b7280" },
}

export function buildSelection(
  type:      SelectionType,
  label:     string,
  count:     number,
  category?: string
): ClusterSelection {
  const categoryMeta = category ? CATEGORY_ICON_MAP[category] : undefined
  const fallback     = SELECTION_DEFAULTS[type]

  return {
    type,
    label,
    count,
    category,
    icon:  categoryMeta?.icon  ?? fallback.icon,
    color: categoryMeta?.color ?? fallback.color,
  }
}