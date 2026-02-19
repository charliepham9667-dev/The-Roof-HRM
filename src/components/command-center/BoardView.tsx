import { useMemo } from "react"
import { Plus } from "lucide-react"

import { Button, ScrollArea } from "@/components/ui"
import { cn } from "@/lib/utils"
import { TaskCard } from "./TaskCard"

interface Task {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  dueDate?: string | null
  assignee?: { id: string; fullName: string } | null
  project?: { id: string; title: string; color: string | null } | null
}

interface BoardViewProps {
  tasks: Task[]
  onAddTask?: (status: string) => void
  onEditTask?: (task: Task) => void
  onDeleteTask?: (taskId: string) => void
  onStatusChange?: (taskId: string, newStatus: string) => void
}

const columns = [
  { id: "todo", title: "To Do", color: "bg-muted" },
  { id: "in_progress", title: "In Progress", color: "bg-info/10" },
  { id: "done", title: "Done", color: "bg-success/10" },
]

export function BoardView({
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onStatusChange,
}: BoardViewProps) {
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    }

    tasks.forEach((task) => {
      const status = task.status === "blocked" ? "in_progress" : task.status
      if (grouped[status]) grouped[status].push(task)
      else grouped.todo.push(task)
    })

    return grouped
  }, [tasks])

  return (
    <div className="flex min-h-[420px] gap-4">
      {columns.map((column) => (
        <div key={column.id} className="flex min-w-[250px] flex-1 flex-col">
          <div
            className={cn(
              "flex items-center justify-between rounded-t-lg px-3 py-2",
              column.color,
            )}
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
              <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground">
                {tasksByStatus[column.id]?.length || 0}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onAddTask?.(column.id)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 rounded-b-lg border border-t-0 border-border bg-muted/30 p-2">
            <div className="space-y-2">
              {tasksByStatus[column.id]?.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={() => onEditTask?.(task)}
                  onDelete={() => onDeleteTask?.(task.id)}
                  onStatusChange={(status) => onStatusChange?.(task.id, status)}
                />
              ))}

              {tasksByStatus[column.id]?.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No tasks
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  )
}

