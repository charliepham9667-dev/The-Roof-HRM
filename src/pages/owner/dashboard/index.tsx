import { Fragment, useEffect, useMemo, useState, type ElementType } from "react"
import { useNavigate } from "react-router-dom"
import {
  Activity,
  AlertTriangle,
  BarChart2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Link2,
  Megaphone,
  Pencil,
  Sparkles,
  Trash2,
  Wallet,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Skeleton } from "@/components/ui/skeleton"
import { SectionTitle } from "@/components/ui/section-title"
import { useStaffList, useTodayShifts, isOnShiftNow } from "@/hooks/useShifts"
import { useGoogleReviews, useKPISummary, useRevenueLookbackDailySales, useRevenueVelocity } from "@/hooks/useDashboardData"
import {
  useExecutiveDashboardDailyInput,
  useMonthlyTarget,
  useUpsertExecutiveDashboardDailyInput,
  useUpsertMonthlyTarget,
} from "@/hooks/useExecutiveDashboardInputs"
import { useTodayPaxConfirmed, useReservationsCsv } from "@/hooks/useReservationsCsv"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useRoofCalendarWeekData } from "@/hooks/useWeekAtGlanceCsv"
import { useCreateMaintenanceTask } from "@/hooks/useMaintenanceTasks"
import { TaskDescriptionEditor, SubTodoListEditor } from "@/components/tasks"
import { AutomationStatusStrip } from "@/components/owner-dashboard/AutomationStatusStrip"

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

function getIctDateIso(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ICT_TZ }).formatToParts(now)
  const map = new Map(parts.map((p) => [p.type, p.value]))
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function getIsoWeekMeta(dateIso: string) {
  const [year, month, day] = dateIso.split("-").map(Number)
  const utcDate = new Date(Date.UTC(year, month - 1, day))
  const dayOfWeek = utcDate.getUTCDay() || 7 // Sunday => 7

  const thursday = new Date(utcDate)
  thursday.setUTCDate(utcDate.getUTCDate() + 4 - dayOfWeek)
  const isoYear = thursday.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)

  const weekStart = new Date(utcDate)
  weekStart.setUTCDate(utcDate.getUTCDate() - (dayOfWeek - 1))
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)

  const formatWeekDay = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: ICT_TZ,
    })

  return {
    week,
    isoYear,
    key: `${isoYear}-W${week}`,
    rangeLabel: `${formatWeekDay(weekStart)} – ${formatWeekDay(weekEnd)}`,
  }
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


function priorityPill(priority: string): { label: string; variant: "danger" | "warning" | "neutral" } {
  const p = String(priority || "").toLowerCase()
  if (p === "urgent" || p === "high") return { label: p.toUpperCase(), variant: "danger"  }
  if (p === "medium")                 return { label: "MEDIUM",        variant: "warning" }
  return                                     { label: "LOW",           variant: "neutral" }
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

function buildWeekDates(anchorIso: string) {
  const [y, m, d] = anchorIso.split("-").map(Number)
  const anchor = new Date(Date.UTC(y, m - 1, d))
  const dowMon0 = (anchor.getUTCDay() + 6) % 7
  const start = new Date(Date.UTC(y, m - 1, d - dowMon0))
  const dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(start)
    dt.setUTCDate(start.getUTCDate() + i)
    return { day: dayNames[i], dateNum: dt.getUTCDate(), iso: dt.toISOString().slice(0, 10) }
  })
}

function fmtWeekRange(dates: { iso: string; dateNum: number }[]) {
  const [, fm, fd] = dates[0].iso.split("-").map(Number)
  const [, lm, ld] = dates[6].iso.split("-").map(Number)
  const mo = (n: number) => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][n - 1]
  return `${mo(fm)} ${fd} – ${mo(lm)} ${ld}`
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
    <section className={cn("rounded-card border border-border bg-card shadow-card min-w-0 overflow-hidden", className)}>
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

