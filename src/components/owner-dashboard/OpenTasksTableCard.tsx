import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight } from "lucide-react"

import { useMyTasks } from "@/hooks/useDelegationTasks"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { WidgetCard } from "@/components/ui/widget-card"
import { cn } from "@/lib/utils"

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function statusBadge(status: string) {
  if (status === "in_progress") {
    return { label: "In progress", className: "bg-info/15 text-info border border-info/20" }
  }
  if (status === "blocked") {
    return { label: "Blocked", className: "bg-error/15 text-error border border-error/20" }
  }
  // todo
  return { label: "To do", className: "bg-muted text-muted-foreground border border-border" }
}

export function OpenTasksTableCard({ className }: { className?: string }) {
  const navigate = useNavigate()
  const { tasks, isLoading } = useMyTasks()

  const rows = useMemo(() => (tasks || []).slice(0, 5), [tasks])

  return (
    <WidgetCard
      className={className}
      title="Open tasks"
      subtitle="Your current work"
      headerAction={
        <Button size="sm" variant="outline" onClick={() => navigate("/owner/tasks")}>
          See all <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      }
      noPadding
    >
      <div className="overflow-hidden rounded-card">
        <div className="grid grid-cols-[1fr_220px_130px] border-b border-border bg-muted/10 px-5 py-3 text-xs font-semibold text-muted-foreground">
          <div>Task</div>
          <div>Assign</div>
          <div>Status</div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-4 w-[70%]" />
            <Skeleton className="h-4 w-[85%]" />
            <Skeleton className="h-4 w-[65%]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">No open tasks.</div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((t) => {
              const assigneeName = t.assignedToProfile?.fullName || "Unassigned"
              const b = statusBadge(String(t.status))
              return (
                <button
                  key={t.id}
                  type="button"
                  className={cn(
                    "grid w-full grid-cols-[1fr_220px_130px] items-center gap-3 px-5 py-3 text-left",
                    "hover:bg-muted/30"
                  )}
                  onClick={() => navigate("/owner/tasks")}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{t.title}</div>
                    {t.project?.title ? (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{t.project.title}</div>
                    ) : (
                      <div className="mt-0.5 text-xs text-muted-foreground">—</div>
                    )}
                  </div>

                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">{initials(assigneeName)}</AvatarFallback>
                    </Avatar>
                    <div className="truncate text-sm text-foreground">{assigneeName}</div>
                  </div>

                  <div>
                    <Badge variant="outline" className={b.className}>
                      {b.label}
                    </Badge>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </WidgetCard>
  )
}

