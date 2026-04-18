import { ArrowDownToLine } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ThemeToggle } from "@/components/theme-toggle"

const metricCards = [
  { label: "Active Venues", value: "1,284" },
  { label: "Dining Share", value: "41%" },
  { label: "Health Share", value: "26%" },
  { label: "Retail Share", value: "33%" },
]

export function DetailsPage() {
  return (
    <main className="min-h-svh bg-background p-6 md:p-10">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <h1 className="text-2xl font-semibold">Deep Dive Analytics</h1>
        <ThemeToggle />
      </div>

      <div className="mx-auto mt-6 grid w-full max-w-7xl gap-6 lg:grid-cols-[360px_1fr]">
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Numbers</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {metricCards.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border bg-muted/40 p-4 transition-colors hover:bg-muted/70"
                >
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button className="w-full rounded-2xl" size="lg">
            <ArrowDownToLine className="mr-2 size-4" />
            Export CSV
          </Button>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Narrative Intelligence</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[65vh] pr-3">
              <div className="space-y-6 text-sm leading-relaxed">
                <section>
                  <h2 className="text-lg font-medium">Overview</h2>
                  <p className="mt-2 text-muted-foreground">
                    This market shows stable mixed-use demand with strong food-and-beverage anchors
                    and improving retail diversity near transport corridors.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-medium">Key Insights:</h2>
                  <p className="mt-2 text-muted-foreground">
                    Dining density is highest within 1.5 km of CBD boundaries, while health services
                    are clustered around major arterial roads.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-medium">Considerations:</h2>
                  <p className="mt-2 text-muted-foreground">
                    Afternoon footfall volatility suggests comparing weekend and weekday activity before
                    committing to short-term leasing assumptions.
                  </p>
                </section>

                <section>
                  <h2 className="text-lg font-medium">Tips and Tricks</h2>
                  <p className="mt-2 text-muted-foreground">
                    Focus on micro-zones where two categories overlap, then validate rent pressure and
                    nearby anchor influence to improve campaign precision.
                  </p>
                </section>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
