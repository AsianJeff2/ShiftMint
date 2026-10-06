// Temporary fix for chart component types
import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Fixed type definitions
interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  [key: string]: any;
}

interface ChartLegendProps {
  payload?: any[];
  verticalAlign?: string;
  [key: string]: any;
}

const ChartTooltip = React.forwardRef<
  HTMLDivElement,
  ChartTooltipProps
>(({ active, payload, label, className, ...props }, ref) => {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-background p-2 shadow-md",
        className
      )}
    >
      {label && <p className="font-medium">{label}</p>}
      {payload.map((item: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.name}: {item.value}</span>
        </div>
      ))}
    </div>
  )
})
ChartTooltip.displayName = "ChartTooltip"

const ChartLegend = React.forwardRef<
  HTMLDivElement,
  ChartLegendProps
>(({ payload, className, ...props }, ref) => {
  if (!payload?.length) {
    return null
  }

  return (
    <div
      ref={ref}
      className={cn("flex flex-wrap gap-4", className)}
    >
      {payload.map((item: any) => (
        <div key={item.value} className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-sm">{item.value}</span>
        </div>
      ))}
    </div>
  )
})
ChartLegend.displayName = "ChartLegend"

// Export fixed components
export { ChartTooltip, ChartLegend }