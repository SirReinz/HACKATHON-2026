import * as React from "react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Skeleton } from "@/components/ui/skeleton"

export type SearchResultItem = {
  id: string
  label: string
}

type SearchBarProps = {
  value: string
  onValueChange: (value: string) => void
  results: SearchResultItem[]
  loading?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectResult: (item: SearchResultItem) => void
  placeholder?: string
}

export function SearchBar({
  value,
  onValueChange,
  results,
  loading = false,
  open,
  onOpenChange,
  onSelectResult,
  placeholder = "Search suburb, postcode, or state (e.g. Parramatta, 2000, NSW)",
}: SearchBarProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) {
        return
      }

      if (rootRef.current.contains(event.target as Node)) {
        return
      }

      onOpenChange(false)
    }

    window.addEventListener("mousedown", onPointerDown)

    return () => {
      window.removeEventListener("mousedown", onPointerDown)
    }
  }, [onOpenChange])

  return (
    <div ref={rootRef} className="relative">
      <Command className="rounded-2xl border border-border bg-background/80 shadow-2xl backdrop-blur-md">
        <CommandInput
          value={value}
          onValueChange={(nextValue) => {
            onValueChange(nextValue)
            if (nextValue.trim().length < 2) {
              onOpenChange(false)
            }
          }}
          onFocus={() => onOpenChange(results.length > 0)}
          placeholder={placeholder}
          className="h-11"
        />
      </Command>

      {open ? (
        <div className="absolute right-0 left-0 z-[70] mt-1.5 overflow-hidden rounded-2xl border border-border bg-background/80 shadow-2xl backdrop-blur-md">
          <Command className="rounded-none border-0 bg-transparent shadow-none">
            <CommandList className="max-h-[45svh] overflow-y-auto">
              {loading ? (
                <div className="space-y-2 p-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              ) : null}
              <CommandEmpty>No places found.</CommandEmpty>
              <CommandGroup heading="Search Results">
                {results.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.label}
                    className="items-start whitespace-normal"
                    onSelect={() => {
                      onSelectResult(item)
                      onOpenChange(false)
                    }}
                  >
                    <span className="line-clamp-2">{item.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      ) : null}
    </div>
  )
}
