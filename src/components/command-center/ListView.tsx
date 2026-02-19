import { format } from "date-fns"

import { Avatar, AvatarFallback, Checkbox, StatusBadge } from "@/components/ui"
import { cn } from "@/lib/utils"

interface Task {
  id: string
  title: string
  status: string
  priority: string
  dueDate?: string | null
  assignee?: { id: string; fullName: string } | null
  project?: { id: string; title: string; color: string | null } | null
}

interface ListViewProps {
  tasks: Task[]
  onToggleComplete?: (taskId: string, completed: boolean) => void
  onEditTask?: (task: Task) => void
}

export function ListView({ tasks, onToggleComplete, onEditTask }: ListViewProps) {
  const priorityLabels: Record<string, { label: string; variant: "high" | "medium" | "low" | "default" }> =
    {
      urgent: { label: "Urgent", variant: "high" },
      high: { label: "High", variant: "high" },
      medium: { label: "Medium", variant: "medium" },
      low: { label: "Low", variant: "low" },
    }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-12 gap-4 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
        <div className="col-span-5">Task</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Priority</div>
        <div className="col-span-2">Due Date</div>
        <div className="col-span-1">Assignee</div>
      </div>

      {tasks.map((task) => {
        const isCompleted = task.status === "done"
        const initials =
          task.assignee?.fullName
            ?.split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase() || "?"

        return (
          <div
            key={task.id}
            onClick={() => onEditTask?.(task)}
            className={cn(
              "grid grid-cols-12 items-center gap-4 rounded-lg px-4 py-3",
              "cursor-pointer transition-colors hover:bg-muted/50",
              isCompleted && "opacity-60",
            )}
          >
            <div className="col-span-5 flex items-center gap-3">
              <Checkbox
                checked={isCompleted}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleComplete?.(task.id, !isCompleted)
                }}
              />
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    isCompleted && "line-through text-muted-foreground",
                  )}
                >
                  {task.title}
                </p>
                {task.project && (
                  <p className="truncate text-xs text-primary">{task.project.title}</p>
                )}
              </div>
            </div>

            <div className="col-span-2">
              <StatusBadge
                variant={
                  task.status === "done"
                    ? "success"
                    : task.status === "in_progress"
                      ? "info"
                      : task.status === "blocked"
                        ? "error"
                        : "default"
                }
              >
                {task.status.replace("_", " ")}
              </StatusBadge>
            </div>

            <div className="col-span-2">
              <StatusBadge
                variant={priorityLabels[task.priority]?.variant || "default"}
              >
                {priorityLabels[task.priority]?.label || task.priority}
              </StatusBadge>
            </div>

            <div className="col-span-2 text-sm text-muted-foreground">
              {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "—"}
            </div>

            <div className="col-span-1">
              {task.assignee ? (
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>
        )
      })}

      {tasks.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">No tasks yet</div>
      )}
    </div>
  )
}

