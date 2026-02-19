import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * Dashboard-only Card wrapper that matches shadcn dashboard-01 "inset shaded" look.
 * Intentionally NOT used globally to avoid surprising non-dashboard pages.
 */
const DashboardCard = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Card>
>(({ className, style, ...props }, ref) => {
  return (
    <Card
      ref={ref}
      className={cn(
        // Stronger dashboard-01 style depth: gradient + inset highlights + softer outer shadow.
        "relative overflow-hidden",
        // Light mode: keep the surface pure white.
        // Dark mode: keep the dashboard-01 inset/gradient depth.
        "bg-card dark:bg-gradient-to-b dark:from-card dark:to-muted/40",
        "shadow-card dark:shadow-lg dark:shadow-black/30",
        "dark:before:pointer-events-none dark:before:absolute dark:before:inset-0",
        "dark:before:bg-gradient-to-b dark:before:from-[rgb(var(--foreground)_/_0.10)] dark:before:to-transparent",
        "dark:after:pointer-events-none dark:after:absolute dark:after:inset-0",
        "dark:after:bg-[radial-gradient(120%_120%_at_0%_0%,rgb(var(--foreground)_/_0.10),transparent_60%)]",
        "dark:shadow-[inset_0_1px_0_0_rgb(var(--foreground)_/_0.14),inset_0_-1px_0_0_rgb(var(--foreground)_/_0.06)]",
        className
      )}
      // Ensure the dashboard cards render at full opacity (prevents accidental dimming).
      // Also guard against accidental inline padding from upstream layout wrappers.
      style={
        style
          ? { ...style, opacity: 1, padding: 8 }
          : { opacity: 1, padding: 8 }
      }
      {...props}
    />
  )
})
DashboardCard.displayName = "DashboardCard"

export {
  DashboardCard,
  // re-export standard card parts so dashboards can import from one place
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}