function DashboardHeaderClock({ firstName }: { firstName: string }) {
  const [tick, setTick] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setTick(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const ict = useMemo(() => getIctParts(tick), [tick])
  const greeting = greetingFromHour(ict.hour)
  const dateString = `${ict.weekday.toUpperCase()}, ${ict.month.toUpperCase()} ${ict.day}, ${ict.year}`
  const showClubNight = isClubNight(ict.weekday)
  const modeLabel = showClubNight ? "Club Night" : "Lounge Day"
  const hoursLabel = showClubNight ? "Open 14:00 – 02:00" : "Open 14:00 – 01:00"

  return (
    <div className="rounded-card border border-border bg-card px-4 md:px-6 py-4 shadow-card">
      <div className="flex flex-col gap-2 md:grid md:grid-cols-3 md:items-center md:gap-4">
        <div>
          <div className="font-display text-xl tracking-[4px] text-primary">THE ROOF</div>
          <div className="mt-0.5 text-sm font-light tracking-widest text-muted-foreground">
            Da Nang · Club & Lounge
          </div>
        </div>

        <div className="md:text-center">
          <div className="text-xs tracking-widest text-muted-foreground uppercase truncate">
            {dateString}
          </div>
          <div className="mt-1 font-subheading text-base md:text-lg font-light italic text-foreground">
            {greeting}, {firstName}
          </div>
        </div>

        <div className="flex items-center gap-3 md:justify-end">
          <div className="text-xs tracking-wide text-muted-foreground">{hoursLabel}</div>
          <div className="rounded-sm border border-border px-3 py-1 text-xs tracking-widest font-semibold text-foreground uppercase shrink-0">
            {modeLabel.toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  )
}

function HqClockPanel() {
  const [tick, setTick] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setTick(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const ict = useMemo(() => getIctParts(tick), [tick])
  const timeString = `${pad2(ict.hour)}:${pad2(ict.minute)}:${pad2(ict.second)}`

  return (
    <div className="grid gap-4 overflow-hidden">
      <AnalogClock hour={ict.hour} minute={ict.minute} second={ict.second} />
      <div className="text-center overflow-hidden">
        <div className="font-display text-[22px] sm:text-[26px] tracking-[2px] sm:tracking-[4px] text-foreground truncate">{timeString}</div>
        <div className="mt-1 text-xs tracking-wider text-muted-foreground uppercase truncate">
          ICT · UTC+7
        </div>
      </div>
    </div>
  )
}

export default function OwnerDashboardPage() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const firstName = (profile?.fullName || "Charlie").split(" ")[0] || "Charlie"

  const [todayIso, setTodayIso] = useState(() => getIctDateIso(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setTodayIso(getIctDateIso(new Date())), 60_000)
    return () => window.clearInterval(id)
  }, [])
  const now = new Date()

  const periodStartIso = `${todayIso.slice(0, 7)}-01`
  const [salesRange, setSalesRange] = useState<3 | 7 | 14 | 30>(7)
  const { data: kpi, isLoading: kpiLoading } = useKPISummary()
  const { data: velocity, isLoading: velocityLoading } = useRevenueVelocity()
  const { data: revenueLookback, isLoading: revenueLookbackLoading } = useRevenueLookbackDailySales()
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

  const createMaintenanceTask = useCreateMaintenanceTask()
  const [rainTaskState, setRainTaskState] = useState<'idle' | 'saving' | 'done'>('idle')

  const { data: roofCalendar, isLoading: weekCsvLoading, error: weekCsvError } = useRoofCalendarWeekData()
  const weekCsv = roofCalendar?.byDate ?? []
  const roofEvents = roofCalendar?.events ?? []
  const weekByDate = useMemo(() => {
    const map = new Map<string, (typeof weekCsv)[number]>()
    for (const x of weekCsv || []) map.set(x.dateIso, x)
    return map
  }, [weekCsv])

  const [weekOffset, setWeekOffset] = useState(0)
  const isCurrentWeek = weekOffset === 0

  const weekDates = useMemo(() => {
    const base = buildWeekDates(todayIso)
    if (weekOffset === 0) return base
    const [y, m, d] = base[0].iso.split("-").map(Number)
    const shifted = new Date(Date.UTC(y, m - 1, d + weekOffset * 7))
    return buildWeekDates(shifted.toISOString().slice(0, 10))
  }, [todayIso, weekOffset])

  const pipelineRows = useMemo(() => {
    const byDate = new Map<string, typeof roofEvents>()
    for (const e of roofEvents || []) {
      if (!e.dateIso) continue
      const list = byDate.get(e.dateIso) || []
      list.push(e)
      byDate.set(e.dateIso, list)
    }
    const rows: Array<{
      iso: string; day: string; dateNum: number; isToday: boolean; isFirstForDay: boolean;
      event: string; when: string; dj1: string; dj2: string; genre: string; promo: string;
    }> = []
    for (const d of weekDates) {
      const dayEvents = (byDate.get(d.iso) || [])
        .filter((e) => e.eventName)
        .slice()
        .sort((a, b) => (a.startMinutes ?? 999999) - (b.startMinutes ?? 999999))
      const isToday = d.iso === todayIso && isCurrentWeek
      if (dayEvents.length === 0) {
        rows.push({ iso: d.iso, day: d.day, dateNum: d.dateNum, isToday, isFirstForDay: true, event: "TBD", when: formatPipelineWhen(d.iso, null, null), dj1: "—", dj2: "—", genre: "—", promo: "—" })
      } else {
        dayEvents.forEach((ev, i) => {
          rows.push({
            iso: d.iso, day: d.day, dateNum: d.dateNum, isToday, isFirstForDay: i === 0,
            event: ev.eventName ?? "—",
            when: formatPipelineWhen(d.iso, ev.startTime, ev.endTime),
            dj1: ev.dj1 || "—", dj2: ev.dj2 || "—",
            genre: ev.genre || "—", promo: ev.promotion || "—",
          })
        })
      }
    }
    return rows
  }, [roofEvents, weekDates, todayIso, isCurrentWeek])

  const { data: allTasks = [], isLoading: tasksLoading, isError: tasksError, refetch: refetchTasks } = useAllDelegationTasks([
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
    subTodos: [] as import("@/types").SubTodo[],
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
      subTodos: selectedTask.subTodos ?? [],
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
    subTodos: [],
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
      subTodos: [],
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
    <div className="space-y-6 min-w-0 w-full">
      {/* Header */}
      <DashboardHeaderClock firstName={firstName} />

      {/* Automation status — one glance: sheet sync, RLS audit, open alerts */}
      <AutomationStatusStrip />

      {/* Owner quick actions — optimized for daily operating rhythm */}
      <div className="rounded-card border border-border bg-card p-3 shadow-card">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Quick Actions</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => navigate("/finance/summary")}
            className="flex items-center justify-between rounded-sm border border-border bg-background px-3 py-2 text-sm hover:bg-secondary"
          >
            <span className="inline-flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Log Cash
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => navigate("/finance/debt")}
            className="flex items-center justify-between rounded-sm border border-border bg-background px-3 py-2 text-sm hover:bg-secondary"
          >
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Log Debt
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => navigate("/operations")}
            className="flex items-center justify-between rounded-sm border border-border bg-background px-3 py-2 text-sm hover:bg-secondary"
          >
            <span className="inline-flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Open Operations
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => navigate("/marketing/integrations")}
            className="flex items-center justify-between rounded-sm border border-border bg-background px-3 py-2 text-sm hover:bg-secondary"
          >
            <span className="inline-flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              Open Integrations
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* HQ row */}
      <div className="grid gap-4 w-full min-w-0 md:grid-cols-2 lg:grid-cols-[320px_1fr]">
        <CardShell title="HQ — DA NANG" icon={<Activity className="h-4 w-4" />}>
          <HqClockPanel />
        </CardShell>

        <CardShell title="DA NANG — WEATHER" icon={<CalendarClock className="h-4 w-4" />}>
          <div className="flex flex-col sm:flex-row items-stretch gap-0">
            {/* Current conditions */}
            <div className="min-w-0 sm:border-r border-b sm:border-b-0 border-border sm:pr-6 pb-4 sm:pb-0">
              <div className="flex items-center gap-3">
                <div className="text-[32px]">🌤</div>
                <div className="font-display text-[34px] sm:text-[44px] leading-none tracking-[2px] text-foreground">27°</div>
              </div>
              <div className="mt-2 text-xs text-secondary-foreground tracking-wide">Broken Clouds · Humidity 78%</div>

              <div className="mt-3 rounded-sm border border-info/15 bg-info/8 px-2.5 py-1.5 text-xs text-info">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Zap className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 break-words">Rain expected Saturday — prep covers & heaters by 13:00</span>
                </div>
                <button
                  disabled={rainTaskState !== 'idle'}
                  onClick={async () => {
                    setRainTaskState('saving')
                    try {
                      await createMaintenanceTask.mutateAsync({
                        title: 'Prep covers & heaters for rain — Saturday',
                        category: 'equipment',
                        priority: 'high',
                        status: 'open',
                      })
                      setRainTaskState('done')
                    } catch {
                      setRainTaskState('idle')
                    }
                  }}
                  className="mt-1.5 flex items-center gap-1 rounded bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info hover:bg-info/20 disabled:opacity-60 transition-colors"
                >
                  {rainTaskState === 'saving' ? (
                    <><Activity className="h-3 w-3 animate-spin" /> Creating…</>
                  ) : rainTaskState === 'done' ? (
                    <><CheckCircle2 className="h-3 w-3" /> Task Created</>
                  ) : (
                    <>+ Create Task</>
                  )}
                </button>
              </div>
            </div>

            {/* 7-day forecast */}
            <div className="-mx-5 sm:mx-0 px-5 sm:px-0 sm:pl-5 flex min-w-0 w-full items-center pt-4 sm:pt-0 overflow-x-auto scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
              {[
                { d: "TUE", hi: 27, lo: 22, emoji: "🌤" },
                { d: "WED", hi: 25, lo: 22, emoji: "🌥" },
                { d: "THU", hi: 25, lo: 22, emoji: "🌧" },
                { d: "FRI", hi: 25, lo: 22, emoji: "🌧" },
                { d: "SAT", hi: 25, lo: 20, emoji: "⛈", badge: "PREP" },
                { d: "SUN", hi: 25, lo: 22, emoji: "⛅" },
                { d: "MON", hi: 25, lo: 22, emoji: "🌥" },
              ].map((x, i, arr) => (
                <div key={x.d} className={cn("flex shrink-0 flex-col items-center gap-1.5 py-1 px-3", i < arr.length - 1 && "border-r border-border")}>
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
        <SectionTitle label="TODAY'S PULSE" />

        {/* Team on Shift (left, spans 2 rows) + right column (3 cards + revenue bar) */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1fr_1.6fr] lg:items-stretch">

          {/* Team on Shift Today */}
          <div className="rounded-card border border-border bg-card shadow-card flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="text-xs tracking-widest font-semibold text-foreground uppercase">Team on Shift Today</div>
              {todayShifts.length > 0 && (
                <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {new Set(todayShifts.map((s) => s.staffId)).size} members
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
                // Deduplicate by staffId — keep the shift with the earliest start time per person
                const seenStaff = new Set<string>()
                const dedupedShifts = todayShifts
                  .slice()
                  .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
                  .filter((s) => {
                    if (seenStaff.has(s.staffId)) return false
                    seenStaff.add(s.staffId)
                    return true
                  })
                const grouped = dedupedShifts.reduce<Record<string, typeof todayShifts>>((acc, s) => {
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
                            const isActive = isOnShiftNow(shift.shiftDate, shift.startTime, shift.endTime, now)
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
                  <div className="text-xs text-muted-foreground">See all {new Set(todayShifts.map((s) => s.staffId)).size} members scheduled today</div>
                </div>
                <span className="text-xs text-muted-foreground">—</span>
              </button>
            )}
          </div>

          {/* Right: 3 metric cards (row 1) + revenue bar (row 2) */}
          <div className="flex flex-col gap-4 h-full">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 min-w-0">
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
            const showStretchGoal = targetCleared && (velocity?.showStretchGoal ?? false)
            const stretchGoal = velocity?.stretchGoal ?? monthlyTarget * 1.5
            const requiredPaceForStretch = velocity?.requiredPaceForStretch ?? (remainingDays > 0 ? (stretchGoal - mtdRevenue) / remainingDays : 0)

            // When target cleared, show stretch goal as the active target
            const effectiveRequiredToday = showStretchGoal ? requiredPaceForStretch : requiredToday
            const mtdPct = monthlyTarget > 0 ? Math.round((mtdRevenue / monthlyTarget) * 100) : 0
            const stretchPct = stretchGoal > 0 ? Math.round((mtdRevenue / stretchGoal) * 100) : 0

            // Momentum: is avg pace above or below what's required?
            const paceVsRequired = effectiveRequiredToday > 0 ? avgDailyRevenue / effectiveRequiredToday : 1
            const momentumGood = paceVsRequired >= 0.9
            const momentumCritical = paceVsRequired < 0.7

            // Tonight's entered number vs what's required
            const tonightHasInput = tonightsRevenue > 0
            const tonightVsRequired = tonightHasInput && effectiveRequiredToday > 0
              ? tonightsRevenue / effectiveRequiredToday
              : null

            // Status label
            const statusLabel = targetCleared
              ? (showStretchGoal ? "Chasing stretch" : "Target cleared")
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
            const lookbackRows = revenueLookback?.rows ?? []
            const filteredLookbackRows = lookbackRows.slice(0, salesRange)
            const showLookbackValues = !revenueLookbackLoading && Boolean(revenueLookback?.hasData)
            const salesRangeFilters: Array<3 | 7 | 14 | 30> = [3, 7, 14, 30]
            const weeklySummaries = filteredLookbackRows.reduce((acc, row) => {
              const weekMeta = getIsoWeekMeta(row.date)
              const prev = acc.get(weekMeta.key) ?? {
                week: weekMeta.week,
                rangeLabel: weekMeta.rangeLabel,
                totalSales: 0,
                totalPax: 0,
              }
              prev.totalSales += row.revenue
              prev.totalPax += row.pax
              acc.set(weekMeta.key, prev)
              return acc
            }, new Map<string, { week: number; rangeLabel: string; totalSales: number; totalPax: number }>())

            // Smart insight sentence
            const insight = (() => {
              if (targetCleared) {
                return `Monthly target cleared. Averaging ${formatCompactVnd(avgDailyRevenue)} đ/day — need ${formatCompactVnd(requiredPaceForStretch)} đ/day to reach stretch goal of ${formatCompactVnd(stretchGoal)} đ.`
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
              <div className="rounded-card border border-border bg-card px-4 sm:px-6 py-5 shadow-card flex-1 flex flex-col">
                {/* Header row */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
                  <div className="min-w-0">
                    <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-1">Today's Revenue Target</div>
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <div className="font-display text-[28px] sm:text-[38px] leading-none tracking-[2px] text-foreground">
                        {velocityLoading ? "—" : formatCompactVnd(effectiveRequiredToday)}
                        <span className="text-xl sm:text-2xl text-muted-foreground font-light"> đ</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {showStretchGoal ? "needed today (stretch)" : "needed today"}
                      </div>
                    </div>
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      Day {velocity?.currentDay ?? "—"} of {daysInMonth} · {remainingDays} days left
                      {showStretchGoal
                        ? ` · Stretch goal ${formatCompactVnd(stretchGoal)} đ (1.5× target)`
                        : ` · Goal ${formatCompactVnd(monthlyTarget)} đ/month`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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

                {/* Progress bar: MTD vs target (or stretch when target cleared) */}
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>MTD {formatCompactVnd(mtdRevenue)} đ ({showStretchGoal ? stretchPct : mtdPct}%)</span>
                    {showStretchGoal ? (
                      <span>Stretch {formatCompactVnd(stretchGoal)} đ <span className="opacity-70">(target cleared)</span></span>
                    ) : (
                      <span>Target {formatCompactVnd(monthlyTarget)} đ</span>
                    )}
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", targetCleared ? "bg-success" : momentumCritical ? "bg-destructive" : "bg-primary")}
                      style={{ width: `${Math.min(100, showStretchGoal ? stretchPct : mtdPct)}%` }}
                    />
                  </div>
                </div>

                {/* Smart metrics row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
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

                {/* Previous sales table with range filters */}
                <div className="mb-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-[9.5px] uppercase tracking-widest text-muted-foreground">
                      Previous sales
                    </div>
                    <div className="flex items-center gap-1.5">
                      {salesRangeFilters.map((range) => (
                        <button
                          key={range}
                          type="button"
                          onClick={() => setSalesRange(range)}
                          className={cn(
                            "rounded-sm border px-2 py-1 text-[10px] tracking-widest uppercase transition-colors",
                            salesRange === range
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-secondary-foreground"
                          )}
                        >
                          {range}D
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-md border border-border bg-secondary/30">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-secondary/50">
                          <th className="px-3 py-2 text-left text-[9.5px] font-medium uppercase tracking-widest text-muted-foreground">
                            Date
                          </th>
                          <th className="px-3 py-2 text-right text-[9.5px] font-medium uppercase tracking-widest text-muted-foreground">
                            Total Sales
                          </th>
                          <th className="px-3 py-2 text-right text-[9.5px] font-medium uppercase tracking-widest text-muted-foreground">
                            Pax
                          </th>
                          <th className="px-3 py-2 text-right text-[9.5px] font-medium uppercase tracking-widest text-muted-foreground">
                            Avg Spending
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {showLookbackValues ? (
                          <>
                            {filteredLookbackRows.map((row, index) => {
                              const currentWeek = getIsoWeekMeta(row.date)
                              const prevWeek = index > 0 ? getIsoWeekMeta(filteredLookbackRows[index - 1].date) : null
                              const showWeekDivider = !prevWeek || prevWeek.key !== currentWeek.key

                              return (
                                <Fragment key={row.date}>
                                  {showWeekDivider && (
                                    <tr key={`divider-${currentWeek.key}`} className="border-b border-border/60 bg-secondary/40">
                                      <td className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                                        Week {currentWeek.week} · {currentWeek.rangeLabel}
                                      </td>
                                      <td className="px-3 py-1.5 text-right text-[10px] font-medium text-foreground">
                                        {formatCompactVnd(weeklySummaries.get(currentWeek.key)?.totalSales ?? 0)} đ
                                      </td>
                                      <td className="px-3 py-1.5 text-right text-[10px] font-medium text-foreground">
                                        {(weeklySummaries.get(currentWeek.key)?.totalPax ?? 0).toLocaleString()}
                                      </td>
                                      <td className="px-3 py-1.5 text-right text-[10px] font-medium text-foreground">
                                        {(() => {
                                          const summary = weeklySummaries.get(currentWeek.key)
                                          if (!summary || summary.totalPax <= 0) return "0 đ"
                                          return `${formatCompactVnd(summary.totalSales / summary.totalPax)} đ`
                                        })()}
                                      </td>
                                    </tr>
                                  )}
                                  <tr key={row.date} className="border-b border-border/60 last:border-0">
                                    <td className="px-3 py-2 text-foreground">
                                      {new Date(`${row.date}T00:00:00`).toLocaleDateString("en-US", {
                                        weekday: "long",
                                        month: "short",
                                        day: "numeric",
                                        timeZone: ICT_TZ,
                                      })}
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium text-foreground">
                                      {formatCompactVnd(row.revenue)} đ
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium text-foreground">
                                      {row.pax.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium text-foreground">
                                      {formatCompactVnd(row.avgSpend)} đ
                                    </td>
                                  </tr>
                                </Fragment>
                              )
                            })}
                          </>
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-3 py-3 text-center text-muted-foreground">
                              —
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Window</span>
                    <span className="font-medium text-secondary-foreground">
                      Last {salesRange} days (excluding today)
                    </span>
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
                        ? `+${formatCompactVnd(tonightsRevenue - effectiveRequiredToday)} đ above required`
                        : `${formatCompactVnd(effectiveRequiredToday - tonightsRevenue)} đ below required`}
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

        <div className="grid gap-3 grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]" style={{ alignItems: "start" }}>
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

            {tasksLoading && !tasksError ? (
              <div className="overflow-x-auto rounded-card border border-border bg-card shadow-card divide-y divide-border">
                <div className="min-w-[420px]">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="grid grid-cols-[1fr_110px_90px_80px] items-center px-3 py-2.5 gap-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-5 w-16 rounded-sm" />
                    <Skeleton className="h-5 w-14 rounded-sm" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
                </div>
              </div>
            ) : tasksError ? (
              <div className="rounded-card border border-border bg-card shadow-card p-8 text-center">
                <p className="text-sm text-muted-foreground">Unable to load tasks.</p>
                <button
                  onClick={() => refetchTasks()}
                  className="mt-2 text-xs underline text-muted-foreground hover:text-foreground transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : taskView === "list" ? (
              <div className="overflow-x-auto rounded-card border border-border bg-card shadow-card">
                <div className="min-w-[420px]">
                {/* Status filter pills */}
                <div className="flex items-center gap-1.5 flex-wrap px-3 py-2.5 border-b border-border bg-secondary/30">
                  {([
                    { value: "all",          label: "All",          activeCls: "border-border text-foreground bg-secondary" },
                    { value: "todo",         label: "Not Started",  activeCls: "border-border bg-secondary text-muted-foreground" },
                    { value: "in_progress",  label: "In Progress",  activeCls: "bg-primary/10 border-primary/25 text-primary" },
                    { value: "finish_today", label: "Finish Today", activeCls: "bg-warning/10 border-warning/25 text-warning" },
                    { value: "done",         label: "Done",         activeCls: "bg-success/10 border-success/25 text-success" },
                  ] as const).map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setListStatusFilter(f.value as any)}
                      className={cn(
                        "rounded-sm border px-2 py-0.5 text-[10px] tracking-wide uppercase transition-colors",
                        listStatusFilter === f.value
                          ? f.activeCls + " font-semibold"
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
                <div className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_110px_90px_80px] px-3 py-2 text-[10px] tracking-widest text-muted-foreground uppercase border-b border-border">
                  <div>Task</div>
                  <div className="hidden md:block">Status</div>
                  <div className="hidden md:block">Priority</div>
                  <div>Due</div>
                </div>

                {/* Rows */}
                {(() => {
                  const STATUS_BADGE: Record<string, { label: string; variant: "neutral" | "brand" | "positive" | "danger" | "warning" }> = {
                    todo:         { label: "Not Started",  variant: "neutral"  },
                    in_progress:  { label: "In Progress",  variant: "brand"    },
                    finish_today: { label: "Finish Today", variant: "warning"  },
                    done:         { label: "Done",         variant: "positive" },
                    blocked:      { label: "Delegated",    variant: "danger"   },
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
                          "grid w-full grid-cols-[1fr_auto] md:grid-cols-[1fr_110px_90px_80px] items-center border-t border-border px-3 py-3 md:py-2.5 text-left hover:bg-secondary/50 transition-colors min-h-[44px]",
                          t.status === "done" && "opacity-60",
                        )}
                      >
                        <div className="min-w-0">
                          <div className={cn("text-sm truncate", t.status === "done" ? "line-through text-muted-foreground" : "text-foreground")}>
                            {t.title}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 md:hidden">
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                            <Badge variant={pri.variant}>{pri.label}</Badge>
                          </div>
                        </div>
                        <div className="hidden md:block">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                        <div className="hidden md:block">
                          <Badge variant={pri.variant}>{pri.label}</Badge>
                        </div>
                        <div className={cn("text-[10px] tabular-nums", isOverdue ? "text-error" : "text-muted-foreground")}>
                          {formatDue(t.dueDate)}
                        </div>
                      </button>
                    )
                  })
                })()}
                </div>
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
                    <Badge variant="danger">
                      {followUpList.filter((x) => x.task.priority === "urgent").length} urgent
                    </Badge>
                  )}
                  {followUpList.filter((x) => x.task.dueDate && x.task.dueDate < todayIso && x.task.status !== "done").length > 0 && (
                    <Badge variant="warning">
                      {followUpList.filter((x) => x.task.dueDate && x.task.dueDate < todayIso && x.task.status !== "done").length} overdue
                    </Badge>
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
                  const badge: { label: string; variant: "positive" | "danger" | "warning" | "brand" | "neutral" } = isDone
                    ? { label: "✓ Done",    variant: "positive" }
                    : isOverdue
                    ? { label: `↑ Overdue ${Math.round((new Date(todayIso).getTime() - new Date(task.dueDate!).getTime()) / 86400000)}d`, variant: "danger" }
                    : task.dueDate === todayIso
                    ? { label: "🔥 Today",  variant: "warning" }
                    : isFresh
                    ? { label: "↑ Today",   variant: "brand"   }
                    : { label: "This Week", variant: "neutral"  }

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
                        {isDone && <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
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
                      <Badge variant={badge.variant} className="shrink-0 whitespace-nowrap">
                        {badge.label}
                      </Badge>
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

      {/* Week at a glance + Pipeline — side-by-side two-column layout */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <SectionTitle label="THIS WEEK" />
          <div className="h-px flex-1 bg-border" />
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setWeekOffset((p) => p - 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[120px] text-center text-xs font-medium text-foreground">{fmtWeekRange(weekDates)}</span>
            <button onClick={() => setWeekOffset((p) => p + 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary transition-colors">
                Today
              </button>
            )}
          </div>
        </div>
        {/* Two-column: vertical glance left, pipeline table right */}
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-[220px_1fr]" style={{ alignItems: "stretch" }}>

        {/* LEFT — vertical day cards */}
        <div className="flex flex-col gap-1.5" style={{ height: "100%" }}>
        {weekDates.map((d, dIdx) => {
            const row = weekByDate.get(d.iso)
            const isToday = d.iso === todayIso && isCurrentWeek
            const isPast = d.iso < todayIso && isCurrentWeek
            const isClub = (row?.mode || "").toLowerCase().includes("club")
              || d.day === "THU" || d.day === "FRI" || d.day === "SAT"

            // Calendar events for this day sorted by start time
            const dayEvents = (roofEvents || [])
              .filter((e) => e.dateIso === d.iso && e.eventName)
              .slice()
              .sort((a, b) => (a.startMinutes ?? 999999) - (b.startMinutes ?? 999999))

            // DJ lines from aggregated data
            const djLines = row?.djLines || []
            const isLast = dIdx === weekDates.length - 1

            return (
              <div
                key={d.iso}
                style={{
                  ...(isLast ? { flex: 1 } : {}),
                  opacity: isPast ? 0.55 : 1,
                  border: isToday ? "1.5px solid #b5620a" : "1px solid #e2ddd7",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#faf8f5",
                }}
              >
                {/* Header */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 10px",
                  borderBottom: "1px solid #e2ddd7",
                  background: isToday ? "#b5620a" : "#f0ece6",
                }}>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.08em",
                    color: isToday ? "rgba(255,255,255,0.75)" : "#9c9590",
                    minWidth: 26,
                  }}>{d.day}</span>
                  <span style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 16,
                    fontWeight: 500,
                    color: isToday ? "#fff" : "#1a1714",
                    marginRight: "auto",
                    lineHeight: 1,
                  }}>{d.dateNum}</span>
                  {/* Night type badge */}
                  {isClub ? (
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 3,
                      textTransform: "uppercase" as const, letterSpacing: "0.04em",
                      background: isToday ? "rgba(255,255,255,0.2)" : "rgba(107,63,160,0.15)",
                      color: isToday ? "#fff" : "#7a4abf",
                      border: isToday ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(107,63,160,0.2)",
                    }}>Club</span>
                  ) : (
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 3,
                      textTransform: "uppercase" as const, letterSpacing: "0.04em",
                      background: "#f5edd8", color: "#7a5a10", border: "1px solid #e8d9b0",
                    }}>Lounge</span>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding: "8px 10px", backgroundColor: "rgba(255, 255, 255, 1)", overflowY: "auto", maxHeight: 90 }}>
                  {weekCsvLoading ? (
                    <div style={{ fontSize: 10, color: "#9c9590" }}>Loading…</div>
                  ) : weekCsvError ? (
                    <div style={{ fontSize: 10, color: "#b5620a" }}>Unable to load.</div>
                  ) : (
                    <>
                      {dayEvents.length > 0 ? dayEvents.map((ev, evIdx) => (
                        <div key={evIdx} style={{ marginTop: evIdx > 0 ? 6 : 0, borderTop: evIdx > 0 ? "1px solid #e2ddd7" : "none", paddingTop: evIdx > 0 ? 5 : 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? "#b5620a" : "#1a1714", lineHeight: 1.3 }}>
                            {ev.eventName}
                          </div>
                          {(ev.startTime || ev.endTime) && (
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#9c9590", marginTop: 1 }}>
                              {ev.startTime}{ev.startTime && ev.endTime ? " – " : ""}{ev.endTime}
                            </div>
                          )}
                        </div>
                      )) : (
                        <div style={{ fontSize: 10, color: "#9c9590", fontStyle: "italic" }}>TBD</div>
                      )}
                      {djLines.length > 0 && (
                        <div style={{ fontSize: 10, color: "#6b6560", marginTop: 3, display: "flex", flexDirection: "column", gap: 1 }}>
                          {djLines.map((line: string, i: number) => (
                            <div key={i}>{line}</div>
                          ))}
                        </div>
                      )}
                      {isToday && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#b5620a", display: "inline-block" }} />
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#b5620a", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Tonight</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>{/* end glance-col */}

        {/* RIGHT — Pipeline card */}
        <div className="overflow-x-auto" style={{
          border: "1px solid #e2ddd7",
          borderRadius: 8,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column" as const,
          height: "100%",
          minWidth: 0,
        }}>

        {/* Card header */}
        <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2ddd7", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1714" }}>This Week's Pipeline</div>
          <div style={{ fontSize: 11, color: "#9c9590" }}>{fmtWeekRange(weekDates)}</div>
        </div>

        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr 1fr 1.2fr 1.6fr",
          gap: 16,
          padding: "7px 18px",
          borderBottom: "1px solid #e2ddd7",
          background: "#f0ece6",
          minWidth: 480,
        }}>
          {["Event", "DJ 1", "DJ 2", "Genre", "Promotion"].map((h) => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#9c9590" }}>{h}</div>
          ))}
        </div>

        {/* Rows — flex:1 fills remaining space; scrolls if many events */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {pipelineRows.map((row, idx) => {
            const isPipelinePast = row.iso < todayIso && isCurrentWeek
            const genres = row.genre !== "—" ? row.genre.split(/[,;]+/).map((g) => g.trim()).filter(Boolean) : []
            const promos = row.promo !== "—" ? row.promo.split(/[,;]+/).map((p) => p.trim()).filter(Boolean) : []
            const topBorder = row.isFirstForDay && idx > 0 ? "2px solid #d4cfc9" : "1px solid #e2ddd7"

            return (
              <div
                key={`${row.iso}-${idx}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 1fr 1fr 1.2fr 1.6fr",
                  gap: 16,
                  padding: "10px 18px",
                  minHeight: 48,
                  minWidth: 480,
                  borderBottom: "1px solid #e2ddd7",
                  borderTop: topBorder,
                  alignItems: "center",
                  background: row.isToday ? "#fdf3e7" : "transparent",
                  opacity: isPipelinePast ? 0.55 : 1,
                }}
              >
                {/* Event + date */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: row.isToday ? "#b5620a" : row.event === "TBD" ? "#9c9590" : "#1a1714",
                      fontStyle: row.event === "TBD" ? "italic" : "normal",
                    }}>{row.event}</span>
                    {row.isToday && row.isFirstForDay && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 3,
                        background: "#b5620a", color: "#fff",
                        textTransform: "uppercase" as const, letterSpacing: "0.05em",
                      }}>Today</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "#9c9590", marginTop: 2 }}>{row.when}</div>
                </div>

                {/* DJ 1 */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: row.dj1 === "—" ? "#c8c0b5" : "#1a1714" }}>{row.dj1}</div>
                </div>

                {/* DJ 2 */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: row.dj2 === "—" ? "#c8c0b5" : "#1a1714" }}>{row.dj2}</div>
                </div>

                {/* Genre chips */}
                <div style={{ minWidth: 0, display: "flex", flexWrap: "wrap" as const, gap: 3 }}>
                  {genres.length > 0 ? genres.map((g) => (
                    <span key={g} style={{
                      padding: "2px 7px", borderRadius: 3, fontSize: 10, fontWeight: 500,
                      background: "#f0ece6", border: "1px solid #e2ddd7", color: "#6b6560",
                    }}>{g}</span>
                  )) : (
                    <span style={{ color: "#c8c0b5", fontSize: 11 }}>—</span>
                  )}
                </div>

                {/* Promo pills */}
                <div style={{ minWidth: 0, display: "flex", flexWrap: "wrap" as const, gap: 3 }}>
                  {promos.length > 0 ? promos.map((p) => (
                    <span key={p} style={{
                      padding: "2px 7px", borderRadius: 3, fontSize: 10, fontWeight: 500,
                      background: "#edf5f0", border: "1px solid #b8e0c8", color: "#2d7a4f",
                    }}>{p}</span>
                  )) : (
                    <span style={{ color: "#c8c0b5", fontSize: 11 }}>—</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── WEEKLY ANALYSIS ── */}
        {(() => {
          // ── Stats ─────────────────────────────────────────────────────────
          // Events count: days that have at least one named event this week
          const weekIsos = new Set(weekDates.map((d) => d.iso))
          const eventCount = weekDates.filter((d) => {
            const evts = (roofEvents || []).filter((e) => e.dateIso === d.iso && e.eventName)
            return evts.length > 0
          }).length

          // DJs Booked: distinct DJ names across all week events
          const djSet = new Set<string>()
          for (const e of roofEvents || []) {
            if (!weekIsos.has(e.dateIso)) continue
            if (e.dj1) djSet.add(e.dj1.replace(/\s+\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/, "").trim())
            if (e.dj2) djSet.add(e.dj2.replace(/\s+\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/, "").trim())
          }
          const djBookedCount = djSet.size

          // Club Nights: days whose mode includes "club" (or THU/FRI/SAT default)
          const clubNightCount = weekDates.filter((d) => {
            const row = weekByDate.get(d.iso)
            return (row?.mode || "").toLowerCase().includes("club")
              || d.day === "THU" || d.day === "FRI" || d.day === "SAT"
          }).length

          // Unplanned: days with no event at all this week
          const unplannedDays = weekDates.filter((d) => {
            const evts = (roofEvents || []).filter((e) => e.dateIso === d.iso && e.eventName)
            return evts.length === 0
          })
          const unplannedCount = unplannedDays.length

          // ── Overall rating label ──────────────────────────────────────────
          const rating =
            eventCount >= 6 ? "Strong Week"
            : eventCount >= 4 ? "Solid Week"
            : eventCount >= 2 ? "Light Week"
            : "Slow Week"
          const ratingColor =
            eventCount >= 6 ? "#22c55e"
            : eventCount >= 4 ? "#84cc16"
            : eventCount >= 2 ? "#f59e0b"
            : "#ef4444"

          // ── Insights ─────────────────────────────────────────────────────
          const insights: Array<{ icon: ElementType; title: string; body: string }> = []

          // 1. High DJ reliance: any DJ appearing on 3+ nights
          const djNightCount = new Map<string, number>()
          for (const d of weekDates) {
            const dayEvts = (roofEvents || []).filter((e) => e.dateIso === d.iso && e.eventName)
            const dayDJs = new Set<string>()
            for (const e of dayEvts) {
              if (e.dj1) dayDJs.add(e.dj1.replace(/\s+\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/, "").trim())
              if (e.dj2) dayDJs.add(e.dj2.replace(/\s+\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/, "").trim())
            }
            for (const dj of dayDJs) djNightCount.set(dj, (djNightCount.get(dj) ?? 0) + 1)
          }
          const heavyDJs = Array.from(djNightCount.entries())
            .filter(([, n]) => n >= 3)
            .map(([name]) => name)
          if (heavyDJs.length > 0) {
            insights.push({
              icon: AlertTriangle,
              title: "High DJ Reliance",
              body: `${heavyDJs.join(", ")} ${heavyDJs.length === 1 ? "is" : "are"} booked ${heavyDJs.length === 1 ? djNightCount.get(heavyDJs[0]) : "3+"}+ nights — consider diversifying the lineup.`,
            })
          }

          // 2. Club night with no promotion
          const clubNightsNoPromo = weekDates.filter((d) => {
            const isClub = (weekByDate.get(d.iso)?.mode || "").toLowerCase().includes("club")
              || d.day === "THU" || d.day === "FRI" || d.day === "SAT"
            if (!isClub) return false
            const hasPromo = (roofEvents || []).some((e) => e.dateIso === d.iso && e.promotion)
            return !hasPromo
          })
          if (clubNightsNoPromo.length > 0) {
            const names = clubNightsNoPromo.map((d) => d.day).join(", ")
            insights.push({
              icon: Megaphone,
              title: "Club Nights Without Promotion",
              body: `${names} ${clubNightsNoPromo.length === 1 ? "has" : "have"} no promotion attached — add an offer to drive footfall.`,
            })
          }

          // 3. Unplanned days → opportunity
          if (unplannedCount > 0) {
            const names = unplannedDays.map((d) => d.day).join(", ")
            insights.push({
              icon: CalendarDays,
              title: `${unplannedCount} Unplanned ${unplannedCount === 1 ? "Night" : "Nights"}`,
              body: `${names} ${unplannedCount === 1 ? "has" : "have"} no event scheduled — opportunity to fill the calendar.`,
            })
          }

          // 4. Fully planned week
          if (unplannedCount === 0 && eventCount === 7) {
            insights.push({
              icon: CheckCircle2,
              title: "Full Week Planned",
              body: "Every night this week has an event — great execution on calendar coverage.",
            })
          }

          // Fallback if nothing flagged
          if (insights.length === 0) {
            insights.push({
              icon: BarChart2,
              title: "Week on Track",
              body: `${eventCount} events scheduled with ${djBookedCount} DJs across ${clubNightCount} club nights.`,
            })
          }

          return (
            <div style={{ borderTop: "2px solid #e2ddd7", background: "#fff" }}>

              {/* Stats bar */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "7px 14px",
                borderBottom: "1px solid #e2ddd7",
                gap: 8,
                backgroundColor: "#faf8f5",
                flexWrap: "wrap" as const,
              }}>
                {/* Left: label + badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <Sparkles style={{ width: 10, height: 10, color: "#c9a84c", flexShrink: 0 }} />
                  <span style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: "0.12em",
                    textTransform: "uppercase" as const, color: "#9c9590",
                  }}>Weekly Analysis</span>
                  <span style={{
                    fontSize: 8, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                    background: `${ratingColor}18`, border: `1px solid ${ratingColor}55`,
                    color: ratingColor, letterSpacing: "0.05em", textTransform: "uppercase" as const,
                  }}>{rating}</span>
                </div>

                {/* Right: 4 stats — scrollable on very small screens */}
                <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto" as const, flexShrink: 1, minWidth: 0 }}>
                  {[
                    { label: "Events", value: String(eventCount) },
                    { label: "DJs Booked", value: String(djBookedCount) },
                    { label: "Club Nights", value: String(clubNightCount) },
                    { label: "Unplanned", value: String(unplannedCount), amber: unplannedCount > 0 },
                  ].map((stat, i) => (
                    <div key={stat.label} style={{
                      display: "flex", flexDirection: "column" as const, alignItems: "center",
                      padding: "0 8px",
                      borderLeft: i > 0 ? "1px solid #e2ddd7" : "none",
                      flexShrink: 0,
                    }}>
                      <span style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 13, fontWeight: 900, color: stat.amber ? "#d97706" : "#1a1714",
                        lineHeight: 1,
                      }}>{stat.value}</span>
                      <span style={{
                        fontSize: 7, fontWeight: 600, letterSpacing: "0.08em",
                        textTransform: "uppercase" as const,
                        color: "#9c9590", marginTop: 2, whiteSpace: "nowrap" as const,
                      }}>{stat.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Insights */}
              <div style={{ display: "flex", flexDirection: "column" as const }}>
                {insights.map((ins, i) => {
                  const InsIcon = ins.icon
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "5px 14px",
                      borderTop: i > 0 ? "1px solid #f0ece6" : "none",
                    }}>
                      <InsIcon style={{ width: 11, height: 11, flexShrink: 0, color: "#9c9590" }} />
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#1a1714" }}>{ins.title}</span>
                        <span style={{ fontSize: 10, color: "#6b6560", marginLeft: 5 }}>{ins.body}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          )
        })()}

        </div>{/* end pipeline-card */}

        </div>{/* end two-column grid */}
      </div>{/* end THIS WEEK section */}

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
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Check
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
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" /> Day
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
                  <TaskDescriptionEditor
                    value={editDraft.description}
                    onChange={(v) => setEditDraft((s) => ({ ...s, description: v }))}
                  />
                </div>

                {/* Sub-tasks */}
                <SubTodoListEditor
                  items={editDraft.subTodos}
                  onChange={(items) => setEditDraft((s) => ({ ...s, subTodos: items }))}
                  disabled={updateTask.isPending}
                />
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
                          subTodos: editDraft.subTodos,
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
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Check
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
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" /> Day
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
              <TaskDescriptionEditor
                value={createDraft.description || ""}
                onChange={(v) => setCreateDraft((s) => ({ ...s, description: v }))}
              />
            </div>

            {/* Sub-tasks */}
            <SubTodoListEditor
              items={createDraft.subTodos ?? []}
              onChange={(items) => setCreateDraft((s) => ({ ...s, subTodos: items }))}
              disabled={createTask.isPending}
            />
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
                    subTodos: createDraft.subTodos ?? [],
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

