import { format } from "date-fns"
import { Calendar, MoreHorizontal } from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui"
import { cn } from "@/lib/utils"

interface TaskCardProps {
  task: {
    id: string
    title: string
    description?: string | null
    status: string
    priority: string
    dueDate?: string | null
    assignee?: { id: string; fullName: string } | null
    project?: { id: string; title: string; color: string | null } | null
  }
  onEdit?: () => void
  onDelete?: () => void
  onStatusChange?: (status: string) => void
  isDragging?: boolean
}

const priorityColors: Record<string, string> = {
  urgent: "border-l-error",
  high: "border-l-warning",
  medium: "border-l-info",
  low: "border-l-muted-foreground",
}

export function TaskCard({
  task,
  onEdit,
  onDelete,
  onStatusChange,
  isDragging,
}: TaskCardProps) {
  const initials =
    task.assignee?.fullName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?"

  return (
    <div
      className={cn(
        "cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm",
        "border-l-4",
        priorityColors[task.priority] || priorityColors.medium,
        isDragging && "rotate-2 opacity-50 shadow-lg",
        "transition-shadow hover:shadow-md",
      )}
    >
      {task.project && (
        <div className="mb-2">
          <span className={cn("inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary")}>
            {task.project.title}
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <h4 className="line-clamp-2 flex-1 text-sm font-medium text-foreground">
          {task.title}
        </h4>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange?.("todo")}>
              Move to To Do
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange?.("in_progress")}>
              Move to In Progress
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange?.("done")}>
              Mark Done
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange?.("blocked")}>
              Mark Blocked
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-error">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {task.description}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
        {task.dueDate ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(task.dueDate), "MMM d")}</span>
          </div>
        ) : (
          <div />
        )}

        {task.assignee ? (
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div />
        )}
      </div>
    </div>
  )
}

