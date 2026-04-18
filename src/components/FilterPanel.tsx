import { Check, ChevronDown, X } from "lucide-react"

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
import { PLACE_CATEGORY_OPTIONS } from "@/lib/place-categories"

type FilterPanelProps = {
  selectedCategories: string[]
  onChangeCategories: (categories: string[]) => void
  onSearchArea: () => void
  loading?: boolean
  error?: string | null
  compact?: boolean
}

export function FilterPanel({
  selectedCategories,
  onChangeCategories,
  onSearchArea,
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
                    return (
                      <CommandItem
                        key={category}
                        value={category}
                        onSelect={() => toggleCategory(category)}
                      >
                        <Check className={`size-4 ${selected ? "opacity-100" : "opacity-0"}`} />
                        <span>{category}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="flex flex-wrap gap-2">
          {selectedCategories.length ? (
            selectedCategories.map((category) => (
              <Badge key={category} variant="secondary" className="gap-1.5 pr-1">
                <span>{category}</span>
                <button
                  type="button"
                  aria-label={`Remove ${category}`}
                  className="rounded-full p-0.5 hover:bg-foreground/10"
                  onClick={() => removeCategory(category)}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No categories selected.</p>
          )}
        </div>

        <Button onClick={onSearchArea} className="w-full rounded-2xl" disabled={loading}>
          Search This Area
        </Button>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
