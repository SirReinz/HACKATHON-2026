import { useNavigate } from "react-router-dom"
import Map from "react-map-gl/mapbox"

import { useTheme } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN

export function LandingPage() {
  const navigate = useNavigate()
  const { theme } = useTheme()

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
                <Button variant="outline" className="justify-start rounded-2xl" onClick={() => navigate("/dashboard")}>
                Let's explore!
                </Button>
            </div>

            <div className="flex items-start justify-end">
              <img src="/axel-logo.svg" alt="Axel logo" className="size-20 shrink-0 sm:size-24" />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
