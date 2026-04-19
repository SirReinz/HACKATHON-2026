import * as React from "react"
import { Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

type VenueMixItem = {
  name: string
  value: number
  fill?: string
}

type VenueMixChartProps = {
  data: VenueMixItem[]
  className?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  "Dining and Drinking": "#D85A30",
  Retail: "#378ADD",
  "Health and Medicine": "#1D9E75",
  "Business and Professional Services": "#7F77DD",
  "Business and Professional Service": "#7F77DD",
  "Travel and Transportation": "#BA7517",
  "Arts and Entertainment": "#D4537E",
  "Landmarks and Outdoors": "#639922",
  "Sports and Recreation": "#888780",
  "Community and Government": "#534AB7",
  Event: "#B4B2A9",
}

export function VenueMixChart({ data, className = "h-[170px] w-[170px]" }: VenueMixChartProps) {
  const normalizedData = React.useMemo(
    () =>
      data.map((item) => ({
        ...item,
        fill: item.fill ?? CATEGORY_COLORS[item.name] ?? "#888780",
      })),
    [data]
  )

  const chartConfig: ChartConfig = React.useMemo(
    () =>
      Object.fromEntries(
        normalizedData.map((item) => [item.name, { label: item.name, color: item.fill }])
      ),
    [normalizedData]
  )

  if (!normalizedData.length) {
    return null
  }

  return (
    <ChartContainer config={chartConfig} className={className}>
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
        <Pie
          data={normalizedData}
          dataKey="value"
          nameKey="name"
          innerRadius={46}
          outerRadius={72}
          paddingAngle={normalizedData.length > 1 ? 2 : 0}
        />
      </PieChart>
    </ChartContainer>
  )
}
