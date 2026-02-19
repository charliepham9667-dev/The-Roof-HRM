import { useState, useCallback } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DelegationTask, BoardColumnKey, TaskStatus } from "@/types"

// ─── Column config ─────────────────────────────────────────────────────────────

export const COLUMNS: Array<{
  key: BoardColumnKey
  label: string
  color: string
  headerColor: string
  targetStatus: TaskStatus
}> = [
  { key: "not_started",  label: "Not Started", color: "bg-[#6b7280]", headerColor: "text-[#6b7280]", targetStatus: "todo" },
  { key: "in_progress",  label: "In Progress", color: "bg-[#3b82f6]", headerColor: "text-[#3b82f6]", targetStatus: "in_progress" },
  { key: "finish_today", label: "Finish Today", color: "bg-primary",  headerColor: "text-primary",   targetStatus: "in_progress" },
  { key: "done",         label: "Done",         color: "bg-[#10b981]", headerColor: "text-[#10b981]", targetStatus: "done" },
]

// ─── Category colours ──────────────────────────────────────────────────────────

const CAT_BORDER: Record<string, string> = {
  bar:        "border-l-[#8b5cf6]",
  operations: "border-l-[#3b82f6]",
  finance:    "border-l-[#10b981]",
  ordering:   "border-l-[#f59e0b]",
  marketing:  "border-l-[#ec4899]",
  event:      "border-l-[#f97316]",
  general:    "border-l-border",
}
const CAT_BG: Record<string, string> = {
  bar:        "bg-[#8b5cf6]/[0.05]",
  operations: "bg-[#3b82f6]/[0.05]",
  finance:    "bg-[#10b981]/[0.05]",
  ordering:   "bg-[#f59e0b]/[0.05]",
  marketing:  "bg-[#ec4899]/[0.05]",
  event:      "bg-[#f97316]/[0.05]",
  general:    "bg-card",
}
const CAT_TEXT: Record<string, string> = {
  bar:        "text-[#8b5cf6]",
  operations: "text-[#3b82f6]",
  finance:    "text-[#10b981]",
  ordering:   "text-[#f59e0b]",
  marketing:  "text-[#ec4899]",
  event:      "text-[#f97316]",
  general:    "text-muted-foreground",
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-[#ef4444]",
  high:   "bg-[#f97316]",
  medium: "bg-[#f59e0b]",
  low:    "bg-[#6b7280]",
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
}

// ─── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  todayIso,
  myUserId,
  people,
  onClick,
  dragHandleProps,
  isDragOverlay = false,
}: {
  task: DelegationTask
  todayIso: string
  myUserId: string
  people: any[]
  onClick: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  isDragOverlay?: boolean
}) {
  const isDone = task.status === "done"
  const isOverdue = !!(task.dueDate && task.dueDate < todayIso && !isDone)
  const cat = (task.category || "general").toLowerCase()
  const isDelegated = task.assignedTo !== myUserId
  const assignee = isDelegated ? people.find((p) => p.id === task.assignedTo) : null
  const assigneeName = assignee?.full_name || assignee?.email || "?"

  return (
    <div
      className={cn(
        "rounded-sm border border-l-[3px] p-2.5 select-none",
        "transition-shadow",
        isDone ? "border-l-[#10b981] bg-card opacity-55" : CAT_BORDER[cat] ?? CAT_BORDER.general,
        isDone ? "" : CAT_BG[cat] ?? "bg-card",
        isDone ? "border-border/50" : isOverdue ? "border-error/30" : "border-border",
        isDelegated && !isDone && "opacity-90",
        isDragOverlay && "shadow-2xl rotate-[1.5deg] opacity-95 scale-[1.02]",
      )}
    >
      {/* Top row: drag handle + category + badges */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1 min-w-0">
          <div
            {...dragHandleProps}
            className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors -ml-0.5 touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3 w-3" />
          </div>
          <span className={cn("text-[9px] tracking-[1.5px] uppercase font-medium truncate", isDone ? "text-muted-foreground/50" : CAT_TEXT[cat] ?? CAT_TEXT.general)}>
            {cat}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isDone && (
            <span className="text-[9px] tracking-wide text-[#10b981] uppercase">✓ Done</span>
          )}
          {!isDone && isOverdue && (
            <span className="text-[9px] tracking-wide text-error uppercase">Overdue</span>
          )}
          {!isDone && isDelegated && (
            <span className="rounded-sm border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-1 py-0.5 text-[8px] tracking-wide text-[#f59e0b] uppercase">
              Delegated
            </span>
          )}
        </div>
      </div>

      {/* Title — clickable */}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full text-left text-xs font-medium leading-snug mb-2 transition-colors",
          isDone ? "line-through text-muted-foreground/50" : "text-foreground hover:text-primary",
        )}
      >
        {task.title}
      </button>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", PRIORITY_DOT[(task.priority || "low").toLowerCase()] ?? PRIORITY_DOT.low)} />
          <span className="text-[10px] text-muted-foreground capitalize">{task.priority || "low"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {task.dueDate && (
            <span className={cn("text-[10px] tabular-nums", isOverdue ? "text-error" : "text-muted-foreground")}>
              {new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {/* Assignee avatar */}
          {isDelegated ? (
            <span
              title={assigneeName}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#f59e0b]/20 text-[7px] font-bold text-[#f59e0b]"
            >
              {initials(assigneeName)}
            </span>
          ) : (
            <span
              title="You"
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[7px] font-bold text-primary"
            >
              Me
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Draggable wrapper ─────────────────────────────────────────────────────────

function DraggableCard({
  task,
  todayIso,
  myUserId,
  people,
  onOpen,
}: {
  task: DelegationTask
  todayIso: string
  myUserId: string
  people: any[]
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.3 : 1 }}
    >
      <TaskCard
        task={task}
        todayIso={todayIso}
        myUserId={myUserId}
        people={people}
        onClick={onOpen}
        // Pass dnd listeners only to the drag handle, not the whole card
        dragHandleProps={{ ...listeners, ...attributes } as any}
      />
    </div>
  )
}

// ─── Droppable column ──────────────────────────────────────────────────────────

type DoneFilter = "today" | "week" | "month"

const DONE_FILTERS: Array<{ key: DoneFilter; label: string }> = [
  { key: "today", label: "Today" },
  { key: "week",  label: "Week" },
  { key: "month", label: "Month" },
]

function toLocalDateIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function filterDoneTasks(tasks: DelegationTask[], filter: DoneFilter, todayIso: string) {
  const today = new Date(todayIso)
  return tasks.filter((t) => {
    // Only use completedAt — updatedAt is unreliable (changes on every edit)
    const raw = (t as any).completedAt
    // No completedAt → task was marked done before this field was tracked; show only under "month"
    if (!raw) return filter === "month"
    const d = new Date(raw)
    const localIso = toLocalDateIso(d)

    if (filter === "today") {
      return localIso === todayIso
    }
    if (filter === "week") {
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay())
      weekStart.setHours(0, 0, 0, 0)
      return d >= weekStart
    }
    // month — same calendar month
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()
  })
}

function KanbanColumn({
  col,
  tasks,
  todayIso,
  myUserId,
  people,
  isOver,
  doneFilter,
  onDoneFilterChange,
  onOpenTask,
  onNewTask,
}: {
  col: typeof COLUMNS[number]
  tasks: DelegationTask[]
  todayIso: string
  myUserId: string
  people: any[]
  isOver: boolean
  doneFilter: DoneFilter
  onDoneFilterChange: (f: DoneFilter) => void
  onOpenTask: (t: DelegationTask) => void
  onNewTask: () => void
}) {
  const { setNodeRef } = useDroppable({ id: col.key })

  const isDoneCol = col.key === "done"
  const visibleTasks = isDoneCol ? filterDoneTasks(tasks, doneFilter, todayIso) : tasks
  const myCount = visibleTasks.filter((t) => t.assignedTo === myUserId).length
  const delegatedCount = visibleTasks.filter((t) => t.assignedTo !== myUserId).length

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-card border border-border bg-card shadow-card overflow-hidden transition-colors min-h-[260px]",
        isOver && "border-primary/50 ring-1 ring-primary/20 bg-primary/[0.01]",
      )}
    >
      {/* Top colour bar */}
      <div className={cn("h-[3px] w-full shrink-0", col.color)} />

      {/* Header */}
      <div className="flex flex-col gap-1.5 px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <span className={cn("text-[10px] tracking-widest font-semibold uppercase", col.headerColor)}>
            {col.label}
          </span>
          <div className="flex items-center gap-1.5">
            {delegatedCount > 0 && (
              <span className="rounded-sm bg-[#f59e0b]/15 px-1.5 py-0.5 text-[9px] text-[#f59e0b]" title="Delegated to others">
                {delegatedCount} ↗
              </span>
            )}
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {myCount}
            </span>
          </div>
        </div>

        {/* Done filter pills */}
        {isDoneCol && (
          <div className="flex items-center gap-1">
            {DONE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => onDoneFilterChange(f.key)}
                className={cn(
                  "rounded-sm border px-2 py-0.5 text-[9px] tracking-wide uppercase transition-colors",
                  doneFilter === f.key
                    ? "border-[#10b981]/40 bg-[#10b981]/15 text-[#10b981] font-semibold"
                    : "border-border bg-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cards area */}
      <div className="flex flex-col gap-2 p-2.5 flex-1">
        {visibleTasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center rounded-sm border border-dashed border-border/50 min-h-[80px]">
            <span className="text-[10px] text-muted-foreground/30 italic">
              {isDoneCol ? `No tasks done ${doneFilter === "today" ? "today" : doneFilter === "week" ? "this week" : "this month"}` : "Drop here"}
            </span>
          </div>
        ) : (
          visibleTasks.map((t) => (
            <DraggableCard
              key={t.id}
              task={t}
              todayIso={todayIso}
              myUserId={myUserId}
              people={people}
              onOpen={() => onOpenTask(t)}
            />
          ))
        )}
      </div>

      {/* New task button — hide on Done column */}
      {!isDoneCol && (
        <div className="px-2.5 pb-2.5 shrink-0">
          <button
            type="button"
            onClick={onNewTask}
            className="w-full rounded-sm border border-dashed border-border/60 px-2 py-1.5 text-[10px] tracking-wider text-muted-foreground uppercase hover:border-primary/40 hover:text-primary transition-colors text-left"
          >
            + New task
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Board ─────────────────────────────────────────────────────────────────────

export function KanbanBoard({
  grouped,
  todayIso,
  myUserId,
  people,
  onOpenTask,
  onNewTask,
  onMoveTask,
}: {
  grouped: Record<BoardColumnKey, DelegationTask[]>
  todayIso: string
  myUserId: string
  people: any[]
  onOpenTask: (t: DelegationTask) => void
  onNewTask: (col: BoardColumnKey) => void
  onMoveTask: (taskId: string, toColumn: BoardColumnKey) => void
}) {
  const [activeTask, setActiveTask] = useState<DelegationTask | null>(null)
  const [overId, setOverId] = useState<BoardColumnKey | null>(null)
  const [doneFilter, setDoneFilter] = useState<DoneFilter>("today")

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Start drag only after 8px movement — prevents accidental drags on click
      activationConstraint: { distance: 8 },
    }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTask(event.active.data.current?.task ?? null)
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId((event.over?.id as BoardColumnKey) ?? null)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    setOverId(null)
    if (!over) return
    const toCol = over.id as BoardColumnKey
    const taskId = active.id as string
    const fromCol = (Object.keys(grouped) as BoardColumnKey[]).find((k) =>
      grouped[k].some((t) => t.id === taskId),
    )
    if (fromCol !== toCol) {
      onMoveTask(taskId, toCol)
    }
  }, [grouped, onMoveTask])

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-4 gap-2.5">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.key}
            col={col}
            tasks={grouped[col.key] || []}
            todayIso={todayIso}
            myUserId={myUserId}
            people={people}
            isOver={overId === col.key}
            doneFilter={doneFilter}
            onDoneFilterChange={setDoneFilter}
            onOpenTask={onOpenTask}
            onNewTask={() => onNewTask(col.key)}
          />
        ))}
      </div>

      {/* Ghost card following the cursor */}
      <DragOverlay>
        {activeTask ? (
          <div className="w-[220px] pointer-events-none">
            <TaskCard
              task={activeTask}
              todayIso={todayIso}
              myUserId={myUserId}
              people={people}
              onClick={() => {}}
              isDragOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
