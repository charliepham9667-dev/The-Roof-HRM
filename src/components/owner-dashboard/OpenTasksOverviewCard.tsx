import { useMemo } from "react"
import { useNavigate } from "react-router-dom"

import { useAllDelegationTasks } from "@/hooks/useDelegationTasks"
import type { TaskStatus } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { WidgetCard } from "@/components/ui/widget-card"

function toIsoDate(d: Date) {
  return d.toISOString().split("T")[0]
}

function safeDateStr(d?: string | null) {
  return d ? d.split("T")[0] : null
}

export interface OpenTasksOverviewCardProps {
  className?: string
}

export function OpenTasksOverviewCard({ className }: OpenTasksOverviewCardProps) {
  const navigate = useNavigate()
  const todayStr = toIsoDate(new Date())

  const statusFilter = ["todo", "in_progress", "blocked"] as TaskStatus[]
  const { data: tasks = [], isLoading } = useAllDelegationTasks(statusFilter)

  const stats = useMemo(() => {
    let overdue = 0
    let dueToday = 0
    let upcoming = 0

    for (const t of tasks) {
      const due = safeDateStr((t as any).dueDate)
      if (!due) {
        upcoming++
        continue
      }
      if (due < todayStr) overdue++
      else if (due === todayStr) dueToday++
      else upcoming++
    }

    return { overdue, dueToday, upcoming, total: tasks.length }
  }, [tasks, todayStr])

  return (
    <WidgetCard
      className={className}
      title="Open tasks"
      subtitle="High-level visibility"
      headerAction={
        <Button size="sm" variant="outline" onClick={() => navigate("/owner/tasks")}>
          View Task Board →
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-48" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Overdue</div>
            <Badge variant="destructive">{stats.overdue}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Due today</div>
            <Badge variant="secondary" className="bg-warning/15 text-warning border border-warning/20">
              {stats.dueToday}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Upcoming</div>
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              {stats.upcoming}
            </Badge>
          </div>

          <div className="pt-2 text-xs text-muted-foreground">
            {stats.total} open items across the team.
          </div>
        </div>
      )}
    </WidgetCard>
  )
}

