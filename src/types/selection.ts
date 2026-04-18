import type { LucideIcon } from "lucide-react"

export type SelectionType = "cluster" | "point" | "none"

export type ClusterSelection = {
  type:       SelectionType
  label:      string
  count:      number
  icon:       LucideIcon
  color:      string
  category?:  string
}