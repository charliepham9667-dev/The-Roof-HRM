import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { TrendingUp, TrendingDown, Minus, MoreVertical } from "lucide-react"
import { LineChart, Line, ResponsiveContainer } from "recharts"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

const statCardVariants = cva(
  "rounded-card border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-md",
  {
    variants: {
      variant: {
        default: "",
        success: "",
        warning: "",
        error: "",
        info: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface SparklineDataPoint {
  value: number
}

export interface StatCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statCardVariants> {
  /** Rendering mode (opt-in) */
  mode?: "default" | "kpi"
  /** Card title/label */
  label: string
  /** Main value to display */
  value: string | number
  /** Trend percentage (positive or negative) */
  trend?: number
  /** Subtitle text that appears after trend (e.g., "from last month") */
  subtitle?: string
  /** Secondary muted line beneath the trend line (KPI mode) */
  subtext?: string
  /** Optional sparkline data points */
  sparklineData?: SparklineDataPoint[]
  /** Menu items for the dropdown */
  menuItems?: { label: string; onClick: () => void }[]
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      className,
      variant,
      mode = "default",
      label,
      value,
      trend,
      subtitle,
      subtext,
      sparklineData,
      menuItems,
      ...props
    },
    ref
  ) => {
    const getTrendIcon = () => {
      if (trend === undefined || trend === null) return null
      if (trend > 0) return <TrendingUp className="h-3 w-3" />
      if (trend < 0) return <TrendingDown className="h-3 w-3" />
      return <Minus className="h-3 w-3" />
    }

    const getTrendColor = () => {
      if (trend === undefined || trend === null) return "text-muted-foreground"
      if (trend > 0) return "text-success"
      if (trend < 0) return "text-error"
      return "text-muted-foreground"
    }

    const formatTrend = () => {
      if (trend === undefined || trend === null) return ""
      const rounded = Math.round(Math.abs(trend) * 10) / 10
      const sign = trend > 0 ? "+" : trend < 0 ? "-" : ""
      return `${sign}${rounded.toFixed(1)}%`
    }

    const getTrendDirectionText = () => {
      if (trend === undefined || trend === null) return ""
      if (trend > 0) return "Trending up year over year"
      if (trend < 0) return "Trending down year over year"
      return "Flat year over year"
    }

    const TrendBadgeIcon = () => {
      if (trend === undefined || trend === null) return null
      if (trend > 0) return <TrendingUp className="h-3 w-3" />
      if (trend < 0) return <TrendingDown className="h-3 w-3" />
      return <Minus className="h-3 w-3" />
    }

    return (
      <div
        ref={ref}
        className={cn(statCardVariants({ variant }), className)}
        {...props}
      >
        {mode === "kpi" ? (
          <>
            {/* Header with label, % badge, and optional menu */}
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-muted-foreground">{label}</span>

              <div className="flex items-start gap-1.5">
                {trend !== undefined && trend !== null && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium",
                      getTrendColor()
                    )}
                    aria-label={`${formatTrend()} year over year`}
                    title={`${formatTrend()} year over year`}
                  >
                    <TrendBadgeIcon />
                    {formatTrend()}
                  </span>
                )}

                {menuItems && menuItems.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-mr-2 -mt-2 h-8 w-8 text-muted-foreground"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {menuItems.map((item, index) => (
                        <DropdownMenuItem key={index} onClick={item.onClick}>
                          {item.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            {/* Value */}
            <div className="mt-2">
              <span className="text-3xl font-bold text-foreground">{value}</span>
            </div>

            {/* Trend direction text */}
            {trend !== undefined && trend !== null && (
              <div className={cn("mt-2 flex items-center gap-1 text-sm font-medium", getTrendColor())}>
                {getTrendIcon()}
                <span>{getTrendDirectionText()}</span>
              </div>
            )}

            {/* Subtext */}
            {subtext && <div className="mt-0.5 text-sm text-muted-foreground">{subtext}</div>}
          </>
        ) : (
          <>
            {/* Header with label and optional menu */}
            <div className="flex items-start justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {label}
              </span>

              {menuItems && menuItems.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="-mr-2 -mt-2 h-8 w-8 text-muted-foreground"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {menuItems.map((item, index) => (
                      <DropdownMenuItem key={index} onClick={item.onClick}>
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Value */}
            <div className="mt-2">
              <span className="text-3xl font-bold text-foreground">{value}</span>
            </div>

            {/* Trend + Subtitle inline */}
            {(trend !== undefined || subtitle) && (
              <div className="mt-1 flex items-center gap-1 text-sm">
                {trend !== undefined && trend !== null && (
                  <span className={cn("flex items-center gap-1 font-medium", getTrendColor())}>
                    {getTrendIcon()}
                    {formatTrend()}
                  </span>
                )}
                {subtitle && (
                  <span className="text-muted-foreground">{subtitle}</span>
                )}
              </div>
            )}

            {/* Optional Sparkline */}
            {sparklineData && sparklineData.length > 0 && (
              <div className="mt-4 h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData}>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="rgb(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "rgb(var(--primary))", strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard, statCardVariants }
