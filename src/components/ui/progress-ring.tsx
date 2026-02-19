import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const progressRingVariants = cva("", {
  variants: {
    size: {
      sm: "h-16 w-16",
      md: "h-24 w-24",
      lg: "h-32 w-32",
      xl: "h-40 w-40",
    },
    color: {
      default: "text-primary",
      success: "text-success",
      warning: "text-warning",
      error: "text-error",
      info: "text-info",
    },
  },
  defaultVariants: {
    size: "md",
    color: "default",
  },
})

export interface ProgressRingProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  /** Progress value (0-100) */
  value: number
  /** Size of the ring */
  size?: "sm" | "md" | "lg" | "xl"
  /** Color of the progress arc */
  color?: "default" | "success" | "warning" | "error" | "info"
  /** Stroke width */
  strokeWidth?: number
  /** Show percentage text in center */
  showValue?: boolean
  /** Custom center content */
  children?: React.ReactNode
  /** Track color */
  trackColor?: string
}

const ProgressRing = React.forwardRef<HTMLDivElement, ProgressRingProps>(
  (
    {
      className,
      size,
      color,
      value,
      strokeWidth = 8,
      showValue = true,
      trackColor = "currentColor",
      children,
      ...props
    },
    ref
  ) => {
    // Clamp value between 0 and 100
    const clampedValue = Math.min(100, Math.max(0, value))
    
    // Calculate dimensions based on size
    const sizeMap = {
      sm: 64,
      md: 96,
      lg: 128,
      xl: 160,
    }
    const dimension = sizeMap[size || "md"]
    const radius = (dimension - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const strokeDashoffset = circumference - (clampedValue / 100) * circumference

    return (
      <div
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center",
          progressRingVariants({ size }),
          className
        )}
        {...props}
      >
        <svg
          className="rotate-[-90deg]"
          width={dimension}
          height={dimension}
        >
          {/* Background track */}
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          {/* Progress arc */}
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={cn(progressRingVariants({ color }))}
            style={{
              transition: "stroke-dashoffset 0.5s ease-in-out",
            }}
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center">
          {children ? (
            children
          ) : showValue ? (
            <span className="text-lg font-semibold text-foreground">
              {Math.round(clampedValue)}%
            </span>
          ) : null}
        </div>
      </div>
    )
  }
)
ProgressRing.displayName = "ProgressRing"

export { ProgressRing, progressRingVariants }
