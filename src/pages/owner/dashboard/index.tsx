import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Activity,
  CalendarClock,
  Pencil,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  useAllDelegationTasks,
  useCreateDelegationTask,
  useDeleteDelegationTask,
  useUpdateDelegationTask,
} from "@/hooks/useDelegationTasks"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { useAuthStore } from "@/stores/authStore"
import type { BoardColumnKey, CreateDelegationTaskInput, DelegationTask, TaskCategory, TaskStatus } from "@/types"
import { KanbanBoard, COLUMNS } from "@/components/dashboard/KanbanBoard"
import { cn } from "@/lib/utils"
import { SectionTitle } from "@/components/ui/section-title"
import { useStaffList, useTodayShifts } from "@/hooks/useShifts"
import { useGoogleReviews, useKPISummary, useRevenueVelocity } from "@/hooks/useDashboardData"
import {
  useExecutiveDashboardDailyInput,
  useMonthlyTarget,
  useUpsertExecutiveDashboardDailyInput,
  useUpsertMonthlyTarget,
} from "@/hooks/useExecutiveDashboardInputs"
import { useTodayPaxConfirmed, useReservationsCsv } from "@/hooks/useReservationsCsv"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useRoofCalendarWeekData } from "@/hooks/useWeekAtGlanceCsv"

const ICT_TZ = "Asia/Ho_Chi_Minh"

function getIctParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ICT_TZ,
    hour12: false,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now)

  const map = new Map<string, string>()
  for (const p of parts) map.set(p.type, p.value)

  return {
    weekday: map.get("weekday") || "",
    month: map.get("month") || "",
    day: map.get("day") || "",
    year: map.get("year") || "",
    hour: Number(map.get("hour") || 0),
    minute: Number(map.get("minute") || 0),
    second: Number(map.get("second") || 0),
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function formatCompactVnd(value: number) {
  const v = Number(value || 0)
  if (!Number.isFinite(v)) return "—"
  const abs = Math.abs(v)
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${Math.round(v / 1_000)}K`
  return `${Math.round(v)}`
}

function greetingFromHour(h: number) {
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

function isClubNight(weekday: string) {
  // Thu-Sat are club nights in the screenshot reference.
  return ["Thursday", "Friday", "Saturday"].includes(weekday)
}


function priorityPill(priority: string) {
  const p = String(priority || "").toLowerCase()
  if (p === "urgent" || p === "high") return { label: p.toUpperCase(), className: "bg-error/10 text-error border border-error/20" }
  if (p === "medium") return { label: "MEDIUM", className: "bg-muted text-muted-foreground border border-border" }
  return { label: "LOW", className: "bg-muted text-muted-foreground border border-border" }
}

function formatPipelineWhen(dateIso: string, startTime: string | null, endTime: string | null) {
  const [y, m, d] = dateIso.split("-").map((x) => Number(x))
  const dt = new Date(Date.UTC(y, m - 1, d))
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: ICT_TZ, weekday: "short" }).format(dt)
  const month = new Intl.DateTimeFormat("en-US", { timeZone: ICT_TZ, month: "short" }).format(dt)
  const day = String(dt.getUTCDate())
  const datePart = `${weekday} ${day} ${month}`
  if (startTime && endTime) return `${datePart}, ${startTime} - ${endTime}`
  return datePart
}

function mapToBoardColumn(t: DelegationTask, todayIso: string, myUserId: string): BoardColumnKey {
  if (t.status === "cancelled") return "not_started"
  if (t.status === "done") return "done"
  // Delegated tasks are shown in the Follow-Up panel, not the kanban
  if (myUserId && t.assignedTo && t.assignedTo !== myUserId) return "not_started"
  // My own tasks: route by status
  if (t.status === "in_progress" && t.dueDate === todayIso) return "finish_today"
  if (t.status === "todo") return "not_started"
  if (t.status === "in_progress") return "in_progress"
  return "not_started"
}

const CATEGORY_OPTIONS: Array<{ value: TaskCategory; label: string }> = [
  { value: "bar", label: "Bar" },
  { value: "operations", label: "Operation" },
  { value: "finance", label: "Finance" },
  { value: "ordering", label: "Ordering" },
  { value: "marketing", label: "Marketing" },
  { value: "event", label: "Events" },
]


function formatDue(dueIso: string | undefined) {
  if (!dueIso) return "—"
  try {
    return new Date(`${dueIso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return dueIso
  }
}



function AnalogClock({
  hour,
  minute,
  second,
}: {
  hour: number
  minute: number
  second: number
}) {
  const secDeg = (second / 60) * 360
  const minDeg = (minute / 60) * 360 + (second / 60) * 6
  const hourDeg = ((hour % 12) / 12) * 360 + (minute / 60) * 30

  return (
    <svg viewBox="0 0 200 200" className="mx-auto h-20 w-20 text-foreground">
      <circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="4" fill="rgb(var(--primary))" />

      {/* hour hand */}
      <line
        x1="100"
        y1="100"
        x2="100"
        y2="56"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        style={{ transform: `rotate(${hourDeg}deg)`, transformOrigin: "100px 100px" }}
      />
      {/* minute hand */}
      <line
        x1="100"
        y1="100"
        x2="100"
        y2="40"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ transform: `rotate(${minDeg}deg)`, transformOrigin: "100px 100px" }}
      />
      {/* second hand */}
      <line
        x1="100"
        y1="104"
        x2="100"
        y2="30"
        stroke="rgb(var(--primary))"
        strokeWidth="1"
        strokeLinecap="round"
        style={{ transform: `rotate(${secDeg}deg)`, transformOrigin: "100px 100px" }}
      />
    </svg>
  )
}

function MetricCard({
  title,
  children,
  footer,
  className,
}: {
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-card border border-border bg-card p-5 shadow-card", className)}>
      <div className="text-xs tracking-widest font-semibold text-foreground uppercase">
        {title}
      </div>
      <div className="mt-2">{children}</div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  )
}

function CardShell({
  title,
  icon,
  right,
  children,
  className,
}: {
  title: string
  icon?: React.ReactNode
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-card border border-border bg-card shadow-card", className)}>
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          {icon ? <div className="text-primary">{icon}</div> : null}
          <div className="text-xs tracking-widest font-semibold text-foreground uppercase">
            {title}
          </div>
        </div>
        {right}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  )
}

