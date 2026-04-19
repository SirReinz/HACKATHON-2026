import * as React from "react"
import { useUser } from "@clerk/clerk-react"
import { Check, ChevronsUpDown, Trash2 } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import axelLogo from "@/assets/axel-logo.svg"
import { MarketRadarChart } from "@/components/charts/MarketRadarChart"
import { VenueMixChart } from "@/components/charts/VenueMixChart"
import { InquiryFormDialog } from "@/components/InquiryFormDialog"
import { PreviewMap, type HoveredInquiry } from "@/components/PreviewMap"
import { UserProfileBox } from "@/components/UserProfileBox"
import { ThemeToggle } from "@/components/theme-toggle"
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
import { supabase } from "@/lib/supabase"

type InquiryRow = {
  id: string
  business_type: string
  spending_bracket: string
  created_at: string
  analysis_data?: {
    population?: number | null
    competitorsPerThousand?: number | null
    seifaDecile?: number | null
    finalScore?: number | null
    aiBriefing?: string
    radarData?: Array<Record<string, string | number>>
    venueMix?: Array<{ name: string; value: number; fill?: string }>
    boundary_geojson?: {
      type?: "Polygon" | "MultiPolygon"
      coordinates?: unknown
    } | null
    bySuburb?: Record<
      string,
      {
        boundary_geojson?: {
          type?: "Polygon" | "MultiPolygon"
          coordinates?: unknown
        } | null
      }
    >
  } | null
  results_data: {
    suburbs?: string[]
    active_suburb?: string
    fallback_center?: [number, number]
    boundary_geojson?: {
      type?: "Polygon" | "MultiPolygon"
      coordinates?: unknown
    }
  } | null
}

