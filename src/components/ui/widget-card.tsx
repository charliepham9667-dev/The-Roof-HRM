import * as React from "react"
import { MoreVertical } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export interface WidgetCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Widget title */
  title: string
  /** Optional icon component */
  icon?: React.ElementType
  /** Optional subtitle/description */
  subtitle?: string
  /** Menu items for the dropdown */
  menuItems?: { label: string; onClick: () => void }[]
  /** Right side header content (alternative to menu) */
  headerAction?: React.ReactNode
  /** Remove padding from content area */
  noPadding?: boolean
  /**
   * If true, makes the card a vertical flex container so the body can
   * stretch and scroll within a fixed height.
   */
  fillHeight?: boolean
  /** Additional classes applied to the content (body) wrapper */
  contentClassName?: string
}

const WidgetCard = React.forwardRef<HTMLDivElement, WidgetCardProps>(
  (
    {
      className,
      title,
      icon: Icon,
      subtitle,
      menuItems,
      headerAction,
      noPadding = false,
      fillHeight = false,
      contentClassName,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-card border border-border bg-card shadow-card",
          fillHeight && "flex flex-col",
          className
        )}
        {...props}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <Icon className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          {headerAction ? (
            headerAction
          ) : menuItems && menuItems.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
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
          ) : null}
        </div>

        {/* Content */}
        <div
          className={cn(
            noPadding ? "" : "p-5",
            fillHeight && "flex-1 min-h-0",
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    )
  }
)
WidgetCard.displayName = "WidgetCard"

// Sub-components for flexible layouts
const WidgetCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center justify-between px-5 py-4", className)}
    {...props}
  />
))
WidgetCardHeader.displayName = "WidgetCardHeader"

const WidgetCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
))
WidgetCardContent.displayName = "WidgetCardContent"

const WidgetCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("border-t border-border px-5 py-3", className)}
    {...props}
  />
))
WidgetCardFooter.displayName = "WidgetCardFooter"

export { WidgetCard, WidgetCardHeader, WidgetCardContent, WidgetCardFooter }