export default function OwnerDashboardPage() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const firstName = (profile?.fullName || "Charlie").split(" ")[0] || "Charlie"

  const [tick, setTick] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setTick(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const ict = useMemo(() => getIctParts(tick), [tick])
  const greeting = greetingFromHour(ict.hour)
  const dateString = `${ict.weekday.toUpperCase()}, ${ict.month.toUpperCase()} ${ict.day}, ${ict.year}`
  const timeString = `${pad2(ict.hour)}:${pad2(ict.minute)}:${pad2(ict.second)}`
  const todayIso = useMemo(() => {
    // "YYYY-MM-DD" in ICT
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ICT_TZ }).formatToParts(tick)
    const map = new Map(parts.map((p) => [p.type, p.value]))
    return `${map.get("year")}-${map.get("month")}-${map.get("day")}`
  }, [tick])

  const showClubNight = isClubNight(ict.weekday)
  const modeLabel = showClubNight ? "Club Night" : "Lounge Day"
  const hoursLabel = showClubNight ? "Open 14:00 – 02:00" : "Open 14:00 – 01:00"

  const periodStartIso = `${todayIso.slice(0, 7)}-01`
  const { data: kpi, isLoading: kpiLoading } = useKPISummary()
  const { data: velocity, isLoading: velocityLoading } = useRevenueVelocity()
  const { data: googleReviews } = useGoogleReviews()
  const { data: dailyInput, isLoading: _dailyInputLoading } = useExecutiveDashboardDailyInput(todayIso)
  const upsertDailyInput = useUpsertExecutiveDashboardDailyInput()
  const { data: paxTarget } = useMonthlyTarget("pax", periodStartIso)
  const { pax: csvPaxConfirmed, isLoading: csvPaxLoading } = useTodayPaxConfirmed()
  const { data: allCsvReservations = [] } = useReservationsCsv()
  const { data: todayShifts = [] } = useTodayShifts(todayIso)

  const tonightsRevenue = dailyInput?.tonightsRevenue ?? 0
  const daysInMonth = velocity?.daysInMonth ?? 0
  const monthlyTarget = velocity?.monthlyTarget ?? 0
  const mtdRevenue = kpi?.revenue.value ?? 0
  const mtdPax = kpi?.pax.value ?? 0
  const monthlyPaxPercent = paxTarget && paxTarget > 0 ? Math.round((mtdPax / paxTarget) * 100) : null

  const [tonightEditOpen, setTonightEditOpen] = useState(false)
  const [tonightDraft, setTonightDraft] = useState("")
  useEffect(() => {
    if (tonightEditOpen) setTonightDraft(String(Math.round(tonightsRevenue || 0)))
  }, [tonightEditOpen, tonightsRevenue])

  const upsertMonthlyTarget = useUpsertMonthlyTarget()
  const [paxTargetEditOpen, setPaxTargetEditOpen] = useState(false)
  const [paxTargetDraft, setPaxTargetDraft] = useState("")
  useEffect(() => {
    if (paxTargetEditOpen) setPaxTargetDraft(paxTarget ? String(Math.round(Number(paxTarget))) : "")
  }, [paxTargetEditOpen, paxTarget])

  const { data: roofCalendar, isLoading: weekCsvLoading, error: weekCsvError } = useRoofCalendarWeekData()
  const weekCsv = roofCalendar?.byDate ?? []
  const roofEvents = roofCalendar?.events ?? []
  const weekByDate = useMemo(() => {
    const map = new Map<string, (typeof weekCsv)[number]>()
    for (const x of weekCsv || []) map.set(x.dateIso, x)
    return map
  }, [weekCsv])

  const weekDates = useMemo(() => {
    // Build Mon..Sun for the current week, using todayIso as anchor (stable, timezone-safe).
    const [y, m, d] = todayIso.split("-").map((x) => Number(x))
    const anchor = new Date(Date.UTC(y, m - 1, d))
    const dowMon0 = (anchor.getUTCDay() + 6) % 7 // Mon=0..Sun=6
    const start = new Date(Date.UTC(y, m - 1, d - dowMon0))
    const out: Array<{ day: string; dateNum: number; iso: string }> = []
    const dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    for (let i = 0; i < 7; i++) {
      const dt = new Date(start)
      dt.setUTCDate(start.getUTCDate() + i)
      const iso = dt.toISOString().slice(0, 10)
      out.push({ day: dayNames[i], dateNum: dt.getUTCDate(), iso })
    }
    return out
  }, [todayIso])

  const pipelineRows = useMemo(() => {
    const byDate = new Map<string, typeof roofEvents>()
    for (const e of roofEvents || []) {
      if (!e.dateIso) continue
      const list = byDate.get(e.dateIso) || []
      list.push(e)
      byDate.set(e.dateIso, list)
    }

    return weekDates.map((d) => {
      const dayEvents = (byDate.get(d.iso) || [])
        .filter((e) => e.eventName)
        .slice()
        .sort((a, b) => (a.startMinutes ?? 999999) - (b.startMinutes ?? 999999))

      const first = dayEvents[0]
      if (!first) {
        return {
          iso: d.iso,
          isToday: d.iso === todayIso,
          event: "TBD",
          when: formatPipelineWhen(d.iso, null, null),
          dj1: "—",
          dj2: "—",
          genre: "—",
          promo: "—",
        }
      }

      const extraCount = Math.max(0, dayEvents.length - 1)
      const eventLabel = `${first.eventName}${extraCount ? ` +${extraCount} more` : ""}`

      return {
        iso: d.iso,
        isToday: d.iso === todayIso,
        event: eventLabel,
        when: formatPipelineWhen(d.iso, first.startTime, first.endTime),
        dj1: first.dj1 || "—",
        dj2: first.dj2 || "—",
        genre: first.genre || "—",
        promo: first.promotion || "—",
      }
    })
  }, [roofEvents, weekDates, todayIso])

  const { data: allTasks = [], isLoading: tasksLoading } = useAllDelegationTasks([
    "todo",
    "in_progress",
    "blocked",
    "done",
  ])

  // Optimistic column overrides: taskId → { status, dueDate }
  const [columnOverrides, setColumnOverrides] = useState<Record<string, { status: TaskStatus; dueDate?: string }>>({})

  const boardTasks = useMemo(
    () => (allTasks || []).filter((t) => t.status !== "cancelled"),
    [allTasks],
  )

  // Apply optimistic overrides before grouping
  const boardTasksWithOverrides = useMemo(() => boardTasks.map((t) => {
    const ov = columnOverrides[t.id]
    if (!ov) return t
    return { ...t, status: ov.status, dueDate: ov.dueDate !== undefined ? ov.dueDate : t.dueDate }
  }), [boardTasks, columnOverrides])

  const myUserId = profile?.id ?? ""

  const grouped = useMemo(() => {
    const cols: Record<BoardColumnKey, DelegationTask[]> = {
      not_started: [],
      in_progress: [],
      finish_today: [],
      done: [],
    }
    for (const t of boardTasksWithOverrides) {
      // Skip delegated tasks — they live in the Follow-Up panel only
      if (myUserId && t.assignedTo && t.assignedTo !== myUserId) continue
      cols[mapToBoardColumn(t, todayIso, myUserId)].push(t)
    }
    return cols
  }, [boardTasksWithOverrides, todayIso, myUserId])


  const followUpList = useMemo(() => {
    // Only show tasks I delegated TO someone else (I am assigned_by, they are assigned_to)
    const list = (allTasks || [])
      .filter((t) =>
        t.assignedBy === myUserId &&
        t.assignedTo !== myUserId &&
        t.status !== "done" &&
        t.status !== "cancelled",
      )
      .slice()
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
      .slice(0, 6)

    const now = Date.now()
    return list.map((t) => {
      const updated = t.updatedAt ? new Date(t.updatedAt).getTime() : 0
      const days = updated ? Math.max(0, Math.floor((now - updated) / (1000 * 60 * 60 * 24))) : null
      const label = days === null ? "No update" : days === 0 ? "Updated today" : `${days}d no update`
      const isFresh = days !== null && days <= 1
      return { task: t, label, isFresh }
    })
  }, [allTasks, myUserId])

  const [taskView, setTaskView] = useState<"kanban" | "list">("kanban")
  const [listStatusFilter, setListStatusFilter] = useState<"all" | TaskStatus | "finish_today">("all")

  const staff = useStaffList()
  // Include the owner themselves so they can self-assign tasks
  const people = useMemo(() => {
    const list = (staff.data || []) as any[]
    if (profile && !list.find((p: any) => p.id === profile.id)) {
      return [{ id: profile.id, full_name: (profile as any).full_name || profile.email || 'Me', role: profile.role }, ...list]
    }
    return list
  }, [staff.data, profile])

  const createTask = useCreateDelegationTask()
  const updateTask = useUpdateDelegationTask()
  const deleteTask = useDeleteDelegationTask()

  const [taskSheetOpen, setTaskSheetOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const selectedTask = useMemo(
    () => (selectedTaskId ? allTasks.find((t) => t.id === selectedTaskId) || null : null),
    [allTasks, selectedTaskId],
  )

  const [taskError, setTaskError] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({
    title: "",
    description: "",
    notes: "",
    timeStarted: "" as string,
    dueDate: "",
    dueTime: "",
    category: "operations" as TaskCategory,
    status: "todo" as TaskStatus,
    assignedTo: "",
    priority: "medium" as import("@/types").TaskPriority,
  })

  useEffect(() => {
    if (!selectedTask) return
    setTaskError(null)
    setEditDraft({
      title: selectedTask.title || "",
      description: selectedTask.description || "",
      notes: selectedTask.notes || "",
      timeStarted: selectedTask.timeStarted || "",
      dueDate: selectedTask.dueDate || "",
      dueTime: selectedTask.dueTime || "",
      category: (selectedTask.category || "operations") as TaskCategory,
      status: (selectedTask.status || "todo") as TaskStatus,
      assignedTo: selectedTask.assignedTo || "",
      priority: (selectedTask.priority || "medium") as import("@/types").TaskPriority,
    })
  }, [selectedTask?.id])

  const [createOpen, setCreateOpen] = useState(false)
  const [_createForColumn, setCreateForColumn] = useState<BoardColumnKey>("not_started")
  const [createError, setCreateError] = useState<string | null>(null)
  const [createDraft, setCreateDraft] = useState<CreateDelegationTaskInput>(() => ({
    title: "",
    description: "",
    notes: "",
    assignedTo: "",
    dueDate: "",
    dueTime: "",
    timeStarted: "",
    category: "operations",
    priority: "medium",
    status: "todo",
  }))

  function openTask(t: DelegationTask) {
    setSelectedTaskId(t.id)
    setTaskSheetOpen(true)
  }

  function openCreate(col: BoardColumnKey) {
    setCreateForColumn(col)
    setCreateError(null)
    const defaultAssignee = myUserId

    const defaultsByColumn: Partial<CreateDelegationTaskInput> =
      col === "in_progress"
        ? { status: "in_progress", timeStarted: new Date().toISOString() }
        : (col as string) === "delegated_follow_up"
          ? { status: "blocked" }
          : col === "finish_today"
            ? { status: "todo", dueDate: todayIso }
            : { status: "todo" }

    setCreateDraft({
      title: "",
      description: "",
      notes: "",
      assignedTo: defaultAssignee,
      dueDate: defaultsByColumn.dueDate || "",
      dueTime: "",
      timeStarted: defaultsByColumn.timeStarted || "",
      category: "operations",
      priority: "medium",
      status: defaultsByColumn.status || "todo",
    })
    setCreateOpen(true)
  }

  function handleMoveTask(taskId: string, toColumn: BoardColumnKey) {
    const col = COLUMNS.find((c) => c.key === toColumn)
    if (!col) return
    const newStatus = col.targetStatus
    const newDueDate = toColumn === "finish_today" ? todayIso : undefined

    // Apply optimistic override immediately so the card moves without waiting for the server
    setColumnOverrides((prev) => ({
      ...prev,
      [taskId]: { status: newStatus, ...(newDueDate !== undefined && { dueDate: newDueDate }) },
    }))

    updateTask.mutate(
      { id: taskId, status: newStatus, ...(newDueDate !== undefined && { dueDate: newDueDate }) } as any,
      {
        onSettled: () => {
          // Remove override once the server has responded (success or error) — the fresh query data takes over
          setColumnOverrides((prev) => {
            const next = { ...prev }
            delete next[taskId]
            return next
          })
        },
      },
    )
  }

  const meetingKey = "roof_meeting_today"
  const [_meeting, _setMeeting] = useState(() => {
    try {
      const raw = localStorage.getItem(meetingKey)
      if (!raw) return { title: "Team meeting — 15:00", location: "Briefing Room" }
      const parsed = JSON.parse(raw)
      return {
        title: String(parsed?.title || "Team meeting — 15:00"),
        location: String(parsed?.location || "Briefing Room"),
      }
    } catch {
      return { title: "Team meeting — 15:00", location: "Briefing Room" }
    }
  })
  const [_editingMeeting, _setEditingMeeting] = useState<"title" | "location" | null>(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-card border border-border bg-card px-6 py-4 shadow-card">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-center">
          <div>
            <div className="font-display text-xl tracking-[4px] text-primary">THE ROOF</div>
            <div className="mt-0.5 text-sm font-light tracking-widest text-muted-foreground">
              Da Nang · Club & Lounge
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm tracking-widest text-muted-foreground uppercase">
              {dateString}
            </div>
            <div className="mt-1 font-subheading text-lg font-light italic text-foreground">
              {greeting}, {firstName}
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end md:gap-3">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs tracking-wide text-muted-foreground">{hoursLabel}</div>
              </div>
              <div className="rounded-sm border border-border px-3 py-1 text-xs tracking-widest font-semibold text-foreground uppercase">
                {modeLabel.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HQ row */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <CardShell title="HQ — DA NANG" icon={<Activity className="h-4 w-4" />}>
          <div className="grid gap-4">
            <AnalogClock hour={ict.hour} minute={ict.minute} second={ict.second} />
            <div className="text-center">
              <div className="font-display text-[26px] tracking-[4px] text-foreground">{timeString}</div>
              <div className="mt-1 text-xs tracking-wider text-muted-foreground uppercase">
                ICT · UTC+7
              </div>
            </div>
          </div>
        </CardShell>

        <CardShell title="DA NANG — WEATHER" icon={<CalendarClock className="h-4 w-4" />}>
          <div className="flex items-stretch gap-0">
            {/* Current conditions */}
            <div className="min-w-[200px] border-r border-border pr-6">
              <div className="text-xs tracking-widest font-semibold text-foreground uppercase">Da Nang · Weather</div>
              <div className="mt-2 flex items-center gap-3">
                <div className="text-[32px]">🌤</div>
                <div className="font-display text-[44px] leading-none tracking-[2px] text-foreground">27°</div>
              </div>
              <div className="mt-2 text-xs text-secondary-foreground tracking-wide">Broken Clouds · Humidity 78%</div>

              <div className="mt-3 flex items-center gap-1.5 rounded-sm border border-info/15 bg-info/8 px-2.5 py-1.5 text-xs text-info">
                <span>⚡</span> Rain expected Saturday — prep covers & heaters by 13:00
              </div>
            </div>

            {/* 7-day forecast */}
            <div className="flex flex-1 items-center pl-5">
              {[
                { d: "TUE", hi: 27, lo: 22, emoji: "🌤" },
                { d: "WED", hi: 25, lo: 22, emoji: "🌥" },
                { d: "THU", hi: 25, lo: 22, emoji: "🌧" },
                { d: "FRI", hi: 25, lo: 22, emoji: "🌧" },
                { d: "SAT", hi: 25, lo: 20, emoji: "⛈", badge: "PREP" },
                { d: "SUN", hi: 25, lo: 22, emoji: "⛅" },
                { d: "MON", hi: 25, lo: 22, emoji: "🌥" },
              ].map((x, i, arr) => (
                <div key={x.d} className={cn("flex flex-1 flex-col items-center gap-1.5 py-1", i < arr.length - 1 && "border-r border-border")}>
                  <div className="text-xs tracking-wider text-muted-foreground uppercase">{x.d}</div>
                  <div className="text-base">{x.emoji}</div>
                  <div className="text-sm text-foreground">{x.hi}°</div>
                  <div className="text-xs text-muted-foreground">{x.lo}°</div>
                  {"badge" in x && x.badge ? (
                    <div className="rounded-sm border border-warning/20 bg-warning/10 px-1 py-0.5 text-sm tracking-wider text-warning uppercase">
                      {x.badge}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </CardShell>
      </div>

      {/* Revenue pulse */}
      <div className="space-y-3">
        <SectionTitle label="TODAYS PULSE" />

        {/* Team on Shift (left, spans 2 rows) + right column (3 cards + revenue bar) */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr] lg:items-stretch">

          {/* Team on Shift Today */}
          <div className="rounded-card border border-border bg-card shadow-card flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="text-xs tracking-widest font-semibold text-foreground uppercase">Team on Shift Today</div>
              {todayShifts.length > 0 && (
                <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {todayShifts.length} members
                </span>
              )}
            </div>
            <div className="flex-1 px-5 py-2">
              {todayShifts.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">No shifts scheduled today</div>
              ) : (() => {
                const DEPT_COLORS: Record<string, { accent: string; badgeBg: string }> = {
                  bar:        { accent: '#1565C0', badgeBg: '#E3F0FF' },
                  service:    { accent: '#2E7D52', badgeBg: '#E6F4EC' },
                  marketing:  { accent: '#7B3F00', badgeBg: '#FEF0E3' },
                  management: { accent: '#8B3030', badgeBg: '#FAE8E8' },
                  accountant: { accent: '#5C4080', badgeBg: '#F0EAFA' },
                  other:      { accent: '#6B7280', badgeBg: '#F3F4F6' },
                }
                const grouped = todayShifts.reduce<Record<string, typeof todayShifts>>((acc, s) => {
                  const dept = ((s as any).department || 'other').toLowerCase()
                  ;(acc[dept] = acc[dept] || []).push(s)
                  return acc
                }, {})
                return (
                  <div className="space-y-1 py-1">
                    {Object.entries(grouped).map(([dept, shifts]) => {
                      const theme = DEPT_COLORS[dept] || DEPT_COLORS.other
                      const label = dept.charAt(0).toUpperCase() + dept.slice(1)
                      return (
                        <div key={dept}>
                          <div className="flex items-center gap-2 py-2">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: theme.accent }} />
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: theme.accent }}>{label}</span>
                            <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold" style={{ background: theme.badgeBg, color: theme.accent }}>{shifts.length}</span>
                          </div>
                          {shifts.map((shift) => {
                            const initials = (shift.staffName || "?")
                              .split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
                            const isActive = shift.status === "in_progress"
                            return (
                              <div key={shift.id} className="flex items-center justify-between py-2 border-b border-border last:border-0"
                                style={{ borderLeft: `2px solid ${theme.accent}22`, marginLeft: '4px', paddingLeft: '10px' }}>
                                <div className="flex items-center gap-3">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white shrink-0" style={{ background: theme.accent }}>
                                    {initials}
                                  </div>
                                  <div>
                                    <div className="text-sm text-foreground">{shift.staffName}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {(shift as any).jobRole || shift.role}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    {shift.startTime?.slice(0, 5)} – {shift.endTime?.slice(0, 5)}
                                  </span>
                                  <span className={cn("h-2 w-2 rounded-full", isActive ? "bg-success" : "bg-border")} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
            {todayShifts.length > 0 && (
              <button
                type="button"
                onClick={() => navigate("/owner/schedule")}
                className="flex items-center justify-between w-full px-5 py-3 border-t border-border text-left hover:bg-secondary/40 transition-colors"
              >
                <div>
                  <div className="text-sm font-semibold text-foreground">View full roster</div>
                  <div className="text-xs text-muted-foreground">See all {todayShifts.length} members scheduled today</div>
                </div>
                <span className="text-xs text-muted-foreground">—</span>
              </button>
            )}
          </div>

          {/* Right: 3 metric cards (row 1) + revenue bar (row 2) */}
          <div className="flex flex-col gap-4 h-full">
          <div className="grid grid-cols-3 gap-4">
            <MetricCard
              title="Reservations"
              footer={
                <div className="rounded-sm border border-success/25 bg-success/8 px-2 py-1.5 text-xs text-success">
                  {allCsvReservations.filter((r) => r.status === "upcoming").length} upcoming
                </div>
              }
            >
              <div className="font-display text-[34px] leading-none tracking-[2px] text-foreground">
                {csvPaxLoading ? "—" : allCsvReservations.filter((r) => r.status === "today").length}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Confirmed tonight</div>
            </MetricCard>

            <MetricCard
              title="Google rating"
              footer={
                googleReviews?.monthlySummaries && googleReviews.monthlySummaries.length === 2 ? (
                  <div className="rounded-sm border border-border bg-secondary/50 px-2 py-1.5 text-xs text-muted-foreground space-y-0.5">
                    <div>
                      <span className="text-secondary-foreground font-medium">{googleReviews.monthlySummaries[0].count.toLocaleString()}</span>
                      {" reviews in "}
                      <span className="text-secondary-foreground">{googleReviews.monthlySummaries[0].monthLabel}</span>
                    </div>
                    <div>
                      <span className="text-primary font-medium">{googleReviews.monthlySummaries[1].count.toLocaleString()}</span>
                      {" reviews so far in "}
                      <span className="text-secondary-foreground">{googleReviews.monthlySummaries[1].monthLabel}</span>
                    </div>
                  </div>
                ) : null
              }
            >
              <div className="text-[13px] text-primary">★★★★★</div>
              <div className="font-display text-[34px] leading-none tracking-[2px] text-foreground">
                {googleReviews?.rating ? googleReviews.rating.toFixed(1) : "—"}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {googleReviews?.reviewCount ? googleReviews.reviewCount.toLocaleString() : "—"} reviews total
              </div>
            </MetricCard>

            <MetricCard
              title="Monthly pax"
              footer={
                monthlyPaxPercent === null ? (
                  <button
                    type="button"
                    onClick={() => setPaxTargetEditOpen(true)}
                    className="inline-flex w-full items-center justify-center gap-1 rounded-sm border border-border px-2 py-1.5 text-xs tracking-wider text-muted-foreground uppercase hover:border-primary/30 hover:text-secondary-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                    Set pax target
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={cn(
                        "flex-1 rounded-sm border px-2 py-1.5 text-xs",
                        monthlyPaxPercent >= 100
                          ? "border-success/25 bg-success/8 text-success"
                          : "border-warning/25 bg-warning/8 text-warning",
                      )}
                    >
                      {monthlyPaxPercent >= 100 ? "On track" : "Behind"} · {monthlyPaxPercent}%
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaxTargetEditOpen(true)}
                      className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-xs tracking-wider text-secondary-foreground uppercase hover:border-primary/30"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                  </div>
                )
              }
            >
              <div className="font-display text-[34px] leading-none tracking-[2px] text-foreground">
                {kpiLoading ? "—" : mtdPax.toLocaleString()}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Target: {paxTarget ? Number(paxTarget).toLocaleString() : "—"}
              </div>
            </MetricCard>
          </div>

          {/* Today's Revenue Target — smart analysis card */}
          {(() => {
            const remainingDays = velocity ? velocity.daysInMonth - velocity.currentDay : 0
            const requiredToday = remainingDays > 0 ? (monthlyTarget - mtdRevenue) / remainingDays : 0
            const avgDailyRevenue = velocity?.avgDailyRevenue ?? 0
            const yesterdayRevenue = velocity?.yesterdayRevenue ?? 0
            const projectedEnd = velocity?.projectedMonthEnd ?? 0
            const gap = monthlyTarget - mtdRevenue
            const targetCleared = mtdRevenue >= monthlyTarget
            const mtdPct = monthlyTarget > 0 ? Math.round((mtdRevenue / monthlyTarget) * 100) : 0

            // Momentum: is avg pace above or below what's required?
            const paceVsRequired = requiredToday > 0 ? avgDailyRevenue / requiredToday : 1
            const momentumGood = paceVsRequired >= 0.9
            const momentumCritical = paceVsRequired < 0.7

            // Tonight's entered number vs what's required
            const tonightHasInput = tonightsRevenue > 0
            const tonightVsRequired = tonightHasInput && requiredToday > 0
              ? tonightsRevenue / requiredToday
              : null

            // Status label
            const statusLabel = targetCleared
              ? "Target cleared"
              : momentumCritical
                ? "Behind pace"
                : momentumGood
                  ? "On track"
                  : "Tracking low"
            const statusStyle = targetCleared
              ? "border-success/25 bg-success/8 text-success"
              : momentumCritical
                ? "border-destructive/25 bg-destructive/8 text-destructive"
                : momentumGood
                  ? "border-success/25 bg-success/8 text-success"
                  : "border-warning/25 bg-warning/8 text-warning"

            // Smart insight sentence
            const insight = (() => {
              if (targetCleared) {
                const stretchGap = (monthlyTarget * 1.5) - mtdRevenue
                const stretchRequired = remainingDays > 0 ? stretchGap / remainingDays : 0
                return `Monthly target cleared. Averaging ${formatCompactVnd(avgDailyRevenue)} đ/day — need ${formatCompactVnd(stretchRequired)} đ/day to reach stretch goal of ${formatCompactVnd(monthlyTarget * 1.5)} đ.`
              }
              if (remainingDays <= 0) {
                return gap > 0
                  ? `Month ended ${formatCompactVnd(Math.abs(gap))} đ short of target.`
                  : `Month ended ${formatCompactVnd(Math.abs(gap))} đ over target.`
              }
              if (momentumCritical) {
                return `Avg pace ${formatCompactVnd(avgDailyRevenue)} đ/day is well below the ${formatCompactVnd(requiredToday)} đ/day needed. ${formatCompactVnd(gap)} đ gap with ${remainingDays} days left.`
              }
              if (yesterdayRevenue < avgDailyRevenue * 0.8) {
                return `Yesterday dipped to ${formatCompactVnd(yesterdayRevenue)} đ — below the ${formatCompactVnd(avgDailyRevenue)} đ avg. Need ${formatCompactVnd(requiredToday)} đ/day to close the ${formatCompactVnd(gap)} đ gap.`
              }
              return `On pace at ${formatCompactVnd(avgDailyRevenue)} đ/day vs ${formatCompactVnd(requiredToday)} đ/day required. ${formatCompactVnd(gap)} đ remaining over ${remainingDays} days.`
            })()

            return (
              <div className="rounded-card border border-border bg-card px-6 py-5 shadow-card flex-1 flex flex-col">
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-1">Today's Revenue Target</div>
                    <div className="flex items-baseline gap-3">
                      <div className="font-display text-[38px] leading-none tracking-[2px] text-foreground">
                        {velocityLoading ? "—" : formatCompactVnd(requiredToday)}
                        <span className="text-2xl text-muted-foreground font-light"> đ</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">needed today</div>
                    </div>
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      Day {velocity?.currentDay ?? "—"} of {daysInMonth} · {remainingDays} days left · Goal {formatCompactVnd(monthlyTarget)} đ/month
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setTonightEditOpen(true)}
                      className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1.5 text-xs tracking-wider text-secondary-foreground uppercase hover:border-primary/30"
                    >
                      <Pencil className="h-3 w-3" />
                      {tonightHasInput ? formatCompactVnd(tonightsRevenue) + " đ" : "Log tonight"}
                    </button>
                    <div className={cn("rounded-sm border px-3 py-1.5 text-xs tracking-wider uppercase", statusStyle)}>
                      {statusLabel}
                    </div>
                  </div>
                </div>

                {/* Progress bar: MTD vs target */}
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>MTD {formatCompactVnd(mtdRevenue)} đ ({mtdPct}%)</span>
                    <span>Target {formatCompactVnd(monthlyTarget)} đ</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", targetCleared ? "bg-success" : momentumCritical ? "bg-destructive" : "bg-primary")}
                      style={{ width: `${Math.min(100, mtdPct)}%` }}
                    />
                  </div>
                </div>

                {/* Smart metrics row */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div className="rounded-md bg-secondary/50 px-3 py-2">
                    <div className="text-[9.5px] uppercase tracking-widest text-muted-foreground mb-0.5">Avg/day</div>
                    <div className={cn("text-xs font-semibold", momentumGood ? "text-success" : momentumCritical ? "text-destructive" : "text-warning")}>
                      {velocityLoading ? "—" : formatCompactVnd(avgDailyRevenue)} đ
                    </div>
                  </div>
                  <div className="rounded-md bg-secondary/50 px-3 py-2">
                    <div className="text-[9.5px] uppercase tracking-widest text-muted-foreground mb-0.5">Yesterday</div>
                    <div className={cn("text-xs font-semibold", yesterdayRevenue >= avgDailyRevenue ? "text-success" : "text-warning")}>
                      {velocityLoading ? "—" : formatCompactVnd(yesterdayRevenue)} đ
                    </div>
                  </div>
                  <div className="rounded-md bg-secondary/50 px-3 py-2">
                    <div className="text-[9.5px] uppercase tracking-widest text-muted-foreground mb-0.5">Projected</div>
                    <div className={cn("text-xs font-semibold", projectedEnd >= monthlyTarget ? "text-success" : "text-warning")}>
                      {velocityLoading ? "—" : formatCompactVnd(projectedEnd)} đ
                    </div>
                  </div>
                  <div className="rounded-md bg-secondary/50 px-3 py-2">
                    <div className="text-[9.5px] uppercase tracking-widest text-muted-foreground mb-0.5">Pax tonight</div>
                    <div className="text-xs font-semibold text-foreground">
                      {csvPaxLoading ? "—" : csvPaxConfirmed > 0 ? csvPaxConfirmed : "—"}
                    </div>
                  </div>
                </div>

                {/* Tonight's log vs required — only shown when input exists */}
                {tonightHasInput && tonightVsRequired !== null && (
                  <div className={cn(
                    "mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                    tonightVsRequired >= 1 ? "border-success/25 bg-success/8 text-success" : "border-warning/25 bg-warning/8 text-warning"
                  )}>
                    <span className="font-semibold">Tonight logged: {formatCompactVnd(tonightsRevenue)} đ</span>
                    <span className="text-[10px] opacity-70">
                      {tonightVsRequired >= 1
                        ? `+${formatCompactVnd(tonightsRevenue - requiredToday)} đ above required`
                        : `${formatCompactVnd(requiredToday - tonightsRevenue)} đ below required`}
                    </span>
                  </div>
                )}

                {/* Smart insight */}
                <div className="mt-auto pt-2 border-t border-border">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{velocityLoading ? "Calculating…" : insight}</p>
                </div>
              </div>
            )
          })()}
          </div>
        </div>
      </div>

      {/* Task board */}
      <div className="space-y-3">
        <SectionTitle label="TASK BOARD & TEAM ACCOUNTABILITY" />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]" style={{ alignItems: "start" }}>
          {/* Left: My Tasks */}
          <div>
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="text-xs tracking-wider text-muted-foreground uppercase">My tasks</div>
              <div className="flex items-center gap-2">
                <div className="flex overflow-hidden rounded-sm border border-border bg-secondary">
                  <button
                    type="button"
                    onClick={() => setTaskView("kanban")}
                    className={cn(
                      "px-3 py-1 text-xs tracking-wider uppercase",
                      taskView === "kanban" ? "bg-card text-primary shadow-card" : "text-muted-foreground",
                    )}
                  >
                    Kanban
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskView("list")}
                    className={cn(
                      "px-3 py-1 text-xs tracking-wider uppercase",
                      taskView === "list" ? "bg-card text-primary shadow-card" : "text-muted-foreground",
                    )}
                  >
                    List
                  </button>
                </div>
              </div>
            </div>

            {tasksLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="text-xs text-muted-foreground">Loading tasks…</div>
              </div>
            ) : taskView === "list" ? (
              <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                {/* Status filter pills */}
                <div className="flex items-center gap-1.5 flex-wrap px-3 py-2.5 border-b border-border bg-secondary/30">
                  {([
                    { value: "all",         label: "All",          cls: "border-border text-muted-foreground" },
                    { value: "todo",        label: "Not Started",  cls: "border-[#6b7280]/40 text-[#6b7280] bg-[#6b7280]/10" },
                    { value: "in_progress", label: "In Progress",  cls: "border-[#3b82f6]/40 text-[#3b82f6] bg-[#3b82f6]/10" },
                    { value: "finish_today",label: "Finish Today", cls: "border-primary/40 text-primary bg-primary/10" },
                    { value: "done",        label: "Done",         cls: "border-[#10b981]/40 text-[#10b981] bg-[#10b981]/10" },
                  ] as const).map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setListStatusFilter(f.value as any)}
                      className={cn(
                        "rounded-sm border px-2 py-0.5 text-[10px] tracking-wide uppercase transition-colors",
                        listStatusFilter === f.value
                          ? f.cls + " font-semibold"
                          : "border-border bg-transparent text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {boardTasks.filter((t) => {
                      if (myUserId && t.assignedTo && t.assignedTo !== myUserId) return false
                      if (listStatusFilter === "all") return true
                      if (listStatusFilter === "finish_today") return t.status === "in_progress" && t.dueDate === todayIso
                      return t.status === listStatusFilter
                    }).length} tasks
                  </span>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_110px_90px_80px] px-3 py-2 text-[10px] tracking-widest text-muted-foreground uppercase border-b border-border">
                  <div>Task</div>
                  <div>Status</div>
                  <div>Priority</div>
                  <div>Due</div>
                </div>

                {/* Rows */}
                {(() => {
                  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
                    todo:        { label: "Not Started",  cls: "border-[#6b7280]/30 bg-[#6b7280]/10 text-[#6b7280]" },
                    in_progress: { label: "In Progress",  cls: "border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]" },
                    finish_today:{ label: "Finish Today", cls: "border-primary/30 bg-primary/10 text-primary" },
                    done:        { label: "Done",         cls: "border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]" },
                    blocked:     { label: "Delegated",    cls: "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]" },
                  }
                  const filtered = boardTasks.filter((t) => {
                    if (myUserId && t.assignedTo && t.assignedTo !== myUserId) return false
                    if (listStatusFilter === "all") return true
                    if (listStatusFilter === "finish_today") return t.status === "in_progress" && t.dueDate === todayIso
                    return t.status === listStatusFilter
                  })
                  if (filtered.length === 0) {
                    return (
                      <div className="px-3 py-6 text-center text-xs text-muted-foreground italic">
                        No tasks match this filter.
                      </div>
                    )
                  }
                  return filtered.map((t) => {
                    const colKey = mapToBoardColumn(t, todayIso, myUserId)
                    const statusKey = colKey === "finish_today" ? "finish_today" : t.status
                    const badge = STATUS_BADGE[statusKey] ?? STATUS_BADGE.todo
                    const pri = priorityPill(t.priority)
                    const isOverdue = t.dueDate && t.dueDate < todayIso && t.status !== "done"
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => openTask(t)}
                        className={cn(
                          "grid w-full grid-cols-[1fr_110px_90px_80px] items-center border-t border-border px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors",
                          t.status === "done" && "opacity-60",
                        )}
                      >
                        <div className={cn("text-sm truncate", t.status === "done" ? "line-through text-muted-foreground" : "text-foreground")}>
                          {t.title}
                        </div>
                        <div>
                          <span className={cn("rounded-sm border px-1.5 py-0.5 text-[9px] tracking-wide uppercase", badge.cls)}>
                            {badge.label}
                          </span>
                        </div>
                        <div>
                          <span className={cn("rounded-sm border px-1.5 py-0.5 text-[10px] tracking-wide uppercase", pri.className)}>
                            {pri.label}
                          </span>
                        </div>
                        <div className={cn("text-[10px] tabular-nums", isOverdue ? "text-error" : "text-muted-foreground")}>
                          {formatDue(t.dueDate)}
                        </div>
                      </button>
                    )
                  })
                })()}
              </div>
            ) : (
              <KanbanBoard
                grouped={grouped}
                todayIso={todayIso}
                myUserId={myUserId}
                people={people}
                onOpenTask={openTask}
                onNewTask={openCreate}
                onMoveTask={handleMoveTask}
              />
            )}
          </div>

          {/* Right: Delegated — Follow Up */}
          <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-3">
              <div className="text-xs tracking-widest font-semibold text-foreground uppercase whitespace-nowrap">
                Delegated — Follow Up
              </div>
              {followUpList.length > 0 && (
                <div className="flex items-center gap-1.5 ml-auto shrink-0">
                  {followUpList.filter((x) => x.task.priority === "urgent").length > 0 && (
                    <span className="rounded-sm border border-error/25 bg-error/8 px-1.5 py-0.5 text-[9px] tracking-wide text-error uppercase">
                      {followUpList.filter((x) => x.task.priority === "urgent").length} urgent
                    </span>
                  )}
                  {followUpList.filter((x) => x.task.dueDate && x.task.dueDate < todayIso && x.task.status !== "done").length > 0 && (
                    <span className="rounded-sm border border-warning/25 bg-warning/8 px-1.5 py-0.5 text-[9px] tracking-wide text-warning uppercase">
                      {followUpList.filter((x) => x.task.dueDate && x.task.dueDate < todayIso && x.task.status !== "done").length} overdue
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              {followUpList.length === 0 ? (
                <div className="px-4 py-6 text-xs text-muted-foreground italic">No delegated tasks.</div>
              ) : (
                followUpList.map(({ task, label: _label, isFresh }) => {
                  const assignee = people.find((p) => p.id === task.assignedTo)
                  const assigneeName = assignee?.full_name || assignee?.email || "Unknown"
                  const assigneeFirst = assigneeName.split(" ")[0]
                  const assigneeInitials = assigneeName
                    .split(" ").filter(Boolean).slice(0, 2)
                    .map((x: string) => x[0]).join("").toUpperCase() || "?"
                  const cat = task.category || "general"
                  const isOverdue = task.dueDate && task.dueDate < todayIso && task.status !== "done"
                  const isDone = task.status === "done"

                  // Left accent colour by urgency
                  const accentCls = isDone
                    ? "border-l-[#10b981]"
                    : isOverdue
                    ? "border-l-[#ef4444]"
                    : task.priority === "urgent"
                    ? "border-l-[#ef4444]"
                    : isFresh
                    ? "border-l-[#3b82f6]"
                    : "border-l-border"

                  // Badge config
                  const badge = isDone
                    ? { label: "✓ Done",    cls: "border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]" }
                    : isOverdue
                    ? { label: `↑ Overdue ${Math.round((new Date(todayIso).getTime() - new Date(task.dueDate!).getTime()) / 86400000)}d`, cls: "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]" }
                    : task.dueDate === todayIso
                    ? { label: "🔥 Today",  cls: "border-primary/30 bg-primary/10 text-primary" }
                    : isFresh
                    ? { label: "↑ Today",   cls: "border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]" }
                    : { label: "This Week", cls: "border-border bg-secondary text-muted-foreground" }

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => openTask(task)}
                      className={cn(
                        "w-full text-left flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0",
                        "border-l-[3px] transition-colors hover:bg-secondary/40",
                        accentCls,
                        isDone && "opacity-60",
                      )}
                    >
                      {/* Check circle */}
                      <div className={cn(
                        "shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center",
                        isDone ? "border-[#10b981] bg-[#10b981]" : "border-border",
                      )}>
                        {isDone && <span className="text-white text-[10px]">✓</span>}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm font-medium leading-snug truncate", isDone ? "line-through text-muted-foreground" : "text-foreground")}>
                          {task.title}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span>Assigned:</span>
                          {/* Assignee avatar */}
                          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/20 text-[7px] font-bold text-primary">
                            {assigneeInitials}
                          </span>
                          <span>{assigneeFirst}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="capitalize">{cat}</span>
                        </div>
                      </div>

                      {/* Right badge */}
                      <span className={cn(
                        "shrink-0 rounded-sm border px-1.5 py-0.5 text-[9px] tracking-wide uppercase whitespace-nowrap",
                        badge.cls,
                      )}>
                        {badge.label}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Tonight's revenue */}
      <Dialog open={tonightEditOpen} onOpenChange={setTonightEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tonight’s revenue (manual)</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">VND amount</div>
            <input
              inputMode="numeric"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. 42500000"
              value={tonightDraft}
              onChange={(e) => setTonightDraft(e.target.value)}
            />
            <div className="text-sm text-muted-foreground">
              Saved per date ({todayIso}). Display uses compact format (e.g., 42.5M).
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTonightEditOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={upsertDailyInput.isPending}
              onClick={async () => {
                const cleaned = tonightDraft.replace(/[^\d.-]/g, "")
                const value = Number(cleaned || 0)
                await upsertDailyInput.mutateAsync({ date: todayIso, tonightsRevenue: value })
                setTonightEditOpen(false)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit monthly PAX target */}
      <Dialog open={paxTargetEditOpen} onOpenChange={setPaxTargetEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Monthly pax target</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Target for {new Date(`${periodStartIso}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </div>
            <input
              inputMode="numeric"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. 1200"
              value={paxTargetDraft}
              onChange={(e) => setPaxTargetDraft(e.target.value)}
            />
            <div className="text-sm text-muted-foreground">
              Number of guests (pax) targeted for this month.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaxTargetEditOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={upsertMonthlyTarget.isPending}
              onClick={async () => {
                const value = Number(paxTargetDraft.replace(/[^\d.-]/g, "") || 0)
                if (value > 0) {
                  await upsertMonthlyTarget.mutateAsync({ metric: "pax", periodStartIso, value })
                }
                setPaxTargetEditOpen(false)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Week at a glance */}
      <div className="space-y-3">
        <SectionTitle label="WEEK AT A GLANCE" />
        <div className="grid gap-3 lg:grid-cols-7">
          {weekDates.map((d) => {
            const row = weekByDate.get(d.iso)
            const isToday = d.iso === todayIso
            const isClub = (row?.mode || "").toLowerCase().includes("club")
              || d.day === "THU" || d.day === "FRI" || d.day === "SAT"

            // Calendar events for this day sorted by start time
            const dayEvents = (roofEvents || [])
              .filter((e) => e.dateIso === d.iso && e.eventName)
              .slice()
              .sort((a, b) => (a.startMinutes ?? 999999) - (b.startMinutes ?? 999999))

            // DJ lines from aggregated data
            const djLines = row?.djLines || []

            // Tasks / meetings due this day
            const dayTasks = (allTasks || []).filter(
              (t) => t.dueDate === d.iso && t.status !== "done" && t.status !== "cancelled",
            )

            return (
              <div
                key={d.iso}
                className={cn(
                  "rounded-card border border-border bg-card shadow-card relative overflow-hidden",
                  isToday && "border-primary/30 bg-gradient-to-b from-primary/[0.04] to-card",
                  isClub && !isToday && "border-t-2 border-t-primary/35",
                )}
              >
                {/* Header row: day name left, date number right */}
                <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-border">
                  <div className="text-xs tracking-widest font-semibold text-foreground uppercase leading-none">{d.day}</div>
                  <div className={cn(
                    "font-display text-[18px] leading-none tracking-[1px]",
                    isToday ? "text-primary" : "text-foreground",
                  )}>
                    {d.dateNum}
                  </div>
                </div>

                {/* Content rows */}
                <div className="px-3 py-2 space-y-1.5 min-h-[60px]">
                  {weekCsvLoading ? (
                    <div className="text-xs text-muted-foreground">Loading…</div>
                  ) : weekCsvError ? (
                    <div className="text-xs text-warning">Unable to load.</div>
                  ) : (
                    <>
                      {/* Event names — primary/gold */}
                      {dayEvents.map((e) => (
                        <div
                          key={`${e.eventName}-${e.startTime}`}
                          className={cn(
                            "text-xs leading-snug truncate",
                            isToday ? "text-primary" : "text-primary/80",
                          )}
                        >
                          {e.eventName}
                          {e.startTime ? ` ${e.startTime}` : ""}
                        </div>
                      ))}

                      {/* DJ lines — secondary foreground */}
                      {djLines.map((line) => (
                        <div key={line} className="text-xs leading-snug truncate text-secondary-foreground">
                          {line}
                        </div>
                      ))}

                      {/* Tasks / meetings — muted */}
                      {dayTasks.map((t) => (
                        <div key={t.id} className="text-xs leading-snug truncate text-muted-foreground">
                          {t.dueTime ? `${t.dueTime} ` : ""}{t.title}
                        </div>
                      ))}

                      {/* Empty state */}
                      {dayEvents.length === 0 && djLines.length === 0 && dayTasks.length === 0 && (
                        <div className="text-xs text-muted-foreground/50 italic">—</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pipeline + Promotions section */}
      <div className="space-y-4">
        <SectionTitle label="THIS WEEK" />

        {/* This week's pipeline — full width */}
        <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="text-base font-medium text-foreground">This Week's Pipeline</div>
        </div>

        {/* Column headers */}
        <div className="hidden lg:grid lg:grid-cols-[1.6fr_1fr_1fr_1.2fr_1.6fr] gap-4 px-5 py-2.5 border-b border-border">
          <div className="text-xs tracking-widest font-semibold text-foreground uppercase">Event</div>
          <div className="text-xs tracking-widest font-semibold text-foreground uppercase">DJ 1</div>
          <div className="text-xs tracking-widest font-semibold text-foreground uppercase">DJ 2</div>
          <div className="text-xs tracking-widest font-semibold text-foreground uppercase">Genre</div>
          <div className="text-xs tracking-widest font-semibold text-foreground uppercase">Promotion</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {pipelineRows.map((row, idx) => (
            <div
              key={`${row.iso}-${idx}`}
              className={cn(
                "relative grid grid-cols-1 gap-y-1 gap-x-4 px-5 py-3.5 lg:grid-cols-[1.6fr_1fr_1fr_1.2fr_1.6fr] lg:items-center",
                row.isToday && "bg-gradient-to-r from-primary/[0.04] to-transparent",
              )}
            >
              {/* Event + date */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "text-sm leading-snug truncate",
                    row.event === "TBD" ? "text-muted-foreground italic" : "text-foreground font-medium",
                  )}>
                    {row.event}
                  </div>
                  {row.isToday && (
                    <span className="shrink-0 rounded-sm border border-primary/25 bg-primary/8 px-1.5 py-0.5 text-[10px] tracking-[1.5px] text-primary uppercase">
                      Today
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground truncate">{row.when}</div>
              </div>

              {/* DJ 1 */}
              <div className="min-w-0">
                <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-0.5 lg:hidden">DJ 1</div>
                <div className={cn("text-xs truncate", row.dj1 === "—" ? "text-muted-foreground/40" : "text-secondary-foreground")}>{row.dj1}</div>
              </div>

              {/* DJ 2 */}
              <div className="min-w-0">
                <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-0.5 lg:hidden">DJ 2</div>
                <div className={cn("text-xs truncate", row.dj2 === "—" ? "text-muted-foreground/40" : "text-secondary-foreground")}>{row.dj2}</div>
              </div>

              {/* Genre */}
              <div className="min-w-0">
                <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-0.5 lg:hidden">Genre</div>
                <div className={cn("text-xs truncate", row.genre === "—" ? "text-muted-foreground/40" : "text-secondary-foreground")}>{row.genre}</div>
              </div>

              {/* Promotion */}
              <div className="min-w-0">
                <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-0.5 lg:hidden">Promotion</div>
                <div className={cn("text-xs", row.promo === "—" ? "text-muted-foreground/40" : "text-secondary-foreground")}>{row.promo}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Promotions — two-row bento layout */}
      {(() => {
        const fixedPromos = [
          {
            dayKey: "MON",
            name: "Up in Smoke Mondays",
            hours: "18:00 – 20:00",
            deal: "Free signature cocktail with any premium / special shisha purchase",
          },
          {
            dayKey: "TUE",
            name: "Date Night Tuesdays",
            hours: "18:00 – 20:00",
            deal: "Free fruit platter (250K) with date night combo — 1 Pizza & 2 cocktails for 675K",
          },
          {
            dayKey: "WED",
            name: "Chill & Flow Wednesdays",
            hours: "18:00 – 20:00",
            deal: "Free premium tea with any special shisha + 30% off your second shisha",
          },
          {
            dayKey: "THU",
            name: "Lovers & Friends Thursdays",
            hours: "18:00 – 20:00",
            deal: "Free premium shisha with a spend over 2,000,000 VND",
          },
          {
            dayKey: "FRI",
            name: "We Outside Fridays",
            hours: "18:00 – 20:00",
            deal: "Free cocktail jug with a spend over 1,500,000 VND",
          },
          {
            dayKey: "SAT",
            name: "Good Vibes Only Saturdays",
            hours: "18:00 – 20:00",
            deal: "Free special shisha with a spend over 3,000,000 VND",
          },
          {
            dayKey: "SUN",
            name: "Sunset & Slow Down Sundays",
            hours: "18:00 – 20:00",
            deal: "20% off all signature cocktails",
          },
        ]

        const DAY_FULL: Record<string, string> = {
          MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday",
          FRI: "Friday", SAT: "Saturday", SUN: "Sunday",
        }

        const happyHourItems = [
          { icon: "🍹", label: "Buy 1 Get 1", sub: "Happy hour menu" },
          { icon: "🍵", label: "Free Tea", sub: "With any special shisha" },
          { icon: "🍸", label: "Cocktail Set", sub: "6 best-sellers — 399K" },
          { icon: "🌧", label: "20% Off Shisha", sub: "Rainy day special" },
        ]

        const promoRows = fixedPromos.map((p) => {
          const wd = weekDates.find((d) => d.day === p.dayKey)
          return { ...p, iso: wd?.iso ?? "", isToday: wd?.iso === todayIso }
        })

        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-xs font-medium tracking-widest text-muted-foreground uppercase whitespace-nowrap">
                This Week's Promotions
              </div>
              <span className="rounded-sm px-2 py-0.5 text-xs tracking-wide bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                8 active
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Row 1 — Daily Happy Hour hero */}
            <div className="rounded-lg border border-primary/20 bg-primary/[0.03] shadow-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-primary/15">
                <div className="text-sm font-semibold text-foreground">Daily Happy Hour</div>
                <span className="rounded-sm border border-primary/25 bg-primary/8 px-2 py-0.5 text-[10px] tracking-widest text-primary uppercase">Every day</span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">14:00 – 18:00</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-primary/10">
                {happyHourItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-3 px-5 py-4">
                    <span className="text-2xl shrink-0">{item.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-foreground leading-tight">{item.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 2 — Day-specific promos, uniform 7-card grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {promoRows.map((p) => (
                <div
                  key={p.dayKey}
                  className={cn(
                    "rounded-lg border bg-card shadow-card flex flex-col p-4",
                    p.isToday
                      ? "border-primary bg-gradient-to-b from-primary/[0.06] to-card"
                      : "border-border",
                  )}
                >
                  {/* Day name + Today badge */}
                  <div className="flex items-center justify-between mb-2">
                    <div className={cn(
                      "text-[10px] tracking-widest font-semibold uppercase",
                      p.isToday ? "text-primary" : "text-muted-foreground",
                    )}>
                      {DAY_FULL[p.dayKey]}
                    </div>
                    {p.isToday && (
                      <span className="rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] tracking-[1.5px] text-primary uppercase leading-none">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Promotion title */}
                  <div className="text-xs font-semibold text-foreground leading-snug mb-3 flex-1">
                    {p.name}
                  </div>

                  {/* Offer text */}
                  <div className={cn(
                    "rounded-md border px-2.5 py-2 text-xs text-secondary-foreground leading-snug mb-3",
                    p.isToday ? "border-primary/20 bg-primary/[0.05]" : "border-primary/15 bg-primary/[0.04]",
                  )}>
                    {p.deal}
                  </div>

                  {/* Time */}
                  <div className="text-[10px] text-muted-foreground tabular-nums">{p.hours}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Who We Are + Identity + Targets */}
      <div className="flex items-center gap-3">
        <div className="text-xs font-medium tracking-widest text-muted-foreground uppercase whitespace-nowrap">
          The Roof — Club &amp; Lounge
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr_0.5fr]">

        {/* Card 1: The Roof — Who We Are */}
        <div className="rounded-card border border-border bg-card px-6 py-5 shadow-card">
          <div className="font-display text-lg tracking-[3px] text-foreground mb-5">The Roof — Who We Are</div>
          <div className="space-y-5">
            <div>
              <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-2">Company</div>
              <p className="text-sm font-body text-secondary-foreground leading-relaxed">
                Da Nang's beachside rooftop destination, transforming from a stylish sunset lounge into a vibrant dancefloor after dark. Inspired by the warm, exotic atmosphere of Marrakech, we offer an unforgettable rooftop experience above My Khe Beach.
              </p>
              <p className="mt-2 text-sm font-body text-secondary-foreground leading-relaxed">
                Located on the third floor with panoramic ocean views. Live DJs every Wednesday–Saturday, creating the perfect balance between laid-back afternoons and high-energy nights.
              </p>
              <p className="mt-2 text-sm font-body text-secondary-foreground leading-relaxed">
                Known for premium cocktails, curated music, and one of the best shisha experiences in Da Nang — the go-to spot for sunset drinks, social nights, and an international crowd.
              </p>
            </div>
            <div>
              <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-1.5">Niche</div>
              <p className="text-sm font-body text-secondary-foreground leading-relaxed">
                A unique blend of global influences creating an international atmosphere that brings people together — bridging the gap between east and west. A relaxing, inviting space where the music doesn't blow your head off.
              </p>
            </div>
            <div>
              <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-2">Three Uniques</div>
              <ol className="space-y-2 text-sm font-body text-secondary-foreground">
                <li>
                  <span className="text-foreground font-medium">① Our View</span>
                  <span className="text-muted-foreground"> — </span>
                  Panoramic views of My Khe Beach. Perfect for sunset evenings and relaxing nights in paradise.
                </li>
                <li>
                  <span className="text-foreground font-medium">② The Atmosphere</span>
                  <span className="text-muted-foreground"> — </span>
                  Laidback, relaxing, genuine and unique — including the events.
                </li>
                <li>
                  <span className="text-foreground font-medium">③ The Offerings</span>
                  <span className="text-muted-foreground"> — </span>
                  High quality shisha, refreshing cocktails at a reasonable price, attractive promotions and good food.
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Card 2: Identity */}
        <div className="rounded-card border border-border bg-card px-6 py-5 shadow-card">
          <div className="font-display text-lg tracking-[3px] text-foreground mb-5">Identity</div>
          <div className="space-y-5">
            <div>
              <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-1.5">Vision</div>
              <p className="text-sm font-light italic text-secondary-foreground leading-relaxed">
                We aim to become a melting pot of culture, where diverse backgrounds, ideas, and experiences come together to create a vibrant, inclusive space. We celebrate the richness of different cultures and believe in the power of unity through shared experiences and connection.
              </p>
            </div>
            <div>
              <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-3">Values</div>
              <div className="space-y-3">
                {[
                  { name: "Fun & Positive", desc: "We bring a fun and positive energy to everything we do." },
                  { name: "Down to Earth", desc: "We embrace freedom of expression and show up as our true selves." },
                  { name: "Teamwork", desc: "We are a team of service-oriented individuals focused on guests' needs, working hard and lifting each other up." },
                  { name: "Attitude", desc: "We are individuals with a growth mindset, always striving to improve and evolve." },
                  { name: "Care", desc: "We genuinely prioritize the comfort and wellbeing of our guests, venue, partners and team." },
                ].map((v) => (
                  <div key={v.name} className="flex gap-2">
                    <span className="rounded-full border border-primary/25 bg-primary/8 px-2.5 py-0.5 text-xs text-primary shrink-0 h-fit mt-0.5">{v.name}</span>
                    <p className="text-xs text-secondary-foreground leading-relaxed">{v.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Targets */}
        <div className="rounded-card border border-border bg-card px-6 py-5 shadow-card">
          <div className="font-display text-lg tracking-[3px] text-foreground mb-5">Targets</div>
          <div className="space-y-5">
            {[
              {
                label: "10 Year Target",
                year: "2035",
                items: [
                  "6,000 Monthly pax (avg)",
                  "2.0B VND revenue / month (avg)",
                  "25B VND for the year",
                  "9B VND in profits",
                  "35% Net profit target",
                ],
              },
              {
                label: "3 Year Target",
                year: "2028",
                items: [
                  "4,250 Monthly pax (avg)",
                  "1.5B VND revenue / month (avg)",
                  "18B VND for the year",
                  "6B VND in profits",
                  "35% Net profit target",
                ],
              },
              {
                label: "1 Year Target",
                year: "2026",
                items: [
                  "2,500 Monthly pax (avg)",
                  "1.0B VND revenue / month (avg)",
                  "9B VND for the year",
                  "3B VND in profits",
                  "30% Net profit target",
                ],
              },
            ].map((target, i) => (
              <div key={target.year} className={cn(i > 0 ? "border-t border-border pt-5" : "")}>
                <div className="flex items-baseline gap-2 mb-2">
                  <div className="text-xs tracking-widest font-semibold text-foreground uppercase">{target.label}</div>
                  <div className="text-xs text-primary border border-primary/25 bg-primary/8 rounded-sm px-1.5 py-0.5">{target.year}</div>
                </div>
                <ul className="space-y-1">
                  {target.items.map((item) => (
                    <li key={item} className="flex items-start gap-1.5 text-xs text-secondary-foreground">
                      <span className="mt-[3px] h-1 w-1 rounded-full bg-primary/50 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>


      {/* ── Task detail sheet (Notion style) ── */}
      <Sheet
        open={taskSheetOpen}
        onOpenChange={(open) => {
          setTaskSheetOpen(open)
          if (!open) setSelectedTaskId(null)
        }}
      >
        <SheetContent side="right" className="sm:max-w-[540px] p-0 flex flex-col gap-0 overflow-hidden">
          {selectedTask ? (
            <>
              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-8 pt-10 pb-6 space-y-6">
                {/* Large editable title */}
                <textarea
                  rows={2}
                  className="w-full resize-none bg-transparent text-2xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 leading-snug"
                  placeholder="Untitled"
                  value={editDraft.title}
                  onChange={(e) => setEditDraft((s) => ({ ...s, title: e.target.value }))}
                />

                {taskError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {taskError}
                  </div>
                )}

                {/* Property rows — Notion style */}
                <div className="divide-y divide-border border border-border rounded-md overflow-hidden">

                  {/* Done / Check */}
                  <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                    <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>✓</span> Check
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditDraft((s) => ({ ...s, status: s.status === "done" ? "todo" : "done" }))}
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                          editDraft.status === "done"
                            ? "border-[#10b981] bg-[#10b981]"
                            : "border-border hover:border-[#10b981]/60",
                        )}
                      >
                        {editDraft.status === "done" && (
                          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      {editDraft.status === "done" && (
                        <span className="text-[10px] text-[#10b981] tracking-wide">Marked as done</span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                    <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>◎</span> Status
                    </div>
                    <div className="flex-1 flex flex-wrap gap-1.5 py-2">
                      {[
                        { value: "todo",        label: "Not Started", color: "bg-[#6b7280]/15 text-[#6b7280] border-[#6b7280]/25" },
                        { value: "in_progress", label: "In Progress", color: "bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/25" },
                        { value: "finish_today", label: "Finish Today", color: "bg-primary/15 text-primary border-primary/25" },
                        { value: "blocked",     label: "Delegated",   color: "bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/25" },
                        { value: "done",        label: "Done",        color: "bg-[#10b981]/15 text-[#10b981] border-[#10b981]/25" },
                      ].map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => {
                            if (s.value === "finish_today") {
                              setEditDraft((d) => ({ ...d, status: "in_progress" as TaskStatus, dueDate: todayIso }))
                            } else {
                              setEditDraft((d) => ({ ...d, status: s.value as TaskStatus }))
                            }
                          }}
                          className={cn(
                            "rounded-sm border px-2 py-0.5 text-[10px] tracking-wide transition-all",
                            (s.value === "finish_today"
                              ? editDraft.status === "in_progress" && editDraft.dueDate === todayIso
                              : editDraft.status === s.value)
                              ? s.color + " font-semibold"
                              : "border-border bg-transparent text-muted-foreground hover:bg-secondary",
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Day */}
                  <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                    <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>📅</span> Day
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      <input
                        type="date"
                        className="bg-transparent text-sm text-foreground outline-none cursor-pointer"
                        value={editDraft.dueDate}
                        onChange={(e) => setEditDraft((s) => ({ ...s, dueDate: e.target.value }))}
                      />
                      {editDraft.dueDate && (
                        <input
                          type="time"
                          className="bg-transparent text-xs text-muted-foreground outline-none"
                          value={editDraft.dueTime}
                          onChange={(e) => setEditDraft((s) => ({ ...s, dueTime: e.target.value }))}
                        />
                      )}
                    </div>
                  </div>

                  {/* Category */}
                  <div className="flex items-start min-h-[40px] px-4 py-2 hover:bg-secondary/40 transition-colors">
                    <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground pt-1">
                      <span>🏷️</span> Category
                    </div>
                    <div className="flex-1 flex flex-wrap gap-1.5">
                      {CATEGORY_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setEditDraft((d) => ({ ...d, category: o.value }))}
                          className={cn(
                            "rounded-sm border px-2 py-0.5 text-[10px] tracking-wide transition-all",
                            editDraft.category === o.value
                              ? "border-primary/30 bg-primary/10 text-primary font-semibold"
                              : "border-border bg-transparent text-muted-foreground hover:bg-secondary",
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Assigned to */}
                  <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                    <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>👤</span> Assigned to
                    </div>
                    <div className="flex-1">
                      <select
                        className="w-full bg-transparent text-sm text-foreground outline-none cursor-pointer"
                        value={editDraft.assignedTo}
                        onChange={(e) => setEditDraft((s) => ({ ...s, assignedTo: e.target.value }))}
                      >
                        <option value="">Select person…</option>
                        {people.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name || p.email || p.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                    <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>!</span> Priority
                    </div>
                    <div className="flex-1 flex gap-1.5">
                      {[
                        { value: "low",    label: "Low",    dot: "bg-[#6b7280]" },
                        { value: "medium", label: "Medium", dot: "bg-[#f59e0b]" },
                        { value: "high",   label: "High",   dot: "bg-[#f97316]" },
                        { value: "urgent", label: "Urgent", dot: "bg-[#ef4444]" },
                      ].map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setEditDraft((d) => ({ ...d, priority: p.value as any }))}
                          className={cn(
                            "flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] tracking-wide transition-all",
                            editDraft.priority === p.value
                              ? "border-border bg-secondary text-foreground font-semibold"
                              : "border-transparent bg-transparent text-muted-foreground hover:bg-secondary",
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground px-1">Description</div>
                  <textarea
                    rows={4}
                    className="w-full resize-none rounded-sm border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-border/80"
                    placeholder="Add a description…"
                    value={editDraft.description}
                    onChange={(e) => setEditDraft((s) => ({ ...s, description: e.target.value }))}
                  />
                </div>
              </div>

              {/* Fixed footer */}
              <div className="shrink-0 border-t border-border px-8 py-4 flex items-center justify-between gap-3 bg-card">
                <button
                  type="button"
                  disabled={deleteTask.isPending}
                  onClick={async () => {
                    setTaskError(null)
                    try {
                      await deleteTask.mutateAsync(selectedTask.id)
                      setTaskSheetOpen(false)
                      setSelectedTaskId(null)
                    } catch (e) {
                      setTaskError((e as Error)?.message || "Failed to delete")
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-error transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setTaskSheetOpen(false); setSelectedTaskId(null) }}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={updateTask.isPending || !editDraft.title.trim() || !editDraft.assignedTo}
                    onClick={async () => {
                      setTaskError(null)
                      try {
                        await updateTask.mutateAsync({
                          id: selectedTask.id,
                          title: editDraft.title.trim(),
                          description: editDraft.description.trim() || null,
                          dueDate: editDraft.dueDate || null,
                          dueTime: editDraft.dueTime || null,
                          category: editDraft.category,
                          status: editDraft.status,
                          priority: editDraft.priority as any,
                          assignedTo: editDraft.assignedTo || null,
                        } as any)
                        setTaskSheetOpen(false)
                        setSelectedTaskId(null)
                      } catch (e) {
                        setTaskError((e as Error)?.message || "Failed to save")
                      }
                    }}
                  >
                    Save changes
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* ── Create task sheet (Notion style) ── */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="sm:max-w-[540px] p-0 flex flex-col gap-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-8 pt-10 pb-6 space-y-6">

            {/* Large title input */}
            <textarea
              autoFocus
              rows={2}
              className="w-full resize-none bg-transparent text-2xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 leading-snug"
              placeholder="Untitled"
              value={createDraft.title}
              onChange={(e) => setCreateDraft((s) => ({ ...s, title: e.target.value }))}
            />

            {createError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {createError}
              </div>
            )}

            {/* Property rows */}
            <div className="divide-y divide-border border border-border rounded-md overflow-hidden">

              {/* Check */}
              <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>✓</span> Check
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateDraft((s) => ({ ...s, status: s.status === "done" ? "todo" : "done" }))}
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                      createDraft.status === "done"
                        ? "border-[#10b981] bg-[#10b981]"
                        : "border-border hover:border-[#10b981]/60",
                    )}
                  >
                    {createDraft.status === "done" && (
                      <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  {createDraft.status === "done" && (
                    <span className="text-[10px] text-[#10b981] tracking-wide">Marked as done</span>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>◎</span> Status
                </div>
                <div className="flex-1 flex flex-wrap gap-1.5 py-2">
                  {[
                    { value: "todo",         label: "Not Started", color: "bg-[#6b7280]/15 text-[#6b7280] border-[#6b7280]/25" },
                    { value: "in_progress",  label: "In Progress", color: "bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/25" },
                    { value: "finish_today", label: "Finish Today", color: "bg-primary/15 text-primary border-primary/25" },
                    { value: "blocked",      label: "Delegated",   color: "bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/25" },
                    { value: "done",         label: "Done",        color: "bg-[#10b981]/15 text-[#10b981] border-[#10b981]/25" },
                  ].map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => {
                        if (s.value === "finish_today") {
                          setCreateDraft((d) => ({ ...d, status: "in_progress" as TaskStatus, dueDate: todayIso }))
                        } else {
                          setCreateDraft((d) => ({ ...d, status: s.value as TaskStatus }))
                        }
                      }}
                      className={cn(
                        "rounded-sm border px-2 py-0.5 text-[10px] tracking-wide transition-all",
                        (s.value === "finish_today"
                          ? createDraft.status === "in_progress" && createDraft.dueDate === todayIso
                          : createDraft.status === s.value)
                          ? s.color + " font-semibold"
                          : "border-border bg-transparent text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day */}
              <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>📅</span> Day
                </div>
                <div className="flex-1 flex items-center gap-3">
                  <input
                    type="date"
                    className="bg-transparent text-sm text-foreground outline-none cursor-pointer"
                    value={createDraft.dueDate || ""}
                    onChange={(e) => setCreateDraft((s) => ({ ...s, dueDate: e.target.value }))}
                  />
                  {createDraft.dueDate && (
                    <input
                      type="time"
                      className="bg-transparent text-xs text-muted-foreground outline-none"
                      value={createDraft.dueTime || ""}
                      onChange={(e) => setCreateDraft((s) => ({ ...s, dueTime: e.target.value }))}
                    />
                  )}
                </div>
              </div>

              {/* Category */}
              <div className="flex items-start min-h-[40px] px-4 py-2 hover:bg-secondary/40 transition-colors">
                <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground pt-1">
                  <span>🏷️</span> Category
                </div>
                <div className="flex-1 flex flex-wrap gap-1.5">
                  {CATEGORY_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setCreateDraft((d) => ({ ...d, category: o.value }))}
                      className={cn(
                        "rounded-sm border px-2 py-0.5 text-[10px] tracking-wide transition-all",
                        createDraft.category === o.value
                          ? "border-primary/30 bg-primary/10 text-primary font-semibold"
                          : "border-border bg-transparent text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assigned to */}
              <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>👤</span> Assigned to
                </div>
                <div className="flex-1">
                  <select
                    className="w-full bg-transparent text-sm text-foreground outline-none cursor-pointer"
                    value={createDraft.assignedTo}
                    onChange={(e) => setCreateDraft((s) => ({ ...s, assignedTo: e.target.value }))}
                  >
                    <option value="">Select person…</option>
                    {people.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || p.email || p.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority */}
              <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>!</span> Priority
                </div>
                <div className="flex-1 flex gap-1.5">
                  {[
                    { value: "low",    label: "Low",    dot: "bg-[#6b7280]" },
                    { value: "medium", label: "Medium", dot: "bg-[#f59e0b]" },
                    { value: "high",   label: "High",   dot: "bg-[#f97316]" },
                    { value: "urgent", label: "Urgent", dot: "bg-[#ef4444]" },
                  ].map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setCreateDraft((d) => ({ ...d, priority: p.value as any }))}
                      className={cn(
                        "flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] tracking-wide transition-all",
                        (createDraft.priority || "medium") === p.value
                          ? "border-border bg-secondary text-foreground font-semibold"
                          : "border-transparent bg-transparent text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground px-1">Description</div>
              <textarea
                rows={4}
                className="w-full resize-none rounded-sm border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-border/80"
                placeholder="Add a description…"
                value={createDraft.description || ""}
                onChange={(e) => setCreateDraft((s) => ({ ...s, description: e.target.value }))}
              />
            </div>
          </div>

          {/* Fixed footer */}
          <div className="shrink-0 border-t border-border px-8 py-4 flex items-center justify-end gap-2 bg-card">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={createTask.isPending || !createDraft.title.trim() || !createDraft.assignedTo}
              onClick={async () => {
                setCreateError(null)
                try {
                  await createTask.mutateAsync({
                    ...createDraft,
                    title: createDraft.title.trim(),
                    description: createDraft.description?.trim() || undefined,
                    dueDate: createDraft.dueDate || undefined,
                    dueTime: createDraft.dueTime || undefined,
                    status: createDraft.status,
                  })
                  setCreateOpen(false)
                } catch (e) {
                  setCreateError((e as Error)?.message || "Failed to create task")
                }
              }}
            >
              Create task
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

