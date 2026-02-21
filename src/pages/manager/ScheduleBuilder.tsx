import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, Plus, Loader2, Pencil } from "lucide-react"
import { toast } from "sonner"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { AddShiftModal } from "@/components/schedule/AddShiftModal"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@/components/ui"

export function ScheduleBuilder() {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [selectedWeek, setSelectedWeek] = useState<Date>(() => new Date())
  const weekStart = useMemo(() => startOfWeekSunday(selectedWeek), [selectedWeek])
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())

  const [employees, setEmployees] = useState<Employee[]>([])
  const [teamQuery, setTeamQuery] = useState("")
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [shiftSchema, setShiftSchema] = useState<"new" | "old">("new")
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [editShift, setEditShift] = useState<Shift | null>(null)
  const [prefill, setPrefill] = useState<{ employee_id: string | "open"; date: string } | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [customDate, setCustomDate] = useState(() => toYmd(new Date()))

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  useEffect(() => {
    // Keep selectedDay within week; prefer today if in this week.
    const ws = toYmd(weekStart)
    const we = toYmd(weekEnd)
    const today = new Date()
    const todayYmd = toYmd(today)

    setSelectedDay((prev) => {
      const prevYmd = toYmd(prev)
      const prevInWeek = prevYmd >= ws && prevYmd <= we
      if (prevInWeek) return prev
      const todayInWeek = todayYmd >= ws && todayYmd <= we
      return todayInWeek ? today : weekStart
    })
  }, [weekStart, weekEnd])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  async function reload(nextWeekStart: Date, silent = false) {
    if (!silent) setLoading(true)
    setError(null)

    const weekStartYmd = toYmd(nextWeekStart)
    const weekEndYmd = toYmd(addDays(nextWeekStart, 6))

    const { data: empData, error: empErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, job_role, department, role")
      .eq("is_active", true)
      .neq("role", "owner")
      .order("full_name")
    if (empErr) throw empErr

    // Try new schema first
    const { data: shiftDataNew, error: shiftErrNew } = await supabase
      .from("shifts")
      .select("id, employee_id, date, start_time, end_time, role, notes, status")
      .gte("date", weekStartYmd)
      .lte("date", weekEndYmd)

    let normalized: Shift[] = []
    if (!shiftErrNew) {
      setShiftSchema("new")
      normalized = (shiftDataNew || []) as Shift[]
    } else {
      setShiftSchema("old")
      const { data: shiftDataOld, error: shiftErrOld } = await supabase
        .from("shifts")
        .select("id, staff_id, shift_date, start_time, end_time, role, notes, status")
        .gte("shift_date", weekStartYmd)
        .lte("shift_date", weekEndYmd)
      if (shiftErrOld) throw shiftErrOld
      normalized = ((shiftDataOld || []) as any[]).map((r) => ({
        id: r.id,
        employee_id: r.staff_id ?? null,
        date: r.shift_date,
        start_time: r.start_time,
        end_time: r.end_time,
        role: r.role ?? null,
        notes: r.notes ?? null,
        status: r.status,
      }))
    }

    // Safety: exclude owners even if upstream query changes.
    setEmployees(((empData || []) as Employee[]).filter((e) => e.role !== "owner"))
    setShifts(normalized)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await reload(weekStart)
      } catch (e) {
        if (cancelled) return
        setError((e as Error)?.message || "Failed to load schedule")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  const shiftsByEmployeeDay = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const s of shifts) {
      const key = `${s.employee_id || "open"}|${s.date}`
      const arr = map.get(key) || []
      arr.push(s)
      map.set(key, arr)
    }
    map.forEach((arr) => arr.sort((a, b) => parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time)))
    return map
  }, [shifts])

  const hoursByEmployee = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of shifts) {
      if (!s.employee_id) continue
      const h = hoursBetween(s.start_time, s.end_time)
      map.set(s.employee_id, (map.get(s.employee_id) || 0) + h)
    }
    return map
  }, [shifts])

  const weekLabel = useMemo(() => formatRangeLong(weekStart), [weekStart])
  const weekRangeShort = useMemo(() => formatRangeShort(weekStart), [weekStart])
  const nextWeekStart = useMemo(() => addDays(weekStart, 7), [weekStart])
  const nextWeekRangeShort = useMemo(() => formatRangeShort(nextWeekStart), [nextWeekStart])
  const isWeekPublished = useMemo(() => !shifts.some((s) => s.status === "scheduled"), [shifts])


  const filteredEmployees = useMemo(() => {
    const q = teamQuery.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((e) => {
      const name = (e.full_name || e.email || "").toLowerCase()
      const dept = (e.department || "").toLowerCase()
      return name.includes(q) || dept.includes(q)
    })
  }, [employees, teamQuery])

  const employeesByDepartment = useMemo(() => {
    const map = new Map<string, Employee[]>()
    for (const e of filteredEmployees) {
      const rawDept = String(e.department || "").trim().toLowerCase()
      // Collapse accountant, marketing-manager, and management roles into one "Management" group
      const isManagement =
        rawDept === "management" ||
        rawDept === "accountant" ||
        (e.role === "manager" && rawDept === "marketing") ||
        (e.job_role || "").toLowerCase().replace(/[_\s]/g, "").includes("floormanager")
      const displayDept = isManagement ? "Management" : String(e.department || "").trim() || "Other"
      const arr = map.get(displayDept) || []
      arr.push(e)
      map.set(displayDept, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const an = a.full_name || a.email || ""
        const bn = b.full_name || b.email || ""
        return an.localeCompare(bn)
      })
    }
    const order = ["Management", "Bar", "Service", "Marketing"]
    const entries = Array.from(map.entries())
    entries.sort(([a], [b]) => {
      const ia = order.indexOf(a)
      const ib = order.indexOf(b)
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
      if (a === "Other") return 1
      if (b === "Other") return -1
      return a.localeCompare(b)
    })
    return entries
  }, [filteredEmployees])


  function openNewShift(opts: { employeeId: string | "open"; date: string }) {
    setEditShift(null)
    setPrefill({ employee_id: opts.employeeId, date: opts.date })
    setAddOpen(true)
  }

  function openEditShift(s: Shift) {
    setPrefill(null)
    setEditShift(s)
    setAddOpen(true)
  }

  const activeShift = useMemo(() => shifts.find((s) => s.id === activeShiftId) || null, [shifts, activeShiftId])

  async function updateShiftPlacement(shiftId: string, nextEmployeeId: string | null, nextDate: string) {
    const updated_at = new Date().toISOString()
    if (shiftSchema === "old" && nextEmployeeId === null) {
      throw new Error("Unassigning shifts requires the new shifts schema (employee_id/date).")
    }

    if (shiftSchema === "new") {
      const { error } = await supabase
        .from("shifts")
        .update({ employee_id: nextEmployeeId, date: nextDate, updated_at } as any)
        .eq("id", shiftId)
      if (error) throw error
      return
    }

    const { error } = await supabase
      .from("shifts")
      .update({ staff_id: nextEmployeeId, shift_date: nextDate, updated_at } as any)
      .eq("id", shiftId)
    if (error) throw error
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveShiftId(String(e.active.id))
  }

  async function handleDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id)
    setActiveShiftId(null)
    const overId = e.over?.id ? String(e.over.id) : null
    if (!overId) return

    const shift = shifts.find((s) => s.id === activeId)
    if (!shift) return

    if (shift.status === "published" || shift.status === "completed") {
      toast.error("You can’t move published or completed shifts.")
      return
    }

    if (!overId.startsWith("cell:")) return
    const [, employeeKey, date] = overId.split(":")
    if (!employeeKey || !date) return

    const nextEmployeeId = employeeKey === "open" ? null : employeeKey
    const nextDate = date
    if (nextEmployeeId === shift.employee_id && nextDate === shift.date) return

    if (nextEmployeeId) {
      const conflicts = shifts.some((s) => {
        if (s.id === shift.id) return false
        if (s.employee_id !== nextEmployeeId) return false
        if (s.date !== nextDate) return false
        if (s.status === "cancelled") return false
        return overlaps(shift.start_time, shift.end_time, s.start_time, s.end_time)
      })
      if (conflicts) toast.warning("Warning: this creates an overlapping shift.")
    }

    try {
      await updateShiftPlacement(shift.id, nextEmployeeId, nextDate)
      toast.success("Shift rescheduled")
      await reload(weekStart, true)
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to reschedule shift")
    }
  }

  const deleteShift = useCallback(async (shift: Shift) => {
    try {
      const { error } = await supabase.from("shifts").delete().eq("id", shift.id)
      if (error) throw error
      toast.success("Shift deleted")
      await reload(weekStart, true)
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to delete shift")
    }
  }, [weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  const duplicateShift = useCallback(async (shift: Shift) => {
    try {
      if (shiftSchema === "new") {
        const { error } = await supabase
          .from("shifts")
          .insert({
            employee_id: shift.employee_id,
            date: shift.date,
            start_time: shift.start_time,
            end_time: shift.end_time,
            role: shift.role,
            notes: shift.notes,
            status: "scheduled",
          } as any)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("shifts")
          .insert({
            staff_id: shift.employee_id,
            shift_date: shift.date,
            start_time: shift.start_time,
            end_time: shift.end_time,
            role: shift.role,
            notes: shift.notes,
            status: "scheduled",
          } as any)
        if (error) throw error
      }
      toast.success("Shift duplicated")
      await reload(weekStart, true)
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to duplicate shift")
    }
  }, [shiftSchema, weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  async function publishWeek() {
    setError(null)
    setPublishing(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error("You must be signed in to publish the schedule.")
      }

      const weekStartYmd = toYmd(weekStart)
      const weekEndYmd = toYmd(addDays(weekStart, 6))

      let updatedRows: Array<{ employee_id: string | null; id: string }> = []

      const updNew = await supabase
        .from("shifts")
        .update({ status: "published", updated_at: new Date().toISOString() } as any)
        .eq("status", "scheduled")
        .gte("date", weekStartYmd)
        .lte("date", weekEndYmd)
        .select("id, employee_id")

      if (!updNew.error) {
        updatedRows = (updNew.data || []) as any
      } else {
        const updOld = await supabase
          .from("shifts")
          .update({ status: "published", updated_at: new Date().toISOString() } as any)
          .eq("status", "scheduled")
          .gte("shift_date", weekStartYmd)
          .lte("shift_date", weekEndYmd)
          .select("id, staff_id")

        if (updOld.error) throw updOld.error
        updatedRows = ((updOld.data || []) as any[]).map((r) => ({ id: r.id, employee_id: r.staff_id ?? null }))
      }

      const employeeIds = unique(updatedRows.map((r) => r.employee_id).filter((x): x is string => !!x))

      // Notifications are best-effort.
      if (employeeIds.length > 0) {
        const notifications = employeeIds.map((user_id) => ({
          user_id,
          title: "Schedule published",
          body: `Your schedule for ${weekLabel} has been published`,
          notification_type: "general",
          created_at: new Date().toISOString(),
        }))
        await supabase.from("notifications").insert(notifications as any)
      }

      toast.success(`Schedule published for ${employeeIds.length} employee${employeeIds.length === 1 ? "" : "s"}`)
      await reload(weekStart, true)
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to publish schedule")
    } finally {
      setPublishing(false)
    }
  }

  async function duplicateToNextWeek() {
    setError(null)
    setDuplicating(true)

    // Source = currently viewed week (already in `shifts` state)
    // Target = next week (Mon–Sun, +7 days ahead) — current week is NEVER touched
    const nextStartYmd = toYmd(nextWeekStart)
    const nextEndYmd = toYmd(addDays(nextWeekStart, 6))

    try {
      // Guard: nothing to copy if this week is empty
      if (shifts.length === 0) {
        toast.warning("No shifts this week — nothing to duplicate.")
        setDuplicating(false)
        return
      }

      // 1) Delete next week's existing shifts (so we get a clean copy)
      if (shiftSchema === "new") {
        const del = await supabase.from("shifts").delete().gte("date", nextStartYmd).lte("date", nextEndYmd)
        if (del.error) throw del.error
      } else {
        const del = await supabase.from("shifts").delete().gte("shift_date", nextStartYmd).lte("shift_date", nextEndYmd)
        if (del.error) throw del.error
      }

      // 2) Build insert payload: each shift date +7 days, status reset to scheduled
      let skippedOpen = 0
      const toInsert = shifts
        .map((s) => {
          if (shiftSchema === "old" && !s.employee_id) {
            skippedOpen++
            return null
          }
          const nextDate = toYmd(addDays(new Date(`${s.date}T00:00:00`), 7))
          return {
            employee_id: s.employee_id,
            date: nextDate,
            start_time: s.start_time,
            end_time: s.end_time,
            role: s.role,
            notes: s.notes,
            status: "scheduled",
          }
        })
        .filter(Boolean) as Array<{
        employee_id: string | null
        date: string
        start_time: string
        end_time: string
        role: string | null
        notes: string | null
        status: "scheduled"
      }>

      if (toInsert.length === 0) {
        toast.warning("No shifts could be copied (all were skipped).")
        setDuplicating(false)
        return
      }

      // 3) Insert into next week
      if (shiftSchema === "new") {
        const chunks = chunk(toInsert, 500)
        for (const c of chunks) {
          const ins = await supabase.from("shifts").insert(c as any)
          if (ins.error) throw ins.error
        }
      } else {
        const payloadOld = toInsert
          .filter((r) => !!r.employee_id)
          .map((r) => ({
            staff_id: r.employee_id!,
            shift_date: r.date,
            start_time: r.start_time,
            end_time: r.end_time,
            role: r.role,
            notes: r.notes,
            status: r.status,
          }))
        const chunks = chunk(payloadOld, 500)
        for (const c of chunks) {
          const ins = await supabase.from("shifts").insert(c as any)
          if (ins.error) throw ins.error
        }
      }

      if (skippedOpen > 0) toast.warning(`Skipped ${skippedOpen} open shift${skippedOpen === 1 ? "" : "s"} (legacy schema).`)

      toast.success(`Duplicated ${toInsert.length} shift${toInsert.length === 1 ? "" : "s"} to next week`)
      setDuplicateOpen(false)
      // Stay on current week — current week is unchanged
      await reload(weekStart, true)
    } catch (e) {
      const msg = (e as Error)?.message || "Failed to duplicate schedule"
      toast.error(msg)
      setError(msg)
    } finally {
      setDuplicating(false)
    }
  }

  // ── Derived stats for header ──────────────────────────────────────────────
  const today = new Date()
  const todayYmd = toYmd(today)

  const onShiftNowCount = useMemo(() => {
    const nowMins = today.getHours() * 60 + today.getMinutes()
    const onNowIds = new Set<string>()
    for (const s of shifts) {
      if (s.date !== todayYmd) continue
      if (!s.employee_id) continue
      if (isShiftActiveNow(s.start_time, s.end_time, nowMins)) onNowIds.add(s.employee_id)
    }
    return onNowIds.size
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts, todayYmd])

  const totalWeekHours = useMemo(
    () => shifts.reduce((sum, s) => sum + hoursBetween(s.start_time, s.end_time), 0),
    [shifts],
  )

  return (
    <div className="space-y-3">
      {/* ── Schedule header bar ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-xl border border-border bg-card px-4 md:px-5 py-3 min-w-0">
        {/* Row 1: title + week nav + stats */}
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <h1 className="text-[28px] font-bold leading-tight text-foreground whitespace-nowrap">Schedule</h1>

          {/* Week nav */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSelectedWeek((d) => addDays(d, -7))}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-sm font-semibold whitespace-nowrap text-center">{weekRangeShort}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSelectedWeek((d) => addDays(d, 7))}
              aria-label="Next week"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              className="h-7 px-3 text-xs font-medium"
              onClick={() => setSelectedWeek(new Date())}
            >
              Today
            </Button>
          </div>

          {/* Stats pills — wrap naturally */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-[11.5px] font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              {onShiftNowCount} on shift now
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11.5px] text-muted-foreground">
              {totalWeekHours.toFixed(0)}h scheduled this week
            </div>
          </div>
        </div>

        {/* Row 2 (mobile) / Right side (desktop): actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isDesktop && (
            <Input
              value={teamQuery}
              onChange={(e) => setTeamQuery(e.target.value)}
              placeholder="Search team…"
              className="h-8 w-[180px] text-xs"
            />
          )}
          {/* On mobile, hide "Duplicate week" text — show icon only */}
          <Button
            variant="outline"
            size="sm"
            disabled={loading || duplicating}
            onClick={() => setDuplicateOpen(true)}
            className="text-xs"
          >
            {duplicating ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Duplicating…</> : <><span className="hidden sm:inline">Duplicate week</span><span className="sm:hidden">Duplicate</span></>}
          </Button>
          <Button
            size="sm"
            className={cn(
              "text-xs",
              isWeekPublished
                ? "bg-emerald-600 text-white hover:bg-emerald-600"
                : "bg-blue-600 text-white hover:bg-blue-700",
            )}
            disabled={publishing || isWeekPublished}
            onClick={publishWeek}
          >
            {publishing ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Publishing…</> : isWeekPublished ? "Published ✓" : "Publish"}
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => openNewShift({ employeeId: "open", date: toYmd(weekStart) })}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add Shift</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Body */}
      {isDesktop ? (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-auto">
              <div className="min-w-[1100px]">

                {/* ── Column headers ── */}
                <div className="grid grid-cols-[220px_repeat(7,minmax(110px,1fr))] border-b-2 border-border bg-muted/10 sticky top-0 z-30">
                  <div className="px-4 py-3 border-r border-border">
                    <div className="text-[10px] font-semibold uppercase tracking-[.09em] text-muted-foreground">
                      Team Member
                    </div>
                  </div>
                  {days.map((d) => {
                    const ymd = toYmd(d)
                    const isToday = ymd === todayYmd
                    const staffCount = [...new Set(
                      shifts.filter((s) => s.date === ymd && s.status !== "cancelled" && s.employee_id)
                        .map((s) => s.employee_id)
                    )].length
                    const dayHrs = shifts
                      .filter((s) => s.date === ymd && s.status !== "cancelled")
                      .reduce((sum, s) => sum + hoursBetween(s.start_time, s.end_time), 0)
                    const badgeVariant = staffCount >= 6
                      ? "positive"
                      : staffCount >= 3
                        ? "warning"
                        : staffCount === 0
                          ? "neutral"
                          : "danger"
                    return (
                      <div
                        key={ymd}
                        className={cn(
                          "px-2.5 py-2.5 border-l border-border text-center",
                          isToday ? "bg-amber-50/60" : "bg-muted/5",
                        )}
                      >
                        <div className={cn("text-[11px] font-semibold uppercase tracking-[.07em]", isToday ? "text-amber-600" : "text-muted-foreground")}>
                          {d.toLocaleDateString(undefined, { weekday: "short" })},{" "}
                          {d.toLocaleDateString(undefined, { month: "short" })} {d.getDate()}
                        </div>
                        <Badge variant={badgeVariant as "positive" | "warning" | "neutral" | "danger"} className="mt-1">
                          {staffCount === 0 ? "No shifts" : `${staffCount} staff`}
                        </Badge>
                        {dayHrs > 0 && (
                          <div className="mt-0.5 text-[10px] text-muted-foreground font-mono">{dayHrs.toFixed(1)}h total</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* ── Open shifts row ── */}
                <div className="grid grid-cols-[220px_repeat(7,minmax(110px,1fr))] border-b border-border bg-amber-50/20">
                  <div className="px-4 py-3 border-r border-border flex items-center gap-2.5">
                    <svg className="h-3.5 w-3.5 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <div>
                      <div className="text-xs font-semibold text-foreground">Open Shifts</div>
                      <div className="text-[10.5px] text-muted-foreground">Unassigned</div>
                    </div>
                  </div>
                  {days.map((d) => {
                    const ymd = toYmd(d)
                    const isToday = ymd === todayYmd
                    const isFuture = ymd >= todayYmd
                    const cell = shiftsByEmployeeDay.get(`open|${ymd}`) || []
                    const assignedCount = [...new Set(
                      shifts.filter((s) => s.date === ymd && s.status !== "cancelled" && s.employee_id)
                        .map((s) => s.employee_id)
                    )].length
                    const showAssignPrompt = isFuture && assignedCount < 3 && cell.length === 0
                    return (
                      <DroppableCell key={ymd} id={`cell:open:${ymd}`}>
                        <div className={cn("min-h-[58px] border-l border-border px-2 py-2", isToday && "bg-amber-50/40")}>
                          <div className="space-y-1.5">
                            {cell.map((s) => (
                              <DraggableShift key={s.id} shift={s} onEdit={openEditShift} onDuplicate={duplicateShift} onDelete={deleteShift} dept="open" />
                            ))}
                            {showAssignPrompt ? (
                              <button
                                type="button"
                                onClick={() => openNewShift({ employeeId: "open", date: ymd })}
                                className="w-full rounded-md border border-dashed border-amber-300 bg-amber-50 px-2 py-1.5 text-left transition-colors hover:border-amber-400 hover:bg-amber-100/60"
                              >
                                <div className="text-[10.5px] font-semibold text-amber-700">+ Assign Staff</div>
                                <div className="text-[9.5px] text-muted-foreground">{3 - assignedCount} slot{3 - assignedCount !== 1 ? "s" : ""} open</div>
                              </button>
                            ) : cell.length === 0 ? (
                              <AddCellButton onClick={() => openNewShift({ employeeId: "open", date: ymd })} />
                            ) : null}
                          </div>
                        </div>
                      </DroppableCell>
                    )
                  })}
                </div>

                {/* ── Employee rows by department ── */}
                {loading ? (
                  <div className="p-8 text-sm text-muted-foreground">Loading schedule…</div>
                ) : (
                  <>
                    {employeesByDepartment.map(([dept, list]) => {
                      const deptTheme = DEPT_THEME[dept.toLowerCase()] || DEPT_THEME.other
                      return (
                        <div key={dept}>
                          {/* Department header */}
                          <div className="grid grid-cols-[220px_repeat(7,minmax(110px,1fr))] border-b border-border" style={{ background: deptTheme.sectionBg }}>
                            <div className="px-4 py-2 border-r border-border flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: deptTheme.accent }} />
                              <span className="text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: deptTheme.accent }}>{dept}</span>
                              <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold" style={{ background: deptTheme.badgeBg, color: deptTheme.accent }}>{list.length}</span>
                            </div>
                            {days.map((d) => {
                              const ymd = toYmd(d)
                              const isToday = ymd === todayYmd
                              return (
                                <div key={ymd} className={cn("border-l border-border", isToday && "bg-amber-50/30")} />
                              )
                            })}
                          </div>

                          {/* Staff rows */}
                          {list.map((e) => {
                            const name = e.full_name || e.email || "Employee"
                            const weekHrs = hoursByEmployee.get(e.id) || 0
                            const maxHrs = 40
                            const hrsPct = Math.min(100, Math.round((weekHrs / maxHrs) * 100))
                            const hrsBarColor = hrsPct > 90 ? "#8B3030" : hrsPct > 70 ? "#2E7D52" : "#B8922A"
                            const nowMins = today.getHours() * 60 + today.getMinutes()
                            const isOnNow = shifts.some((s) => {
                              if (s.date !== todayYmd || s.employee_id !== e.id) return false
                              return isShiftActiveNow(s.start_time, s.end_time, nowMins)
                            })
                            return (
                              <div
                                key={e.id}
                                className="grid grid-cols-[220px_repeat(7,minmax(110px,1fr))] border-b border-border last:border-b-0 bg-white hover:bg-muted/20 transition-colors"
                              >
                                {/* Name cell with dept left border */}
                                <div
                                  className="flex items-center gap-2.5 px-3 py-2.5 border-r border-border bg-white"
                                  style={{ borderLeft: `3px solid ${deptTheme.accent}` }}
                                >
                                  {/* Avatar with optional on-now ring */}
                                  <div className="relative shrink-0">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={e.avatar_url || undefined} alt={name} />
                                      <AvatarFallback className="text-[10px] font-bold">{initials(name)}</AvatarFallback>
                                    </Avatar>
                                    {isOnNow && (
                                      <span
                                        className="absolute -inset-0.5 rounded-full border-2 border-emerald-500 animate-ping opacity-75"
                                        style={{ animationDuration: "2s" }}
                                      />
                                    )}
                                    {isOnNow && (
                                      <span className="absolute -inset-0.5 rounded-full border-2 border-emerald-500" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-[12.5px] font-semibold">{name}</div>
                                    <div className="text-[10px] text-muted-foreground truncate">{e.job_role || e.department || ""}</div>
                                    {/* Hours bar */}
                                    <div className="mt-1.5">
                                      <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-[9.5px] font-mono" style={{ color: hrsBarColor }}>{weekHrs.toFixed(1)}h</span>
                                        <span className="text-[9.5px] font-mono text-muted-foreground">/ {maxHrs}h</span>
                                      </div>
                                      <div className="h-[3px] rounded-full bg-border overflow-hidden">
                                        <div
                                          className="h-full rounded-full transition-all"
                                          style={{ width: `${hrsPct}%`, background: hrsBarColor }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Day cells */}
                                {days.map((d) => {
                                  const ymd = toYmd(d)
                                  const isToday = ymd === todayYmd
                                  const cell = shiftsByEmployeeDay.get(`${e.id}|${ymd}`) || []
                                  return (
                                    <DroppableCell key={`${e.id}|${ymd}`} id={`cell:${e.id}:${ymd}`}>
                                      <div
                                        className={cn(
                                          "min-h-[72px] border-l border-border px-2 py-2",
                                          isToday && "bg-amber-50/30",
                                        )}
                                      >
                                        <div className="space-y-1.5">
                                          {cell.map((s) => (
                                            <DraggableShift key={s.id} shift={s} onEdit={openEditShift} onDuplicate={duplicateShift} onDelete={deleteShift} dept={dept.toLowerCase()} isToday={isToday} />
                                          ))}
                                          {cell.length === 0 && (
                                            <AddCellButton onClick={() => openNewShift({ employeeId: e.id, date: ymd })} />
                                          )}
                                        </div>
                                      </div>
                                    </DroppableCell>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </>
                )}

                {/* ── Coverage footer ── */}
                {!loading && (
                  <div className="grid grid-cols-[220px_repeat(7,minmax(110px,1fr))] border-t-2 border-border bg-muted/10">
                    <div className="px-4 py-2.5 border-r border-border flex items-end">
                      <span className="text-[10px] font-semibold uppercase tracking-[.09em] text-muted-foreground">Daily Coverage</span>
                    </div>
                    {days.map((d) => {
                      const ymd = toYmd(d)
                      const isToday = ymd === todayYmd
                      const staffCount = [...new Set(
                        shifts.filter((s) => s.date === ymd && s.status !== "cancelled" && s.employee_id)
                          .map((s) => s.employee_id)
                      )].length
                      const dayHrs = shifts
                        .filter((s) => s.date === ymd && s.status !== "cancelled")
                        .reduce((sum, s) => sum + hoursBetween(s.start_time, s.end_time), 0)
                      const pct = Math.min(100, Math.round((staffCount / 8) * 100))
                      const barColor = staffCount >= 6 ? "#2E7D52" : staffCount >= 3 ? "#B8922A" : "#8B3030"
                      const textColor = staffCount >= 6 ? "text-emerald-700" : staffCount >= 3 ? "text-amber-700" : "text-red-700"
                      return (
                        <div key={ymd} className={cn("border-l border-border px-2.5 py-2 text-center", isToday && "bg-amber-50/40")}>
                          <div className="h-1 w-full rounded-full bg-border mb-1.5 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                          <div className={cn("text-[11px] font-semibold font-mono", textColor)}>{staffCount} staff</div>
                          <div className="text-[9.5px] text-muted-foreground">{dayHrs.toFixed(0)}h total</div>
                        </div>
                      )
                    })}
                  </div>
                )}

              </div>
            </div>
          </div>

          <DragOverlay>
            {activeShift ? (
              <div className="pointer-events-none w-[200px] opacity-90">
                <ShiftCardInline shift={activeShift} isGhost dept="open" />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <MobileDayList
          weekStart={weekStart}
          weekEnd={weekEnd}
          selectedDay={selectedDay}
          employees={employees}
          shifts={shifts}
          loading={loading}
          onRefresh={async () => {
            try {
              await reload(weekStart)
              toast.success("Schedule refreshed")
            } catch (e) {
              toast.error((e as Error)?.message || "Failed to refresh schedule")
            }
          }}
          onAddShift={() => openNewShift({ employeeId: "open", date: toYmd(selectedDay) })}
          onEditShift={(s) => openEditShift(s)}
          onSwipePrev={() => {
            const next = addDays(selectedDay, -1)
            if (toYmd(next) < toYmd(weekStart)) {
              const prevWeekStart = addDays(weekStart, -7)
              setSelectedWeek(prevWeekStart)
              setSelectedDay(addDays(prevWeekStart, 6))
            } else {
              setSelectedDay(next)
            }
          }}
          onSwipeNext={() => {
            const next = addDays(selectedDay, 1)
            if (toYmd(next) > toYmd(weekEnd)) {
              const nextWeekStart = addDays(weekStart, 7)
              setSelectedWeek(nextWeekStart)
              setSelectedDay(nextWeekStart)
            } else {
              setSelectedDay(next)
            }
          }}
        />
      )}

      {isDesktop && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          The team roster shown for scheduling is not linked to your business opening hours. To set up opening hours,
          click{" "}
          <button
            type="button"
            className="font-semibold text-blue-600 hover:underline"
            onClick={() => toast.message("Coming soon: opening hours setup")}
          >
            here
          </button>
          .
        </div>
      )}

      <AddShiftModal
        open={addOpen}
        onOpenChange={setAddOpen}
        employees={employees.map((e) => ({ id: e.id, full_name: e.full_name, email: e.email }))}
        existingShifts={shifts}
        prefill={prefill || undefined}
        editShift={editShift}
        shiftSchema={shiftSchema}
        supabase={supabase as any}
        onSuccess={() => reload(weekStart, true).catch((e) => setError((e as Error)?.message || "Failed to refresh schedule"))}
        onDelete={async (id) => {
          const shift = shifts.find((s) => s.id === id)
          if (shift) await deleteShift(shift)
        }}
      />

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pick a week</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">We’ll jump to the week containing this date.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCustomOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const d = new Date(customDate)
                  if (!Number.isNaN(d.getTime())) setSelectedWeek(d)
                  setCustomOpen(false)
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate week to next week</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 text-sm">
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-xs font-semibold text-muted-foreground">Source (this week — unchanged)</div>
              <div className="mt-1 font-medium">{weekRangeShort}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-xs font-semibold text-muted-foreground">Target (next week)</div>
              <div className="mt-1 font-medium">{nextWeekRangeShort}</div>
            </div>
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-foreground">
              This will replace any existing shifts in next week. This week will not be affected.
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDuplicateOpen(false)} disabled={duplicating}>
                Cancel
              </Button>
              <Button
                className="bg-slate-900 text-white hover:bg-slate-900/90"
                onClick={() => void duplicateToNextWeek()}
                disabled={duplicating}
              >
                {duplicating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Duplicating…
                  </>
                ) : (
                  "Duplicate to next week"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

type Employee = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  job_role: string | null
  department: string | null
  role: "owner" | "manager" | "staff" | null
}

type ShiftStatus = "scheduled" | "published" | "completed" | "cancelled" | "in_progress" | "no_show"

type Shift = {
  id: string
  employee_id: string | null
  date: string
  start_time: string
  end_time: string
  role: string | null
  notes: string | null
  status: ShiftStatus
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const m = window.matchMedia(query)
    const onChange = () => setMatches(m.matches)
    onChange()
    m.addEventListener?.("change", onChange)
    return () => m.removeEventListener?.("change", onChange)
  }, [query])
  return matches
}

function toYmd(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function startOfWeekSunday(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay() // 0=Sun,1=Mon,...,6=Sat
  // Shift to Monday-start: Sun(0)→-6, Mon(1)→0, Tue(2)→-1, ..., Sat(6)→-5
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

function addDays(d: Date, days: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

function formatRangeLong(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  return `${fmt(weekStart)} - ${fmt(weekEnd)}`
}


function formatRangeShort(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6)
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`
}


function unique<T>(arr: T[]) {
  return Array.from(new Set(arr))
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function parseTimeToMinutes(t: string) {
  const parts = t.split(":").map((p) => Number(p))
  const hh = parts[0] || 0
  const mm = parts[1] || 0
  return hh * 60 + mm
}

// Returns true if the current time falls within a shift's hours.
// Supports post-midnight end times stored as "25:30" (=01:30 next day).
function isShiftActiveNow(startTime: string, endTime: string, nowMins: number): boolean {
  const s = parseTimeToMinutes(startTime)
  let e = parseTimeToMinutes(endTime)
  // Stored as post-midnight value (e.g. 25:30 = 1530 mins)
  if (e > 24 * 60) {
    // nowMins is always 0–1439; shift spans midnight so check both sides
    return nowMins >= s || nowMins <= e - 24 * 60
  }
  // Normal overnight stored as e.g. start=22:00 end=02:00 (e < s)
  if (e < s) return nowMins >= s || nowMins <= e
  return nowMins >= s && nowMins <= e
}

function hoursBetween(start: string, end: string) {
  const s = parseTimeToMinutes(start)
  let e = parseTimeToMinutes(end)
  // If end <= start and end looks like a normal clock time (<= 23:59),
  // treat as overnight (e.g. start=22:00 end=02:00 → add 24h)
  if (e <= s && e < 24 * 60) e += 24 * 60
  return Math.max(0, e - s) / 60
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const as = parseTimeToMinutes(aStart)
  let ae = parseTimeToMinutes(aEnd)
  const bs = parseTimeToMinutes(bStart)
  let be = parseTimeToMinutes(bEnd)
  if (ae <= as && ae < 24 * 60) ae += 24 * 60
  if (be <= bs && be < 24 * 60) be += 24 * 60
  return as < be && ae > bs
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}


// ── Department theme map ───────────────────────────────────────────────────────
const DEPT_THEME: Record<string, { accent: string; sectionBg: string; badgeBg: string; pillBg: string; pillBorder: string }> = {
  bar:       { accent: '#1565C0', sectionBg: 'rgba(227,240,255,0.4)', badgeBg: '#E3F0FF', pillBg: '#EBF3FF', pillBorder: '#90B8E8' },
  service:   { accent: '#2E7D52', sectionBg: 'rgba(230,244,236,0.4)', badgeBg: '#E6F4EC', pillBg: '#EBF7EF', pillBorder: '#90CBA8' },
  marketing: { accent: '#7B3F00', sectionBg: 'rgba(254,240,227,0.4)', badgeBg: '#FEF0E3', pillBg: '#FEF3EA', pillBorder: '#E8B888' },
  management:{ accent: '#8B3030', sectionBg: 'rgba(250,232,232,0.4)', badgeBg: '#FAE8E8', pillBg: '#FAEAEA', pillBorder: '#D8A0A0' },
  accountant:{ accent: '#5C4080', sectionBg: 'rgba(240,234,250,0.4)', badgeBg: '#F0EAFA', pillBg: '#F3EEFB', pillBorder: '#C0A0D8' },
  other:     { accent: '#6B7280', sectionBg: 'rgba(243,244,246,0.4)', badgeBg: '#F3F4F6', pillBg: '#F9FAFB', pillBorder: '#D1D5DB' },
}

function DroppableCell({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cn(isOver && "bg-amber-50/50")}>
      {children}
    </div>
  )
}

function DraggableShift({ shift, onEdit, onDuplicate, onDelete, dept, isToday }: { shift: Shift; onEdit?: (s: Shift) => void; onDuplicate?: (s: Shift) => void; onDelete?: (s: Shift) => void; dept?: string; isToday?: boolean }) {
  const disabled = shift.status === "published" || shift.status === "completed"
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: shift.id,
    disabled,
  })
  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.35 : 1,
  } as React.CSSProperties

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (disabled) return
        if (isDragging) return
        onEdit?.(shift)
      }}
      onPointerDownCapture={(e) => {
        if (disabled) {
          e.preventDefault()
          e.stopPropagation()
          toast.error("You can’t move published or completed shifts.")
        }
      }}
    >
      <ShiftCardInline shift={shift} onEdit={() => onEdit?.(shift)} onDuplicate={onDuplicate ? () => onDuplicate(shift) : undefined} onDelete={onDelete ? () => onDelete(shift) : undefined} dept={dept} isToday={isToday} />
    </div>
  )
}

function AddCellButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-center rounded-md py-2.5 transition-colors",
        "text-transparent border border-transparent",
        "hover:border-dashed hover:border-border hover:text-muted-foreground hover:bg-muted/30",
      )}
      aria-label="Add shift"
      type="button"
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  )
}

function formatTimeRange(start: string, end: string) {
  const fmt = (t: string) => {
    const [hStr, mStr] = t.split(":")
    const h = Number(hStr)
    const m = Number(mStr)
    const ampm = h >= 12 ? "pm" : "am"
    const h12 = h % 12 === 0 ? 12 : h % 12
    return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`
  }
  return `${fmt(start)} - ${fmt(end)}`
}

function ShiftCardInline({ shift, isGhost, onEdit, onDuplicate, onDelete, dept, isToday }: { shift: Shift; isGhost?: boolean; onEdit?: () => void; onDuplicate?: () => void; onDelete?: () => void; dept?: string; isToday?: boolean }) {
  const theme = DEPT_THEME[dept?.toLowerCase() || ""] || DEPT_THEME.other
  const isCancelled = shift.status === "cancelled"

  // Determine if this shift is happening right now
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const onNow = isToday && !isCancelled && isShiftActiveNow(shift.start_time, shift.end_time, nowMins)

  const durationHrs = hoursBetween(shift.start_time, shift.end_time).toFixed(1)
  // Trim HH:mm:ss → HH:mm for display
  const fmtHHmm = (t: string) => t.slice(0, 5)
  const startDisplay = fmtHHmm(shift.start_time)
  const endRaw = fmtHHmm(shift.end_time)
  const endDisplay = endRaw === "23:59" ? "Close" : endRaw

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isGhost) return
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  const closeCtx = () => setCtxMenu(null)

  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        className={cn(
          "group relative rounded-md overflow-hidden cursor-pointer transition-all hover:-translate-y-px hover:shadow-md",
          isCancelled && "opacity-60 line-through",
          isGhost && "shadow-lg",
        )}
        style={{
          background: isCancelled ? "var(--muted)" : theme.pillBg,
          border: `1px solid ${isCancelled ? "var(--border)" : theme.pillBorder}`,
          borderLeft: `3px solid ${isCancelled ? "var(--border)" : theme.accent}`,
        }}
      >
        <div className="px-2.5 py-1.5">
          <div className="text-[11px] font-semibold text-foreground whitespace-nowrap">
            {startDisplay} – {endDisplay}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {durationHrs}h{shift.role ? ` · ${shift.role}` : ""}
          </div>
          {onNow && (
            <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              On shift now
            </div>
          )}
        </div>

        {!isGhost && onEdit && (
          <button
            type="button"
            className="invisible absolute right-1.5 top-1.5 rounded p-0.5 text-muted-foreground/60 hover:text-foreground hover:bg-white/60 group-hover:visible transition-colors"
            aria-label="Edit shift"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onEdit()
            }}
          >
            <Pencil className="h-2.5 w-2.5" />
          </button>
        )}
      </div>

      {ctxMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onMouseDown={closeCtx} onContextMenu={(e) => { e.preventDefault(); closeCtx() }} />
          <div
            className="fixed z-[9999] min-w-[140px] overflow-hidden rounded-lg border border-border bg-card shadow-xl"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
          >
            {onDuplicate && (
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/60 transition-colors"
                onMouseDown={(e) => { e.stopPropagation(); onDuplicate(); closeCtx() }}
              >
                <svg className="h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Duplicate
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/60 transition-colors"
                onMouseDown={(e) => { e.stopPropagation(); onEdit(); closeCtx() }}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                Edit
              </button>
            )}
            {onDelete && (
              <>
                <div className="mx-2 my-1 border-t border-border" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  onMouseDown={(e) => { e.stopPropagation(); onDelete(); closeCtx() }}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  Delete
                </button>
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  )
}

function MobileDayList({
  weekStart,
  weekEnd,
  selectedDay,
  employees,
  shifts,
  loading,
  onRefresh,
  onAddShift,
  onEditShift,
  onSwipePrev,
  onSwipeNext,
}: {
  weekStart: Date
  weekEnd: Date
  selectedDay: Date
  employees: Employee[]
  shifts: Shift[]
  loading: boolean
  onRefresh: () => Promise<void>
  onAddShift: () => void
  onEditShift: (s: Shift) => void
  onSwipePrev: () => void
  onSwipeNext: () => void
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [pullStartY, setPullStartY] = useState<number | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [swipeStart, setSwipeStart] = useState<{ x: number; y: number } | null>(null)

  const selectedYmd = useMemo(() => toYmd(selectedDay), [selectedDay])
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])

  const dayShifts = useMemo(() => {
    return shifts
      .filter((s) => s.date === selectedYmd)
      .slice()
      .sort((a, b) => parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time))
  }, [shifts, selectedYmd])

  const groups = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const s of dayShifts) {
      const key = s.employee_id || "open"
      const arr = map.get(key) || []
      arr.push(s)
      map.set(key, arr)
    }
    return map
  }, [dayShifts])

  const groupKeys = useMemo(() => {
    const keys = Array.from(groups.keys())
    keys.sort((a, b) => {
      if (a === "open") return -1
      if (b === "open") return 1
      const adept = (employeeById.get(a)?.department || "").toLowerCase()
      const bdept = (employeeById.get(b)?.department || "").toLowerCase()
      if (adept && bdept && adept !== bdept) return adept.localeCompare(bdept)
      const an = employeeById.get(a)?.full_name || employeeById.get(a)?.email || a
      const bn = employeeById.get(b)?.full_name || employeeById.get(b)?.email || b
      return an.localeCompare(bn)
    })
    return keys
  }, [groups, employeeById])

  function formatMobileDate(d: Date) {
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
  }

  async function triggerRefresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
      setPullStartY(null)
      setPullDistance(0)
    }
  }

  return (
    <div className="relative">
      <div
        className="mb-3 rounded-xl border border-border bg-card p-3 shadow-card"
        onTouchStart={(e) => {
          const t = e.touches[0]
          if (!t) return
          setSwipeStart({ x: t.clientX, y: t.clientY })
        }}
        onTouchEnd={(e) => {
          const start = swipeStart
          setSwipeStart(null)
          const t = e.changedTouches[0]
          if (!start || !t) return
          const dx = t.clientX - start.x
          const dy = t.clientY - start.y
          if (Math.abs(dx) < 50) return
          if (Math.abs(dx) < Math.abs(dy)) return
          if (dx < 0) onSwipeNext()
          else onSwipePrev()
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="icon" onClick={onSwipePrev} aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 text-center">
            <div className="truncate text-sm font-semibold">{formatMobileDate(selectedDay)}</div>
            <div className="text-xs text-muted-foreground">
              Week of {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              {" – "}
              {weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={onSwipeNext} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative max-h-[calc(100vh-15rem)] overflow-auto rounded-xl border border-border bg-card shadow-card"
        onTouchStart={(e) => {
          const el = scrollRef.current
          if (!el) return
          if (el.scrollTop > 0) return
          const t = e.touches[0]
          if (!t) return
          setPullStartY(t.clientY)
          setPullDistance(0)
        }}
        onTouchMove={(e) => {
          const startY = pullStartY
          const el = scrollRef.current
          if (startY == null || !el) return
          if (el.scrollTop > 0) return
          const t = e.touches[0]
          if (!t) return
          const dy = t.clientY - startY
          if (dy <= 0) return
          setPullDistance(Math.min(120, dy))
        }}
        onTouchEnd={async () => {
          if (pullDistance >= 80) await triggerRefresh()
          else {
            setPullStartY(null)
            setPullDistance(0)
          }
        }}
      >
        <div className="flex items-center justify-center text-xs text-muted-foreground" style={{ height: pullDistance }}>
          {refreshing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Refreshing…
            </span>
          ) : pullDistance >= 80 ? (
            "Release to refresh"
          ) : pullDistance > 0 ? (
            "Pull to refresh"
          ) : null}
        </div>

        <div className="p-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : dayShifts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <div className="text-sm font-medium">No shifts for this day</div>
              <div className="mt-1 text-xs text-muted-foreground">Tap the + button to add one.</div>
              <div className="mt-4">
                <Button onClick={onAddShift} className="bg-blue-600 text-white hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" /> Add shift
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {groupKeys.map((key) => {
                const list = groups.get(key) || []
                const header =
                  key === "open"
                    ? { name: "Open shifts", sub: "Unassigned" }
                    : {
                        name: employeeById.get(key)?.full_name || employeeById.get(key)?.email || "Employee",
                        sub: employeeById.get(key)?.department || "",
                      }

                return (
                  <div key={key} className="rounded-xl border border-border bg-background">
                    <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{header.name}</div>
                        {header.sub ? <div className="truncate text-xs text-muted-foreground">{header.sub}</div> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {list.length} shift{list.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    <div className="divide-y divide-border">
                      {list.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-muted/30"
                          onClick={() => onEditShift(s)}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground">
                              {formatTimeRange(s.start_time, s.end_time)}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {key === "open"
                                ? "Unassigned"
                                : employeeById.get(key)?.full_name || employeeById.get(key)?.email || "Employee"}
                              {key !== "open" && employeeById.get(key)?.department
                                ? ` • ${employeeById.get(key)?.department}`
                                : ""}
                              {s.role ? ` • ${s.role}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {s.role ? (
                              <Badge variant="brand">{s.role}</Badge>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onAddShift}
        className={cn(
          "fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full",
          "bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98]",
        )}
        aria-label="Add shift"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  )
}

