import { useMemo } from "react"
import { Pencil, Trash2 } from "lucide-react"

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui"
import { cn } from "@/lib/utils"

export type ShiftCardEmployee = {
  id: string
  full_name?: string | null
  email?: string | null
}

export type ShiftCardShift = {
  id: string
  employee: ShiftCardEmployee | null
  start_time: string // HH:mm or HH:mm:ss
  end_time: string // HH:mm or HH:mm:ss
  role: string | null
  status: "scheduled" | "published" | "completed" | "cancelled"
}

function toMinutes(t: string) {
  const [hh, mm] = t.split(":")
  return (Number(hh) || 0) * 60 + (Number(mm) || 0)
}

function normalizeTime(t: string) {
  const parts = t.split(":")
  const hh = String(parts[0] || "00").padStart(2, "0")
  const mm = String(parts[1] || "00").padStart(2, "0")
  return `${hh}:${mm}`
}

function formatTime12h(t: string) {
  const [hh, mm] = normalizeTime(t).split(":")
  const h24 = Number(hh)
  const m = Number(mm)
  const ampm = h24 >= 12 ? "PM" : "AM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`
}

function durationMinutes(start: string, end: string) {
  const s = toMinutes(normalizeTime(start))
  const e = toMinutes(normalizeTime(end))
  return Math.max(0, e - s)
}

function roleBadgeClass(role: string | null) {
  const r = String(role || "").toLowerCase()
  if (r.includes("bar") || r === "bartender") return "bg-purple-600/10 text-purple-700 border-purple-600/20"
  if (r.includes("kitchen")) return "bg-orange-500/10 text-orange-700 border-orange-500/20"
  if (r.includes("cash")) return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
  if (r.includes("manage")) return "bg-slate-500/10 text-slate-700 border-slate-500/20"
  return "bg-blue-500/10 text-blue-700 border-blue-500/20"
}

export function ShiftCard({
  shift,
  onEdit,
  onDelete,
}: {
  shift: ShiftCardShift
  onEdit: (shift: ShiftCardShift) => void
  onDelete: (shift: ShiftCardShift) => void
}) {
  const minutes = useMemo(
    () => durationMinutes(shift.start_time, shift.end_time),
    [shift.start_time, shift.end_time],
  )

  const minHeightPx = useMemo(() => {
    // Visual scaling: 4h ≈ 72px, 8h ≈ 120px (clamped).
    const hours = minutes / 60
    const h = 48 + hours * 9
    return Math.max(56, Math.min(160, Math.round(h)))
  }, [minutes])

  const statusClasses = useMemo(() => {
    switch (shift.status) {
      case "scheduled":
        return "bg-blue-50 border-blue-200"
      case "published":
        return "bg-green-50 border-green-200"
      case "completed":
        return "bg-gray-50 border-gray-200"
      case "cancelled":
        return "bg-red-50 border-red-200"
    }
  }, [shift.status])

  const textMuted = shift.status === "cancelled"

  const timeRange = `${formatTime12h(shift.start_time)} - ${formatTime12h(shift.end_time)}`

  const employeeLabel =
    shift.employee?.full_name || shift.employee?.email || shift.employee?.id || "Unassigned"

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(shift)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onEdit(shift)
      }}
      title={employeeLabel}
      className={cn(
        "group relative w-full cursor-pointer rounded-lg border px-3 py-2 shadow-sm transition-colors",
        statusClasses,
        "hover:shadow-md",
      )}
      style={{ minHeight: `${minHeightPx}px` }}
      aria-label={`Shift ${timeRange}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={cn("truncate text-sm font-semibold text-foreground", textMuted && "line-through")}>
            {timeRange}
          </div>
          {shift.role && (
            <div className="mt-1">
              <Badge
                variant="outline"
                className={cn("text-xs", roleBadgeClass(shift.role), textMuted && "line-through")}
              >
                {shift.role}
              </Badge>
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="invisible h-8 w-8 text-muted-foreground hover:bg-white/60 hover:text-foreground group-hover:visible"
              aria-label="Shift actions"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault()
                onEdit(shift)
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.preventDefault()
                onDelete(shift)
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

