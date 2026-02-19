import { useMemo, useState } from "react"
import { Calendar, Flag } from "lucide-react"
import { differenceInCalendarDays, format, formatDistanceToNow, parseISO, startOfToday } from "date-fns"

import type { DelegationTask, TaskStatus } from "@/types"
import { useMyAssignedTasks, useMyCompletedTasks, useMyCreatedTasks } from "@/hooks/useDelegationTasks"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WidgetCard } from "@/components/ui/widget-card"

export interface MyWorkCardProps {
  className?: string
}

type WorkTab = "todo" | "done" | "delegated"

function safeDateStr(d?: string | null) {
  return d ? String(d).split("T")[0] : null
}

function dueLabel(dueStr: string) {
  const due = parseISO(dueStr)
  const diff = differenceInCalendarDays(due, startOfToday())

  if (diff < 0) return { text: "Overdue", className: "text-error" }
  if (diff === 0) return { text: "Today", className: "text-warning" }
  if (diff === 1) return { text: "Tomorrow", className: "text-warning" }
  if (diff <= 7) return { text: `in ${diff} days`, className: "text-muted-foreground" }
  return { text: format(due, "MMM d"), className: "text-muted-foreground" }
}

function sortTasksForBoard(tasks: DelegationTask[]) {
  return [...tasks].sort((a, b) => {
    const ad = safeDateStr((a as any).dueDate)
    const bd = safeDateStr((b as any).dueDate)
    if (!ad && !bd) return 0
    if (!ad) return 1
    if (!bd) return -1
    return ad.localeCompare(bd)
  })
}

function WorkTaskCard({
  task,
  showAssigneeName,
}: {
  task: DelegationTask
  showAssigneeName?: boolean
}) {
  const createdAgo = useMemo(() => {
    try {
      return formatDistanceToNow(parseISO(task.createdAt), { addSuffix: true })
    } catch {
      return ""
    }
  }, [task.createdAt])

  const dueStr = safeDateStr((task as any).dueDate)
  const due = dueStr ? dueLabel(dueStr) : null

  const isFlagged = task.priority === "high" || task.priority === "urgent"

  return (
    <div className="rounded-card border border-border bg-card p-3 shadow-card transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-medium text-foreground">
              {task.title}
            </div>
            {isFlagged && (
              <Flag className="h-3.5 w-3.5 shrink-0 text-warning" />
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {task.project?.title && (
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                {task.project.title}
              </Badge>
            )}
            {task.category && (
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                {task.category}
              </Badge>
            )}
            {showAssigneeName && task.assignedToProfile?.fullName && (
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                {task.assignedToProfile.fullName}
              </Badge>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right text-xs text-muted-foreground">
          {createdAgo && <div>{createdAgo}</div>}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {due ? (
            <span className={due.className}>{due.text}</span>
          ) : (
            <span>Unscheduled</span>
          )}
        </div>
        <div className="text-muted-foreground capitalize">{task.priority}</div>
      </div>
    </div>
  )
}

type BoardColumn = {
  key: TaskStatus
  label: string
  pillClassName?: string
}

function BoardColumn({
  column,
  tasks,
  showAssigneeName,
}: {
  column: BoardColumn
  tasks: DelegationTask[]
  showAssigneeName?: boolean
}) {
  return (
    <div className="min-w-[260px] max-w-[320px] flex-1">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={column.pillClassName ?? "bg-muted text-muted-foreground border border-border"}
          >
            {column.label}
          </Badge>
          <span className="text-xs text-muted-foreground">{tasks.length}</span>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="rounded-control border border-dashed border-border bg-background/40 px-3 py-4 text-sm text-muted-foreground">
            No tasks
          </div>
        ) : (
          tasks.map((t) => (
            <WorkTaskCard key={t.id} task={t} showAssigneeName={showAssigneeName} />
          ))
        )}
      </div>
    </div>
  )
}

export function MyWorkCard({ className }: MyWorkCardProps) {
  const assigned = useMyAssignedTasks()
  const completed = useMyCompletedTasks()
  const created = useMyCreatedTasks()

  const [tab, setTab] = useState<WorkTab>("todo")

  const { tasks, isLoading, isError } = useMemo(() => {
    if (tab === "todo") return { tasks: assigned.data ?? [], isLoading: assigned.isLoading, isError: assigned.isError }
    if (tab === "done") return { tasks: completed.data ?? [], isLoading: completed.isLoading, isError: completed.isError }
    return { tasks: created.data ?? [], isLoading: created.isLoading, isError: created.isError }
  }, [tab, assigned.data, assigned.isLoading, assigned.isError, completed.data, completed.isLoading, completed.isError, created.data, created.isLoading, created.isError])

  const columns = useMemo<BoardColumn[]>(() => {
    if (tab === "done") {
      return [
        { key: "done", label: "Done", pillClassName: "bg-success/10 text-success border border-success/15" },
        { key: "cancelled", label: "Cancelled", pillClassName: "bg-muted text-muted-foreground border border-border" },
      ]
    }
    // todo + delegated
    return [
      { key: "todo", label: "To do", pillClassName: "bg-muted text-muted-foreground border border-border" },
      { key: "in_progress", label: "In progress", pillClassName: "bg-info/10 text-info border border-info/15" },
      { key: "blocked", label: "Blocked", pillClassName: "bg-error/10 text-error border border-error/15" },
      ...(tab === "delegated"
        ? [{ key: "done" as TaskStatus, label: "Done", pillClassName: "bg-success/10 text-success border border-success/15" }]
        : []),
    ]
  }, [tab])

  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, DelegationTask[]>()
    for (const c of columns) map.set(c.key, [])
    for (const t of tasks) {
      const key = t.status as TaskStatus
      if (!map.has(key)) continue
      map.get(key)!.push(t)
    }
    for (const [k, v] of map.entries()) {
      map.set(k, sortTasksForBoard(v))
    }
    return map
  }, [tasks, columns])

  const showAssigneeName = tab === "delegated"

  return (
    <WidgetCard
      className={className}
      title="My Work"
      noPadding
    >
      <div className="px-5 pt-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as WorkTab)}>
          <TabsList variant="underline" className="w-full justify-start">
            <TabsTrigger variant="underline" value="todo">
              To Do
            </TabsTrigger>
            <TabsTrigger variant="underline" value="done">
              Done
            </TabsTrigger>
            <TabsTrigger variant="underline" value="delegated">
              Delegated
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-0">
            <Separator className="mt-2" />

            <div className="py-3">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : isError ? (
                <div className="text-sm text-error">Failed to load tasks.</div>
              ) : (
                <ScrollArea className="w-full pb-1">
                  <div className="flex gap-4 pr-3">
                    {columns.map((col) => (
                      <BoardColumn
                        key={col.key}
                        column={col}
                        tasks={tasksByStatus.get(col.key) ?? []}
                        showAssigneeName={showAssigneeName}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </WidgetCard>
  )
}

