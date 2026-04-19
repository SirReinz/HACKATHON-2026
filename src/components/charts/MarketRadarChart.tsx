import * as React from "react"
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

type RadarPoint = Record<string, string | number>

type RadarSeries = {
  key: string
  label: string
  color: string
}

type MarketRadarChartProps = {
  data: RadarPoint[]
  series?: RadarSeries[]
  activeSeriesKey?: string
  className?: string
}

const SERIES_COLORS = ["#1D9E75", "#378ADD", "#D85A30", "#7F77DD", "#BA7517"] as const

function inferSeries(data: RadarPoint[]): RadarSeries[] {
  if (!data.length) return []

  const first = data[0]
  const seriesKeys = Object.keys(first).filter((key) => key !== "metric")

  return seriesKeys.map((key, index) => ({
    key,
    label: `Series ${index + 1}`,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
  }))
}

export function MarketRadarChart({
  data,
  series,
  activeSeriesKey,
  className = "h-[220px] w-full",
}: MarketRadarChartProps) {
  const resolvedSeries = React.useMemo(() => {
    if (series?.length) return series
    return inferSeries(data)
  }, [series, data])

  const chartConfig: ChartConfig = React.useMemo(
    () =>
      Object.fromEntries(
        resolvedSeries.map((item) => [item.key, { label: item.label, color: item.color }])
      ),
    [resolvedSeries]
  )

  if (!data.length || !resolvedSeries.length) {
    return null
  }

  return (
    <ChartContainer config={chartConfig} className={className}>
      <RadarChart data={data} margin={{ top: 12, right: 36, bottom: 12, left: 36 }}>
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <PolarGrid />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9 }} />
        <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
        {resolvedSeries.map((item) => (
          <Radar
            key={item.key}
            dataKey={item.key}
            stroke={`var(--color-${item.key})`}
            fill={`var(--color-${item.key})`}
            fillOpacity={activeSeriesKey === item.key ? 0.25 : 0.08}
            strokeWidth={activeSeriesKey === item.key ? 2.5 : 1.5}
            dot={activeSeriesKey === item.key ? { r: 3, fillOpacity: 1 } : false}
          />
        ))}
      </RadarChart>
    </ChartContainer>
  )
}
