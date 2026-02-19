import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { cva, type VariantProps } from "class-variance-authority"
import { ChevronDown, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

// ============================================================================
// Sidebar Context
// ============================================================================

interface SidebarContextValue {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const SidebarContext = React.createContext<SidebarContextValue | undefined>(undefined)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within an AppSidebar")
  }
  return context
}

// ============================================================================
// AppSidebar
// ============================================================================

export interface AppSidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultCollapsed?: boolean
  logo?: React.ReactNode
  user?: {
    name: string
    email?: string
    avatar?: string
    role?: string
  }
  footerItems?: SidebarNavItem[]
}

const AppSidebar = React.forwardRef<HTMLDivElement, AppSidebarProps>(
  ({ className, defaultCollapsed = false, logo, user, footerItems, children, ...props }, ref) => {
    const [collapsed, setCollapsed] = React.useState(defaultCollapsed)

    return (
      <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
        <div
          ref={ref}
          className={cn(
            "flex h-full w-64 flex-col border-r border-border bg-card",
            collapsed && "w-16",
            className
          )}
          {...props}
        >
          {logo && (
            <div className="flex h-16 items-center border-b border-border px-4">
              {logo}
            </div>
          )}

          <ScrollArea className="flex-1 px-3 py-4">
            {children}
          </ScrollArea>

          <div className="border-t border-border p-3">
            {footerItems && footerItems.length > 0 && (
              <div className="mb-3 space-y-1">
                {footerItems.map((item, index) => (
                  <SidebarNavLink key={index} {...item} />
                ))}
              </div>
            )}
            
            {user && (
              <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {user.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex-1 truncate">
                    <p className="truncate text-sm font-medium text-foreground">
                      {user.name}
                    </p>
                    {user.role && (
                      <p className="truncate text-xs text-muted-foreground">
                        {user.role}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </SidebarContext.Provider>
    )
  }
)
AppSidebar.displayName = "AppSidebar"

// ============================================================================
// SidebarSection
// ============================================================================

export interface SidebarSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  showAddButton?: boolean
  onAddClick?: () => void
  collapsible?: boolean
  defaultOpen?: boolean
}

const SidebarSection = React.forwardRef<HTMLDivElement, SidebarSectionProps>(
  ({ className, title, showAddButton, onAddClick, collapsible, defaultOpen = true, children, ...props }, ref) => {
    if (collapsible && title) {
      return (
        <Collapsible defaultOpen={defaultOpen} className={cn("mb-4", className)}>
          <div className="flex items-center justify-between px-2 py-1">
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-3 w-3 transition-transform duration-200 [[data-state=closed]_&]:-rotate-90" />
              {title}
            </CollapsibleTrigger>
            {showAddButton && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={onAddClick}
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
          <CollapsibleContent>
            <div ref={ref} className="mt-1 space-y-1" {...props}>
              {children}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )
    }

    return (
      <div ref={ref} className={cn("mb-4", className)} {...props}>
        {title && (
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </span>
            {showAddButton && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={onAddClick}
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
        <div className="mt-1 space-y-1">{children}</div>
      </div>
    )
  }
)
SidebarSection.displayName = "SidebarSection"

// ============================================================================
// SidebarNavLink
// ============================================================================

const sidebarNavItemVariants = cva(
  "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "text-muted-foreground hover:bg-muted hover:text-foreground",
        active: "bg-primary/10 text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const indicatorColors: Record<string, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-info",
  coral: "bg-primary",
  purple: "bg-purple-500",
  cyan: "bg-cyan-500",
}

export interface SidebarNavItem {
  label: string
  href?: string
  icon?: React.ElementType
  badge?: string | number
  indicator?: "primary" | "success" | "warning" | "error" | "info" | "coral" | "purple" | "cyan"
  onClick?: () => void
  children?: SidebarNavItem[]
}

interface SidebarNavLinkProps extends SidebarNavItem, VariantProps<typeof sidebarNavItemVariants> {
  className?: string
}

const SidebarNavLink = React.forwardRef<HTMLAnchorElement, SidebarNavLinkProps>(
  ({ className, label, href, icon: Icon, badge, indicator, onClick, variant }, ref) => {
    const location = useLocation()
    const isActive = href ? location.pathname === href || location.pathname.startsWith(href + "/") : false
    const computedVariant = variant || (isActive ? "active" : "default")

    const content = (
      <>
        {indicator && (
          <span className={cn("h-2 w-2 rounded-full flex-shrink-0", indicatorColors[indicator])} />
        )}
        {Icon && !indicator && (
          <Icon className="h-5 w-5 flex-shrink-0" />
        )}
        <span className="flex-1 truncate">{label}</span>
        {badge !== undefined && (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">
            {badge}
          </span>
        )}
      </>
    )

    if (href) {
      return (
        <Link
          ref={ref}
          to={href}
          onClick={onClick}
          className={cn(sidebarNavItemVariants({ variant: computedVariant }), className)}
        >
          {content}
        </Link>
      )
    }

    return (
      <button
        onClick={onClick}
        className={cn(sidebarNavItemVariants({ variant: computedVariant }), className)}
      >
        {content}
      </button>
    )
  }
)
SidebarNavLink.displayName = "SidebarNavLink"

// ============================================================================
// SidebarNavGroup
// ============================================================================

interface SidebarNavGroupProps extends Omit<SidebarNavItem, 'children'> {
  defaultOpen?: boolean
  children?: SidebarNavItem[]
}

const SidebarNavGroup = React.forwardRef<HTMLDivElement, SidebarNavGroupProps>(
  ({ label, icon: Icon, indicator, children: subItems, defaultOpen = false }, ref) => {
    return (
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger className={cn(sidebarNavItemVariants({ variant: "default" }), "w-full")}>
          {indicator && (
            <span className={cn("h-2 w-2 rounded-full flex-shrink-0", indicatorColors[indicator])} />
          )}
          {Icon && !indicator && (
            <Icon className="h-5 w-5 flex-shrink-0" />
          )}
          <span className="flex-1 truncate text-left">{label}</span>
          <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div ref={ref} className="ml-5 mt-1 space-y-1 border-l border-border pl-3">
            {subItems?.map((item, index) => (
              <SidebarNavLink key={index} {...item} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }
)
SidebarNavGroup.displayName = "SidebarNavGroup"

// ============================================================================
// Exports
// ============================================================================

export {
  AppSidebar,
  SidebarSection,
  SidebarNavLink,
  SidebarNavGroup,
  useSidebar,
  sidebarNavItemVariants,
}