export function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useUser()

  const [inquiries, setInquiries] = React.useState<InquiryRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [hoveredInquiry, setHoveredInquiry] = React.useState<HoveredInquiry | null>(null)
  const [selectedSpend, setSelectedSpend] = React.useState<string[]>([])
  const [selectedBusiness, setSelectedBusiness] = React.useState<string[]>([])
  const [businessFilterOpen, setBusinessFilterOpen] = React.useState(false)
  const [spendFilterOpen, setSpendFilterOpen] = React.useState(false)
  const [deletingInquiryId, setDeletingInquiryId] = React.useState<string | null>(null)
  const isInquiryDialogOpen = location.pathname === "/inquiry/new"

  const hoveredInquiryRow = React.useMemo(() => {
    if (!hoveredInquiry) return null
    return inquiries.find((item) => item.id === hoveredInquiry.id) ?? null
  }, [hoveredInquiry, inquiries])

  const hoveredAnalysis = hoveredInquiryRow?.analysis_data ?? null
  const hoveredRadarData =
    hoveredAnalysis && Array.isArray(hoveredAnalysis.radarData) ? hoveredAnalysis.radarData : []
  const hoveredVenueMix =
    hoveredAnalysis && Array.isArray(hoveredAnalysis.venueMix) ? hoveredAnalysis.venueMix : []

  React.useEffect(() => {
    let cancelled = false

    const loadInquiries = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from("inquiries")
        .select("id, business_type, spending_bracket, created_at, results_data, analysis_data")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (cancelled) {
        return
      }

      setInquiries(Array.isArray(data) ? (data as InquiryRow[]) : [])
      setLoading(false)
    }

    void loadInquiries()

    return () => {
      cancelled = true
    }
  }, [user])

  const businessOptions = React.useMemo(() => {
    return Array.from(new Set(inquiries.map((item) => item.business_type.trim()).filter(Boolean)))
  }, [inquiries])

  const spendOptions = React.useMemo(() => {
    return Array.from(new Set(inquiries.map((item) => item.spending_bracket.trim()).filter(Boolean)))
  }, [inquiries])

  const selectedBusinessLabel = React.useMemo(() => {
    if (selectedBusiness.length === 0) return "All Business Types"
    if (selectedBusiness.length === 1) return selectedBusiness[0]
    return `${selectedBusiness.length} Business Types`
  }, [selectedBusiness])

  const selectedSpendLabel = React.useMemo(() => {
    if (selectedSpend.length === 0) return "All Spend Brackets"
    if (selectedSpend.length === 1) return selectedSpend[0]
    return `${selectedSpend.length} Spending Brackets`
  }, [selectedSpend])

  const filteredInquiries = React.useMemo(() => {
    return inquiries.filter((inquiry) => {
      const businessOk = selectedBusiness.length === 0 || selectedBusiness.includes(inquiry.business_type)
      const spendOk = selectedSpend.length === 0 || selectedSpend.includes(inquiry.spending_bracket)
      return businessOk && spendOk
    })
  }, [inquiries, selectedBusiness, selectedSpend])

  const toHoveredInquiry = React.useCallback((inquiry: InquiryRow): HoveredInquiry => {
    const activeSuburb = inquiry.results_data?.active_suburb ?? inquiry.results_data?.suburbs?.[0] ?? "Unknown suburb"
    const normalizedActive = activeSuburb.trim().toLowerCase()
    const bySuburbBoundary = inquiry.analysis_data?.bySuburb
      ? Object.entries(inquiry.analysis_data.bySuburb).find(
          ([name]) => name.trim().toLowerCase() === normalizedActive
        )?.[1]?.boundary_geojson
      : null

    const boundaryRaw =
      bySuburbBoundary ?? inquiry.analysis_data?.boundary_geojson ?? inquiry.results_data?.boundary_geojson

    const boundaryGeojson =
      boundaryRaw?.type && (boundaryRaw.type === "Polygon" || boundaryRaw.type === "MultiPolygon")
        ? {
            type: boundaryRaw.type,
            coordinates: boundaryRaw.coordinates as any,
          }
        : null

    const fallbackCenter = Array.isArray(inquiry.results_data?.fallback_center)
      ? inquiry.results_data?.fallback_center
      : undefined

    return {
      id: inquiry.id,
      title: inquiry.business_type,
      activeSuburb,
      boundaryGeojson,
      fallbackCenter,
    }
  }, [])

  React.useEffect(() => {
    if (!filteredInquiries.length) {
      setHoveredInquiry(null)
      return
    }

    setHoveredInquiry((prev) => {
      if (prev && filteredInquiries.some((item) => item.id === prev.id)) {
        return prev
      }

      return toHoveredInquiry(filteredInquiries[0])
    })
  }, [filteredInquiries, toHoveredInquiry])

  React.useEffect(() => {
    if (filteredInquiries.length <= 1) {
      return
    }

    const interval = window.setInterval(() => {
      setHoveredInquiry((prev) => {
        const currentIndex = prev ? filteredInquiries.findIndex((item) => item.id === prev.id) : -1
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % filteredInquiries.length : 0
        return toHoveredInquiry(filteredInquiries[nextIndex])
      })
    }, 20000)

    return () => {
      window.clearInterval(interval)
    }
  }, [filteredInquiries, toHoveredInquiry])

  const toggleSpend = React.useCallback((value: string, checked: boolean) => {
    setSelectedSpend((prev) => {
      if (checked) {
        if (prev.includes(value)) return prev
        return [...prev, value]
      }

      return prev.filter((item) => item !== value)
    })
  }, [])

  const toggleBusiness = React.useCallback((value: string, checked: boolean) => {
    setSelectedBusiness((prev) => {
      if (checked) {
        if (prev.includes(value)) return prev
        return [...prev, value]
      }

      return prev.filter((item) => item !== value)
    })
  }, [])

  const handleDeleteInquiry = React.useCallback(
    async (inquiryId: string) => {
      if (!user?.id || deletingInquiryId) return

      const confirmed = window.confirm("Delete this saved inquiry? This action cannot be undone.")
      if (!confirmed) return

      setDeletingInquiryId(inquiryId)

      const { error } = await supabase
        .from("inquiries")
        .delete()
        .eq("id", inquiryId)
        .eq("user_id", user.id)

      if (error) {
        console.error("Delete inquiry failed", error)
        setDeletingInquiryId(null)
        return
      }

      setHoveredInquiry((prev) => (prev?.id === inquiryId ? null : prev))
      setInquiries((prev) => prev.filter((item) => item.id !== inquiryId))
      setDeletingInquiryId(null)
    },
    [deletingInquiryId, user],
  )

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="fixed top-0 right-0 left-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-400 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <img src={axelLogo} alt="AXEL logo" className="h-8 w-auto" />
            <div className="space-y-0.5">
              <span className="block text-2xl leading-none font-semibold tracking-[0.18em] text-cyan-600 dark:text-cyan-300">AXEL</span>
              <p className="text-[11px] leading-none tracking-[0.2em] text-muted-foreground uppercase">Information made easy</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserProfileBox />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-400 gap-6 px-4 pt-20 pb-4 lg:px-6">
        <section className="flex h-[calc(100svh-5.5rem)] min-w-0 flex-1 gap-3">
            <Card className="min-h-0 w-96 shrink-0 border border-border bg-card shadow-none">
              <CardHeader className="border-b border-border pb-2">
                <CardTitle className="text-lg font-semibold tracking-tight text-foreground">Saved Inquiries</CardTitle>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Business Type</p>
                    <Popover open={businessFilterOpen} onOpenChange={setBusinessFilterOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="business-filter"
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={businessFilterOpen}
                          className="h-8 w-full justify-between border-border bg-background px-2 text-xs font-medium text-foreground hover:bg-accent"
                        >
                          <span className="truncate">{selectedBusinessLabel}</span>
                          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-60" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] border-border bg-popover p-0 shadow-xl">
                        <Command className="bg-popover text-popover-foreground">
                          <CommandInput placeholder="Search business type..." className="text-popover-foreground" />
                          <CommandList>
                            <CommandEmpty>No business types found.</CommandEmpty>
                            <CommandGroup>
                              {businessOptions.map((option) => {
                                const isActive = selectedBusiness.includes(option)

                                return (
                                  <CommandItem
                                    key={option}
                                    value={option}
                                    onSelect={() => {
                                      toggleBusiness(option, !isActive)
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Check className={`size-4 ${isActive ? "opacity-100" : "opacity-0"}`} />
                                    <span className="truncate">{option}</span>
                                  </CommandItem>
                                )
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Spending Bracket</p>
                    <Popover open={spendFilterOpen} onOpenChange={setSpendFilterOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={spendFilterOpen}
                          className="h-8 w-full justify-between border-border bg-background px-2 text-xs font-medium text-foreground hover:bg-accent"
                        >
                          <span className="truncate">{selectedSpendLabel}</span>
                          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-60" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] border-border bg-popover p-0 shadow-xl">
                        <Command className="bg-popover text-popover-foreground">
                          <CommandInput placeholder="Search spending bracket..." className="text-popover-foreground" />
                          <CommandList>
                            <CommandEmpty>No spending brackets found.</CommandEmpty>
                            <CommandGroup>
                              {spendOptions.map((option) => {
                                const isActive = selectedSpend.includes(option)

                                return (
                                  <CommandItem
                                    key={option}
                                    value={option}
                                    onSelect={() => {
                                      toggleSpend(option, !isActive)
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Check className={`size-4 ${isActive ? "opacity-100" : "opacity-0"}`} />
                                    <span className="truncate">{option}</span>
                                  </CommandItem>
                                )
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="min-h-0">
                <ScrollArea className="h-[calc(100svh-19.5rem)] pr-2">
                <div className="space-y-3">
                  {loading ? (
                    <Card className="border border-border bg-muted/20">
                      <CardContent className="p-6 text-sm text-muted-foreground">Loading inquiries...</CardContent>
                    </Card>
                  ) : null}

                  {!loading && !filteredInquiries.length ? (
                    <Card className="border border-border bg-muted/20">
                      <CardContent className="p-8 text-center text-muted-foreground">
                        No matching inquiries. Try adjusting your filters.
                      </CardContent>
                    </Card>
                  ) : null}

                  {filteredInquiries.map((inquiry) => (
                    (() => {
                      const isActivePreview = hoveredInquiry?.id === inquiry.id

                      return (
                    <Card
                      key={inquiry.id}
                      className={`relative p-4 pr-12 cursor-pointer border bg-card transition-all w-full duration-200 hover:border-border hover:bg-accent/35 dark:hover:bg-slate-800/80 ${isActivePreview ? "border-cyan-500/80 shadow-[0_0_0_1px_rgba(8,145,178,0.35)] dark:border-cyan-300/90 dark:shadow-[0_0_0_1px_rgba(103,232,249,0.35)]" : "border-border"}`}
                      onClick={() => navigate(`/inquiry/results?inquiryId=${inquiry.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          navigate(`/inquiry/results?inquiryId=${inquiry.id}`)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open saved inquiry ${inquiry.business_type}`}
                      onMouseEnter={() => setHoveredInquiry(toHoveredInquiry(inquiry))}
                    >
                      <CardHeader>
                        <div className="grid grid-cols-1 gap-1 min-w-0 flex-1">
                            <CardTitle className="block w-full truncate text-base font-semibold text-foreground text-2xs">{inquiry.business_type}</CardTitle>
                            <p className="text-xs text-muted-foreground">
                              {new Date(inquiry.created_at).toLocaleString()}
                            </p>
                        </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="absolute top-4 right-4 h-8 w-8 shrink-0 text-red-500 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/15 dark:hover:text-red-300"
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleDeleteInquiry(inquiry.id)
                            }}
                            onKeyDown={(event) => {
                              event.stopPropagation()
                            }}
                            disabled={deletingInquiryId === inquiry.id}
                            aria-label={`Delete inquiry ${inquiry.business_type}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 gap-1 text-sm min-w-0">
                        <div className="flex items-center gap-2 mt-2 w-full">
                          <span className="shrink-0 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-xs font-medium border border-emerald-500/20">
                            Spend: {inquiry.spending_bracket}
                          </span>
                          <span className="truncate block w-full text-xs text-slate-300">
                            {(inquiry.results_data?.suburbs ?? []).join(", ") || "No suburb"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                      )
                    })()
                  ))}
                </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="min-h-0 h-full min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-card shadow-[0_10px_30px_rgba(15,23,42,0.12)] dark:shadow-[0_10px_45px_rgba(2,6,23,0.45)]">
              <div className="flex h-full min-w-0 flex-col">
                <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-2">
                  <Button
                    variant="ghost"
                    className="h-10 flex-1 cursor-pointer items-center justify-center rounded-lg border border-sky-500 bg-sky-200 text-sm font-black tracking-[0.14em] text-sky-900 uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:bg-sky-300 transition-colors dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100 dark:hover:bg-sky-500/30"
                    onClick={() => navigate("/explore")}
                  >
                    Free Explore
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-10 flex-1 cursor-pointer items-center justify-center rounded-lg border border-amber-500 bg-amber-200 text-sm font-black tracking-[0.14em] text-amber-900 uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:bg-amber-300 transition-colors dark:border-amber-400/70 dark:bg-amber-400/20 dark:text-amber-100 dark:hover:bg-amber-400/30"
                    onClick={() => navigate("/inquiry/new")}
                  >
                    New Inquiry
                  </Button>
                </div>

                <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
                  <PreviewMap hoveredInquiry={hoveredInquiry} />
                  {hoveredInquiry ? (
                    hoveredAnalysis && (hoveredRadarData.length > 0 || hoveredVenueMix.length > 0) ? (
                      <div className="absolute top-3 right-3 bottom-3 z-20 w-[min(25%,320px)] min-w-60">
                        <div className="flex h-full min-h-0 flex-col gap-2">
                          {hoveredRadarData.length > 0 ? (
                            <div className="h-40 min-h-0 overflow-hidden rounded-xl bg-slate-950/35 backdrop-blur-sm">
                              <MarketRadarChart data={hoveredRadarData} className="h-full w-full" />
                            </div>
                          ) : null}

                          {hoveredVenueMix.length > 0 ? (
                            <div className="min-h-0 overflow-hidden rounded-xl bg-slate-950/35 backdrop-blur-sm">
                              <div className="flex h-full min-h-0 flex-col gap-2 p-2">
                                <div className="flex min-h-0 justify-center">
                                  <VenueMixChart data={hoveredVenueMix} className="h-36 w-full max-w-44" />
                                </div>

                                <div className="grid grid-cols-2 gap-2 w-fit mx-auto">
                                  {[
                                    {
                                      label: "Population",
                                      value:
                                        typeof hoveredAnalysis.population === "number"
                                          ? hoveredAnalysis.population.toLocaleString()
                                          : "N/A",
                                    },
                                    {
                                      label: "Axel Score",
                                      value:
                                        typeof hoveredAnalysis.finalScore === "number"
                                          ? `${(hoveredAnalysis.finalScore * 100).toFixed(0)} / 100`
                                          : "N/A",
                                    },
                                    {
                                      label: "Wealth Decile",
                                      value:
                                        typeof hoveredAnalysis.seifaDecile === "number"
                                          ? `${hoveredAnalysis.seifaDecile} / 10`
                                          : "N/A",
                                    },
                                    {
                                      label: "Competitors / 1k",
                                      value:
                                        typeof hoveredAnalysis.competitorsPerThousand === "number"
                                          ? String(hoveredAnalysis.competitorsPerThousand)
                                          : "N/A",
                                    },
                                  ].map(({ label, value }) => (
                                    <div
                                      key={label}
                                      className="min-w-24 max-w-max p-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-left"
                                    >
                                      <p className="truncate text-[8px] font-semibold tracking-wide text-slate-200/70 uppercase">
                                        {label}
                                      </p>
                                      <p className="mt-0.5 text-lg font-bold leading-none tabular-nums text-slate-50">
                                        {value}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="absolute top-3 right-3 z-20 rounded-full bg-slate-950/35 px-3 py-1.5 text-[11px] text-slate-200/85 backdrop-blur-sm">
                        Analytics currently calculating or unavailable
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            </div>
        </section>
      </div>

      <InquiryFormDialog
        open={isInquiryDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            navigate("/dashboard", { replace: true })
          }
        }}
      />
    </main>
  )
}
