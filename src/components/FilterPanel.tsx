import {
  Calendar,
  Check,
  ChevronDown,
  Briefcase,
  HeartPulse,
  Landmark,
  Palette,
  Plane,
  ShoppingBag,
  Trophy,
  Users,
  Utensils,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PLACE_CATEGORY_OPTIONS } from "@/lib/place-categories"

// ---------------------------------------------------------------------------
// Contrast helper — WCAG relative luminance → #111827 or #ffffff
// Handles full hex (#rrggbb) and shorthand (#rgb)
// ---------------------------------------------------------------------------

function getContrastColor(hex: string): string {
  const clean = hex.replace("#", "")
  const full  =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean

  const r = parseInt(full.substring(0, 2), 16)
  const g = parseInt(full.substring(2, 4), 16)
  const b = parseInt(full.substring(4, 6), 16)

  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }

  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)

  // > 0.179 is the WCAG threshold between "light" and "dark" backgrounds
  return luminance > 0.179 ? "#111827" : "#ffffff"
}

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Arts and Entertainment":            Palette,
  "Business and Professional Service": Briefcase,
  "Community and Government":          Users,
  "Dining and Drinking":               Utensils,
  Event:                               Calendar,
  "Health and Medicine":               HeartPulse,
  "Landmarks and Outdoors":            Landmark,
  Retail:                              ShoppingBag,
  "Sports and Recreation":             Trophy,
  "Travel and Transportation":         Plane,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterPanelProps = {
  selectedCategories: string[]
  onChangeCategories: (categories: string[]) => void
  onSearchArea: () => void
  onClearCategories?: () => void
  onSelectAllCategories?: () => void
  categoryColors?: Record<string, string>
  searchEnabled?: boolean
  loading?: boolean
  error?: string | null
  compact?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilterPanel({
  selectedCategories,
  onChangeCategories,
  onSearchArea,
  onClearCategories,
  onSelectAllCategories,
  categoryColors,
  searchEnabled = true,
  loading = false,
  error,
  compact = false,
}: FilterPanelProps) {
  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      onChangeCategories(selectedCategories.filter((item) => item !== category))
      return
    }
    onChangeCategories([...selectedCategories, category])
  }

  const removeCategory = (category: string) => {
    onChangeCategories(selectedCategories.filter((item) => item !== category))
  }

  return (
    <Card className="border-border/50 bg-background/60 shadow-2xl shadow-primary/10 backdrop-blur-md">
      <CardHeader className={compact ? "pb-3" : ""}>
        <CardTitle>Filter of Area</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ── Category dropdown ─────────────────────────────────────────── */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between rounded-2xl">
              Select Categories
              <ChevronDown className="size-4 opacity-70" />
            </Button>
          </PopoverTrigger>

          <PopoverContent align="start" className="w-[min(360px,90vw)] p-0">
            <Command>
              <CommandInput placeholder="Search categories..." />
              <CommandList>
                <CommandEmpty>No categories found.</CommandEmpty>
                <CommandGroup heading="Categories">
                  {PLACE_CATEGORY_OPTIONS.map((category) => {
                    const selected = selectedCategories.includes(category)
                    const Icon     = CATEGORY_ICONS[category]
                    const color    = categoryColors?.[category] ?? "#64748b"

                    return (
                      <CommandItem
                        key={category}
                        value={category}
                        onSelect={() => toggleCategory(category)}
                        className="gap-2"
                      >
                        <Check
                          className={`size-4 shrink-0 ${selected ? "opacity-100" : "opacity-0"}`}
                        />
                        {Icon && (
                          <Icon
                            className="size-4 shrink-0"
                            style={{ color }}
                            strokeWidth={2}
                          />
                        )}
                        <span>{category}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* ── Selected category badges ───────────────────────────────────── */}
        <div className="rounded-xl border border-border/60 bg-background/30 p-2">
          <ScrollArea className="h-24 pr-2">
            <div className="flex flex-wrap gap-2">
              {selectedCategories.length ? (
                selectedCategories.map((category) => {
                  const Icon      = CATEGORY_ICONS[category]
                  const bgColor   = categoryColors?.[category] ?? "#64748b"
                  const textColor = getContrastColor(bgColor)

                  return (
                    <Badge
                      key={category}
                      variant="secondary"
                      className="gap-1.5 border-transparent pr-1"
                      style={{
                        backgroundColor: bgColor,
                        color:           textColor,
                      }}
                    >
                      {/* Icon inherits textColor */}
                      {Icon && (
                        <Icon
                          className="size-3 shrink-0"
                          style={{ color: textColor }}
                          strokeWidth={2.5}
                        />
                      )}

                      <span
                        style={{
                          textShadow: textColor === "#ffffff"
                            ? "0 1px 2px rgba(0,0,0,0.45)"
                            : "0 1px 2px rgba(255,255,255,0.45)",
                        }}
                      >
                        {category}
                      </span>

                      {/* Remove button also inherits textColor */}
                      <button
                        type="button"
                        aria-label={`Remove ${category}`}
                        className="rounded-full p-0.5 hover:bg-black/10"
                        style={{ color: textColor }}
                        onClick={() => removeCategory(category)}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  )
                })
              ) : (
                <p className="text-xs text-muted-foreground">No categories selected.</p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── Select all / Clear ────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          {onSelectAllCategories ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl"
              onClick={onSelectAllCategories}
            >
              Select All
            </Button>
          ) : null}

          {selectedCategories.length && onClearCategories ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl"
              onClick={onClearCategories}
            >
              Clear Categories
            </Button>
          ) : null}
        </div>

        {/* ── Search button ─────────────────────────────────────────────── */}
        <Button
          onClick={onSearchArea}
          className="w-full rounded-2xl"
          disabled={loading || !searchEnabled}
        >
          Search This Area
        </Button>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
