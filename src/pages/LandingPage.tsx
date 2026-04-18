import * as React from "react"
import { useNavigate } from "react-router-dom"
import Map from "react-map-gl/mapbox"
import axelLogo from "@/assets/axel-logo.svg"

import { useTheme } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card, CardContent } from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN

type Region = {
  label: string
  value: string
}

const regions: Region[] = [
  { label: "Australia", value: "australia" },
  { label: "New Zealand", value: "new-zealand" },
  { label: "Singapore", value: "singapore" },
]

export function LandingPage() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const [open, setOpen] = React.useState(false)

  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const mapStyle = isDark
    ? "mapbox://styles/mapbox/dark-v11"
    : "mapbox://styles/mapbox/light-v11"

  return (
    <main className="relative h-svh w-full overflow-hidden">
      {mapboxToken ? (
        <Map
          mapboxAccessToken={mapboxToken}
          initialViewState={{
            longitude: 133.7751,
            latitude: -25.2744,
            zoom: 3.5,
          }}
          mapStyle={mapStyle}
          interactive={false}
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <div className="h-full w-full bg-muted" />
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/15 via-transparent to-background/40" />

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="absolute inset-0 z-10 grid place-items-center p-6">
        <Card className="w-full max-w-2xl border-white/25 bg-card/70 shadow-2xl backdrop-blur-xl">
          <CardContent className="grid grid-cols-[1fr_auto] gap-5 p-6 sm:p-8">
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold sm:text-4xl">Welcome To Axel</h1>
              <p className="text-sm text-muted-foreground">Where are you headed?</p>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start rounded-2xl">
                    Select a region
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Search region..." />
                    <CommandList>
                      <CommandEmpty>No regions found.</CommandEmpty>
                      <CommandGroup heading="Regions">
                        {regions.map((region) => (
                          <CommandItem
                            key={region.value}
                            value={region.label}
                            onSelect={() => {
                              navigate("/explore", {
                                state: {
                                  region: region.value,
                                },
                              })
                              setOpen(false)
                            }}
                          >
                            {region.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-start justify-end">
              <img src={axelLogo} alt="Axel logo" className="size-20 shrink-0 sm:size-24" />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
