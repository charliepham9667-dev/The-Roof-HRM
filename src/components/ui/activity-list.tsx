import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { MoreVertical } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

const activityDotVariants = cva(
  "h-2 w-2 rounded-full flex-shrink-0",
  {
    variants: {
      color: {
        default: "bg-muted-foreground",
        primary: "bg-primary",
        success: "bg-success",
        warning: "bg-warning",
        error: "bg-error",
        info: "bg-info",
        coral: "bg-primary",
        purple: "bg-purple-500",
        cyan: "bg-cyan-500",
      },
    },
    defaultVariants: {
      color: "default",
    },
  }
)

export interface ActivityItem {
  id: string
  title: string
  subtitle?: string
  color?: VariantProps<typeof activityDotVariants>["color"]
  timestamp?: string
  menuItems?: { label: string; onClick: () => void }[]
  onClick?: () => void
}

export interface ActivityListProps extends React.HTMLAttributes<HTMLDivElement> {
  items: ActivityItem[]
  emptyMessage?: string
}

const ActivityList = React.forwardRef<HTMLDivElement, ActivityListProps>(
  ({ className, items, emptyMessage = "No recent activity", ...props }, ref) => {
    if (items.length === 0) {
      return (
        <div
          ref={ref}
          className={cn("py-8 text-center text-sm text-muted-foreground", className)}
          {...props}
        >
          {emptyMessage}
        </div>
      )
    }

    return (
      <div ref={ref} className={cn("space-y-1", className)} {...props}>
        {items.map((item) => (
          <ActivityListItem
            key={item.id}
            title={item.title}
            subtitle={item.subtitle}
            color={item.color ?? undefined}
            timestamp={item.timestamp}
            menuItems={item.menuItems}
            onClick={item.onClick}
          />
        ))}
      </div>
    )
  }
)
ActivityList.displayName = "ActivityList"

type ActivityListItemProps = Omit<ActivityItem, 'id'> & Omit<React.HTMLAttributes<HTMLDivElement>, 'color' | 'title'> & {
  id?: string
}

const ActivityListItem = React.forwardRef<HTMLDivElement, ActivityListItemProps>(
  ({ className, title, subtitle, color = "default", timestamp, menuItems, ...props }, ref) => {
  const isInteractive = typeof props.onClick === "function"

  return (
    <div
      ref={ref}
      className={cn(
        "group flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50",
        isInteractive && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
        className
      )}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                ;(props.onClick as (() => void) | undefined)?.()
              }
            }
          : undefined
      }
      {...props}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn(activityDotVariants({ color }))} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {timestamp && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {timestamp}
          </span>
        )}
        {menuItems && menuItems.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
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
  )
  }
)
ActivityListItem.displayName = "ActivityListItem"

export { ActivityList, ActivityListItem, activityDotVariants }
