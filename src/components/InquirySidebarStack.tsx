import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"

import { CATEGORY_ICON_MAP } from "@/lib/selectionIcons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

type InquirySidebarStackProps = {
  aiSummary: string
  briefingLoading: boolean
  aiStatus: string
  areaLabel: string
  venueCount: number
  wealthDecile: number | null | undefined
  competitorsPerThousand: number | null | undefined
  axelScore: number | null | undefined
  venueByCategory: Record<string, number>
  fetchMessage?: string | null
  onFreeView?: () => void
  onDeepDive?: () => void
  deepDiveDisabled?: boolean
  cardClassName?: string
  markdownComponents: Components
}

export function InquirySidebarStack({
  aiSummary,
  briefingLoading,
  aiStatus,
  areaLabel,
  venueCount,
  wealthDecile,
  competitorsPerThousand,
  axelScore,
  venueByCategory,
  fetchMessage = null,
  onFreeView,
  onDeepDive,
  deepDiveDisabled = false,
  cardClassName = "border-border/50 bg-background/60 shadow-2xl shadow-primary/10 backdrop-blur-md",
  markdownComponents,
}: InquirySidebarStackProps) {
  const hasVenueMix = Object.keys(venueByCategory).length > 0

  return (
    <>
      <Card className={`min-h-0 flex-1 flex flex-col ${cardClassName}`}>
        <CardHeader className="shrink-0">
          <CardTitle>AI Overview &amp; Description</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex flex-1 flex-col">
          <p className="mb-3 shrink-0 text-xs font-medium tracking-wide text-primary uppercase">{aiStatus}</p>
          {briefingLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1 pr-3">
              <div className="space-y-3 text-foreground/90">
                <ReactMarkdown components={markdownComponents}>{aiSummary}</ReactMarkdown>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className={`min-h-0 max-h-[50%] flex flex-col ${cardClassName}`}>
        <CardHeader>
          <CardTitle>Current Selection</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex flex-1 flex-col gap-3">
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-3 pr-1">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Active Area", value: areaLabel },
                  { label: "Venue Count", value: venueCount },
                  {
                    label: "Wealth Decile",
                    value: wealthDecile != null ? `${wealthDecile} / 10` : "N/A",
                  },
                  {
                    label: "Competitors / 1k",
                    value: competitorsPerThousand != null ? competitorsPerThousand : "N/A",
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-muted/40 p-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      {label}
                    </p>
                    <p className="truncate text-[15px] font-medium text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-muted/40 p-2.5">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Axel Score
                </p>
                {axelScore != null ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-36 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${axelScore}%` }}
                        />
                      </div>
                      <span className="text-[15px] font-medium text-foreground tabular-nums">
                        {axelScore.toFixed(0)} / 100
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                        axelScore >= 75
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : axelScore >= 50
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }`}
                    >
                      {axelScore >= 75 ? "Strong" : axelScore >= 50 ? "Moderate" : "Weak"}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">N/A</span>
                )}
                {fetchMessage ? (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{fetchMessage}</p>
                ) : null}
              </div>

              {hasVenueMix && (
                <div className="border-t border-border/40 pt-3">
                  <p className="mb-2.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    Venue Mix
                  </p>
                  {(() => {
                    const entries = Object.entries(venueByCategory).sort((a, b) => b[1] - a[1])
                    const maxCount = Math.max(...entries.map(([, c]) => c))
                    return entries.map(([name, count]) => (
                      <div
                        key={name}
                        className="grid grid-cols-[140px_1fr_auto_auto] items-center gap-2 mb-1.5"
                      >
                        <span className="truncate text-xs text-muted-foreground">{name}</span>
                        <div className="h-1 overflow-hidden rounded-full bg-border/50">
                          <div
                            className="h-full rounded-full opacity-85"
                            style={{
                              backgroundColor: CATEGORY_ICON_MAP[name]?.color ?? "#888",
                              width: `${((count / maxCount) * 100).toFixed(0)}%`,
                            }}
                          />
                        </div>
                        <span className="text-right text-xs font-medium tabular-nums text-foreground">
                          {count}
                        </span>
                        <span className="w-7 text-right text-[11px] tabular-nums text-muted-foreground">
                          {Math.round((count / venueCount) * 100)}%
                        </span>
                      </div>
                    ))
                  })()}
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="outline" className="w-full rounded-full" onClick={onFreeView}>
              Free View
            </Button>
            <Button
              className="w-full rounded-full bg-primary text-primary-foreground"
              onClick={onDeepDive}
              disabled={deepDiveDisabled}
            >
              Deep Dive
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
