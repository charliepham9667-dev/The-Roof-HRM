import * as React from "react"

import { cn } from "@/lib/utils"

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Page title */
  title: string
  /** Optional description */
  description?: string
  /** Right-aligned actions */
  actions?: React.ReactNode
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, description, actions, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
          className
        )}
        {...props}
      >
        <div className="space-y-1">
          <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground sm:text-2xl md:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground md:text-base">
              {description}
            </p>
          )}
        </div>
        
        {actions && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {actions}
          </div>
        )}
      </div>
    )
  }
)
PageHeader.displayName = "PageHeader"

export { PageHeader }
