import { useMemo } from "react"
import { useNavigate } from "react-router-dom"

import { useClockRecords } from "@/hooks/useClockRecords"
import { useShifts, type Shift } from "@/hooks/useShifts"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { WidgetCard } from "@/components/ui/widget-card"
import { cn } from "@/lib/utils"

export interface StaffOnShiftEntry {
  staffId: string
  name: string
  role?: string
  checkInTime?: string
  shiftTime?: string
}

export interface StaffOnShiftCardProps {
  items?: StaffOnShiftEntry[]
  isLoading?: boolean
  className?: string
}

function toIsoDate(d: Date) {
  return d.toISOString().split("T")[0]
}

function formatTime(isoOrTime?: string | null) {
  if (!isoOrTime) return undefined
  // If already a HH:mm string, just return it.
  if (/^\d{2}:\d{2}/.test(isoOrTime)) return isoOrTime.slice(0, 5)
  const dt = new Date(isoOrTime)
  if (Number.isNaN(dt.getTime())) return undefined
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

function buildTodayShiftIndex(shifts: Shift[], todayStr: string) {
  const map = new Map<string, Shift>()
  for (const s of shifts) {
    if (s.shiftDate !== todayStr) continue
    map.set(s.staffId, s)
  }
  return map
}

function buildOnShiftFromClockRecords({
  todayStr,
  clockRecords,
  shifts,
}: {
  todayStr: string
  clockRecords: any[]
  shifts: Shift[]
}): StaffOnShiftEntry[] {
  const shiftIndex = buildTodayShiftIndex(shifts, todayStr)

  // Group by staff id and find last clock type.
  const byStaff = new Map<string, any[]>()
  for (const r of clockRecords) {
    const list = byStaff.get(r.staffId) ?? []
    list.push(r)
    byStaff.set(r.staffId, list)
  }

  const result: StaffOnShiftEntry[] = []
  for (const [staffId, records] of byStaff) {
    // Records are returned descending (hook orders by clock_time desc)
    const last = records[0]
    if (!last || last.clockType !== "in") continue

    const name =
      last.staff?.fullName ||
      shiftIndex.get(staffId)?.staffName ||
      "Unknown"

    const shift = shiftIndex.get(staffId)
    result.push({
      staffId,
      name,
      role: shift?.role,
      checkInTime: formatTime(last.clockTime) ?? formatTime(shift?.clockIn),
      shiftTime:
        shift?.startTime && shift?.endTime
          ? `${shift.startTime}–${shift.endTime}`
          : undefined,
    })
  }

  // Stable sort by role then name
  return result.sort((a, b) => {
    const ar = (a.role ?? "").toLowerCase()
    const br = (b.role ?? "").toLowerCase()
    if (ar !== br) return ar.localeCompare(br)
    return a.name.localeCompare(b.name)
  })
}

export function StaffOnShiftCard({ items, isLoading, className }: StaffOnShiftCardProps) {
  const navigate = useNavigate()

  const todayStr = toIsoDate(new Date())
  const { data: shifts = [], isLoading: shiftsLoading } = useShifts(new Date())
  const { data: clockRecords = [], isLoading: clocksLoading } = useClockRecords(
    todayStr,
    todayStr
  )

  const derived = useMemo(() => {
    if (items) return items
    return buildOnShiftFromClockRecords({
      todayStr,
      clockRecords,
      shifts,
    })
  }, [items, todayStr, clockRecords, shifts])

  const loading = isLoading ?? shiftsLoading ?? clocksLoading

  return (
    <WidgetCard
      className={className}
      title="Staff on shift"
      subtitle="Right now"
      headerAction={
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-muted text-muted-foreground">
            {loading ? "…" : derived.length}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/ops/staffing")}
          >
            View staffing
          </Button>
        </div>
      }
      fillHeight
      contentClassName="min-h-0"
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="min-w-0 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : derived.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No staff currently on shift.
        </div>
      ) : (
        <div className="space-y-3">
          {derived.map((s) => (
            <button
              key={s.staffId}
              type="button"
              onClick={() => navigate("/owner/team-directory")}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-control px-2 py-2 text-left transition-colors",
                "hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {getInitials(s.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {s.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {s.role ? `${s.role}` : "—"}
                    {s.shiftTime ? ` • ${s.shiftTime}` : ""}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {s.checkInTime ? `In ${s.checkInTime}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}

