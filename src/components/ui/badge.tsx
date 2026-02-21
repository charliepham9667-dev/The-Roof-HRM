import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Shadcn originals (kept for backward compat)
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground border-border",

        // ─── Semantic badge system ───────────────────────────────────────────
        // positive  → success / healthy / delivered / growing / resolved
        positive:
          "border-success/25 bg-success/10 text-success",
        // warning   → needs attention / in-progress / medium priority / flat
        warning:
          "border-warning/25 bg-warning/10 text-warning",
        // danger    → high priority / escalated / overdue / open issue
        danger:
          "border-error/25 bg-error/10 text-error",
        // neutral   → low priority / requested / past / informational
        neutral:
          "border-border bg-secondary text-muted-foreground",
        // brand     → shift type / role / venue labels (OPENING, CLOSING, LOUNGE…)
        brand:
          "border-primary/25 bg-primary/10 text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
