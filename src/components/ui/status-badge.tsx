import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Check, Clock, XCircle, Info, Flag } from "lucide-react"

import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        error: "bg-error/10 text-error",
        info: "bg-info/10 text-info",
        pending: "bg-warning/10 text-warning",
        active: "bg-success/10 text-success",
        inactive: "bg-muted text-muted-foreground",
        high: "bg-error/10 text-error",
        medium: "bg-warning/10 text-warning",
        low: "bg-info/10 text-info",
      },
      size: {
        sm: "text-xs px-2 py-0.5",
        md: "text-xs px-2.5 py-1",
        lg: "text-sm px-3 py-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

const defaultIcons: Record<string, React.ElementType> = {
  success: Check,
  warning: Clock,
  error: XCircle,
  info: Info,
  pending: Clock,
  active: Check,
  inactive: XCircle,
  high: Flag,
  medium: Flag,
  low: Flag,
}

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  /** Show icon */
  showIcon?: boolean
  /** Custom icon */
  icon?: React.ElementType
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, variant, size, showIcon = false, icon, children, ...props }, ref) => {
    const IconComponent = icon || (variant ? defaultIcons[variant] : null)

    return (
      <span
        ref={ref}
        className={cn(statusBadgeVariants({ variant, size }), className)}
        {...props}
      >
        {showIcon && IconComponent && (
          <IconComponent className="h-3 w-3" />
        )}
        {children}
      </span>
    )
  }
)
StatusBadge.displayName = "StatusBadge"

export { StatusBadge, statusBadgeVariants }
