import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Activity,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  MapPin,
  Plus,
  ShieldAlert,
  Tag,
  Trash2,
  User,
  Zap,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import {
  useManagerTasks,
  useCreateDelegationTask,
  useDeleteDelegationTask,
  useUpdateDelegationTask,
} from "@/hooks/useDelegationTasks"
import { useStaffList, useTodayShifts } from "@/hooks/useShifts"
import {
  useKPISummary,
  useRevenueVelocity,
  useGoogleReviews,
} from "@/hooks/useDashboardData"
import {
  useExecutiveDashboardDailyInput,
  useMonthlyTarget,
  useUpsertExecutiveDashboardDailyInput,
  useUpsertMonthlyTarget,
} from "@/hooks/useExecutiveDashboardInputs"
import { useTodayPaxConfirmed, useReservationsCsv } from "@/hooks/useReservationsCsv"
import { useRoofCalendarWeekData } from "@/hooks/useWeekAtGlanceCsv"
import { useMaintenanceTasks, useCreateMaintenanceTask } from "@/hooks/useMaintenanceTasks"
import { KanbanBoard, COLUMNS } from "@/components/dashboard/KanbanBoard"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SectionTitle } from "@/components/ui/section-title"
import type {
  BoardColumnKey,
  CreateDelegationTaskInput,
  DelegationTask,
  TaskCategory,
  TaskStatus,
} from "@/types"

// ─── Constants ────────────────────────────────────────────────────────────────

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


function greetingFromHour(h: number) {
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

function isClubNight(weekday: string) {
  return ["Thursday", "Friday", "Saturday"].includes(weekday)
}

function priorityPill(priority: string) {
  const p = String(priority || "").toLowerCase()
  if (p === "urgent" || p === "high")
    return { label: p.toUpperCase(), className: "bg-error/10 text-error border border-error/20" }
  if (p === "medium")
    return { label: "MEDIUM", className: "bg-muted text-muted-foreground border border-border" }
  return { label: "LOW", className: "bg-muted text-muted-foreground border border-border" }
}

function formatDue(dueIso: string | undefined) {
  if (!dueIso) return "—"
  try {
    return new Date(`${dueIso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return dueIso
  }
}

function mapToBoardColumn(t: DelegationTask, todayIso: string, myUserId: string): BoardColumnKey {
  if (t.status === "cancelled") return "not_started"
  if (t.status === "done") return "done"
  if (myUserId && t.assignedTo && t.assignedTo !== myUserId) return "not_started"
  if (t.status === "in_progress" && t.dueDate === todayIso) return "finish_today"
  if (t.status === "todo") return "not_started"
  if (t.status === "in_progress") return "in_progress"
  return "not_started"
}

const CATEGORY_OPTIONS: Array<{ value: TaskCategory; label: string }> = [
  { value: "bar", label: "Bar" },
  { value: "operations", label: "Operations" },
  { value: "finance", label: "Finance" },
  { value: "ordering", label: "Ordering" },
  { value: "marketing", label: "Marketing" },
  { value: "event", label: "Events" },
]

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "Not Started" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Delegated" },
]

// ─── Sub-components ────────────────────────────────────────────────────────────

function AnalogClock({ hour, minute, second }: { hour: number; minute: number; second: number }) {
  const secDeg = (second / 60) * 360
  const minDeg = (minute / 60) * 360 + (second / 60) * 6
  const hourDeg = ((hour % 12) / 12) * 360 + (minute / 60) * 30
  return (
    <svg viewBox="0 0 200 200" className="mx-auto h-20 w-20 text-foreground">
      <circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="4" fill="rgb(var(--primary))" />
      <line x1="100" y1="100" x2="100" y2="56" stroke="currentColor" strokeWidth="4" strokeLinecap="round"
        style={{ transform: `rotate(${hourDeg}deg)`, transformOrigin: "100px 100px" }} />
      <line x1="100" y1="100" x2="100" y2="40" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
        style={{ transform: `rotate(${minDeg}deg)`, transformOrigin: "100px 100px" }} />
      <line x1="100" y1="104" x2="100" y2="30" stroke="rgb(var(--primary))" strokeWidth="1" strokeLinecap="round"
        style={{ transform: `rotate(${secDeg}deg)`, transformOrigin: "100px 100px" }} />
    </svg>
  )
}

function CardShell({
  title, icon, right, children, className,
}: {
  title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <section className={cn("rounded-card border border-border bg-card shadow-card", className)}>
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          {icon ? <div className="text-primary">{icon}</div> : null}
          <div className="text-xs tracking-widest font-semibold text-foreground uppercase">{title}</div>
        </div>
        {right}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  )
}

// ─── Pipeline helpers ──────────────────────────────────────────────────────────

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

// ─── Main Component ────────────────────────────────────────────────────────────

export function ManagerDashboard() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const viewAs = useAuthStore((s) => s.viewAs)
  const firstName = (profile?.fullName || "Manager").split(" ")[0] || "Manager"

  // True when an owner is previewing the manager view — their profile.id is still
  // the owner's ID, so the task board would show the owner's own tasks, not a
  // manager's. We hide personal task mutations in this case.
  const isOwnerPreviewing = profile?.role === "owner" && viewAs?.role === "manager"

  // Live clock
  const [tick, setTick] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setTick(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // ── Check-in / Break state ───────────────────────────────────────────────────
  const [checkedIn, setCheckedIn] = useState(false)
  const [onBreak, setOnBreak] = useState(false)
  const [checkInTime, setCheckInTime] = useState<Date | null>(null)
  const [shiftElapsed, setShiftElapsed] = useState(0)
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false)

  // Break tracking: current break start + log of past breaks
  const [breakStartTime, setBreakStartTime] = useState<Date | null>(null)
  const [breakElapsed, setBreakElapsed] = useState(0)
  interface BreakEntry { start: Date; end: Date; durationSecs: number }
  const [breakLog, setBreakLog] = useState<BreakEntry[]>([])

  // Tick shift elapsed every second
  useEffect(() => {
    if (!checkedIn || !checkInTime) return
    const id = window.setInterval(() => {
      setShiftElapsed(Math.floor((Date.now() - checkInTime.getTime()) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [checkedIn, checkInTime])

  // Tick break elapsed every second while on break
  useEffect(() => {
    if (!onBreak || !breakStartTime) return
    const id = window.setInterval(() => {
      setBreakElapsed(Math.floor((Date.now() - breakStartTime.getTime()) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [onBreak, breakStartTime])

  function doCheckIn() {
    setCheckedIn(true)
    setCheckInTime(new Date())
    setShiftElapsed(0)
    setOnBreak(false)
    setBreakLog([])
  }

  function doCheckOut() {
    setCheckedIn(false)
    setOnBreak(false)
    setCheckInTime(null)
    setShiftElapsed(0)
    setBreakStartTime(null)
    setBreakElapsed(0)
    setBreakLog([])
    setShowCheckoutConfirm(false)
  }

  function toggleBreak() {
    if (!onBreak) {
      // Start break
      const now = new Date()
      setBreakStartTime(now)
      setBreakElapsed(0)
      setOnBreak(true)
    } else {
      // End break — log it
      const now = new Date()
      const dur = breakStartTime ? Math.floor((now.getTime() - breakStartTime.getTime()) / 1000) : 0
      if (breakStartTime) {
        setBreakLog((prev) => [...prev, { start: breakStartTime, end: now, durationSecs: dur }])
      }
      setOnBreak(false)
      setBreakStartTime(null)
      setBreakElapsed(0)
    }
  }

  function fmtSecs(secs: number) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`
  }

  function fmtTime(d: Date) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  }

  const shiftTimerStr = fmtSecs(shiftElapsed)
  const breakTimerStr = fmtSecs(breakElapsed)

  // ── Ritual phase countdown ────────────────────────────────────────────────────
  const [ritualSecs, setRitualSecs] = useState(103 * 60)
  useEffect(() => {
    const id = window.setInterval(() => setRitualSecs((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(id)
  }, [])
  const ritualCountdown = `${pad2(Math.floor(ritualSecs / 60))}:${pad2(ritualSecs % 60)}`

  const ict = useMemo(() => getIctParts(tick), [tick])
  const greeting = greetingFromHour(ict.hour)
  const dateString = `${ict.weekday.toUpperCase()}, ${ict.month.toUpperCase()} ${ict.day}, ${ict.year}`
  const timeString = `${pad2(ict.hour)}:${pad2(ict.minute)}:${pad2(ict.second)}`

  const todayIso = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ICT_TZ }).formatToParts(tick)
    const map = new Map(parts.map((p) => [p.type, p.value]))
    return `${map.get("year")}-${map.get("month")}-${map.get("day")}`
  }, [tick])

  const showClubNight = isClubNight(ict.weekday)
  const modeLabel = showClubNight ? "Club Night" : "Lounge Day"
  const hoursLabel = showClubNight ? "Open 14:00 – 02:00" : "Open 14:00 – 01:00"

  // ── Data hooks ───────────────────────────────────────────────────────────────
  const { data: kpi, isLoading: kpiLoading } = useKPISummary()
  const { data: velocity, isLoading: _velocityLoading } = useRevenueVelocity()
  const { data: googleReviews } = useGoogleReviews()
  const periodStartIso = `${todayIso.slice(0, 7)}-01`
  const { data: dailyInput, isLoading: _dailyInputLoading } = useExecutiveDashboardDailyInput(todayIso)
  const { data: paxTarget } = useMonthlyTarget("pax", periodStartIso)
  const { pax: _csvPaxConfirmed, isLoading: csvPaxLoading } = useTodayPaxConfirmed()
  const { data: allCsvReservations = [] } = useReservationsCsv()
  const { data: todayShifts = [] } = useTodayShifts(todayIso)

  // ── Weekly pipeline ──────────────────────────────────────────────────────────
  const { data: roofCalendar } = useRoofCalendarWeekData()
  const roofEvents = roofCalendar?.events ?? []

  const weekDates = useMemo(() => {
    const [y, m, d] = todayIso.split("-").map((x) => Number(x))
    const anchor = new Date(Date.UTC(y, m - 1, d))
    const dowMon0 = (anchor.getUTCDay() + 6) % 7
    const start = new Date(Date.UTC(y, m - 1, d - dowMon0))
    const dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    const out: Array<{ day: string; dateNum: number; iso: string }> = []
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
    for (const e of roofEvents) {
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
        return { iso: d.iso, isToday: d.iso === todayIso, event: "TBD", when: formatPipelineWhen(d.iso, null, null), dj1: "—", dj2: "—", genre: "—", promo: "—" }
      }
      const extraCount = Math.max(0, dayEvents.length - 1)
      return {
        iso: d.iso,
        isToday: d.iso === todayIso,
        event: `${first.eventName}${extraCount ? ` +${extraCount} more` : ""}`,
        when: formatPipelineWhen(d.iso, first.startTime, first.endTime),
        dj1: first.dj1 || "—",
        dj2: first.dj2 || "—",
        genre: first.genre || "—",
        promo: first.promotion || "—",
      }
    })
  }, [roofEvents, weekDates, todayIso])

  // Find the logged-in manager's own shift for today
  const myShift = useMemo(() => {
    if (!profile?.id) return null
    return (todayShifts as any[]).find((s) => s.staffId === profile.id || s.userId === profile.id) ?? null
  }, [todayShifts, profile?.id])

  const shiftTimeLabel = myShift
    ? `${(myShift.startTime || "").slice(0, 5)} – ${(myShift.endTime || "").slice(0, 5)}`
    : showClubNight ? "16:00 – 23:59" : "14:00 – 22:00"

  const managerInitials = (profile?.fullName || "M")
    .split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()

  const managerRoleLabel = (() => {
    const mt = (profile as any)?.managerType || viewAs?.managerType
    if (mt === "floor") return "Floor Manager"
    if (mt === "bar") return "Bar Manager"
    if (mt === "marketing") return "Marketing Manager"
    return "Manager"
  })()

  const upsertDailyInput = useUpsertExecutiveDashboardDailyInput()
  const upsertMonthlyTarget = useUpsertMonthlyTarget()

  // Revenue
  const tonightsRevenue = dailyInput?.tonightsRevenue ?? 0
  const mtdPax = kpi?.pax.value ?? 0
  const monthlyPaxPercent = paxTarget && paxTarget > 0 ? Math.round((mtdPax / paxTarget) * 100) : null

  const [tonightEditOpen, setTonightEditOpen] = useState(false)
  const [tonightDraft, setTonightDraft] = useState("")
  useEffect(() => {
    if (tonightEditOpen) setTonightDraft(String(Math.round(tonightsRevenue || 0)))
  }, [tonightEditOpen, tonightsRevenue])

  const [paxTargetEditOpen, setPaxTargetEditOpen] = useState(false)
  const [paxTargetDraft, setPaxTargetDraft] = useState("")
  useEffect(() => {
    if (paxTargetEditOpen) setPaxTargetDraft(paxTarget ? String(Math.round(Number(paxTarget))) : "")
  }, [paxTargetEditOpen, paxTarget])

  // ── Maintenance (floor issues) ───────────────────────────────────────────────
  const { data: maintenanceTasks = [] } = useMaintenanceTasks("all", "open", "all")
  const openIssues = maintenanceTasks.filter((t) => t.status === "open")

  const createMaintenance = useCreateMaintenanceTask()
  const [issueFormOpen, setIssueFormOpen] = useState(false)
  const [issueDraft, setIssueDraft] = useState({ title: "", description: "", location: "" })

  // ── Tonight's promos (hardcoded, matches owner dashboard style) ──────────────
  const promosByDay: Record<string, Array<{ icon: string; label: string; sub: string; hours: string; type: "all_night" | "timed" | "conditional" }>> = {
    Monday: [
      { icon: "💨", label: "Buy 1 Get 1", sub: "Happy hour menu items · all day promotion", hours: "14:00–18:00", type: "timed" },
      { icon: "🍵", label: "Free Tea", sub: "With any special shisha order", hours: "All night", type: "all_night" },
      { icon: "🍸", label: "Cocktail Set", sub: "6 best-sellers — 399K", hours: "All night", type: "all_night" },
      { icon: "🌧", label: "20% Off Shisha", sub: "Rainy day special — apply when raining", hours: "Conditional", type: "conditional" },
    ],
    Tuesday: [
      { icon: "💨", label: "Buy 1 Get 1", sub: "Happy hour menu items · all day promotion", hours: "14:00–18:00", type: "timed" },
      { icon: "🍵", label: "Free Tea", sub: "With any special shisha order", hours: "All night", type: "all_night" },
      { icon: "🍸", label: "Cocktail Set", sub: "6 best-sellers — 399K", hours: "All night", type: "all_night" },
      { icon: "🌧", label: "20% Off Shisha", sub: "Rainy day special — apply when raining", hours: "Conditional", type: "conditional" },
    ],
    Wednesday: [
      { icon: "💨", label: "Buy 1 Get 1", sub: "Happy hour menu items · all day promotion", hours: "14:00–18:00", type: "timed" },
      { icon: "🍵", label: "Free Tea", sub: "With any special shisha order", hours: "All night", type: "all_night" },
      { icon: "🍸", label: "Cocktail Set", sub: "6 best-sellers — 399K", hours: "All night", type: "all_night" },
      { icon: "🌧", label: "20% Off Shisha", sub: "Rainy day special — apply when raining", hours: "Conditional", type: "conditional" },
    ],
    Thursday: [
      { icon: "💨", label: "Buy 1 Get 1", sub: "Happy hour menu items · all day promotion", hours: "14:00–18:00", type: "timed" },
      { icon: "🍵", label: "Free Tea", sub: "With any special shisha order", hours: "All night", type: "all_night" },
      { icon: "🍸", label: "Cocktail Set", sub: "6 best-sellers — 399K", hours: "All night", type: "all_night" },
      { icon: "🌧", label: "20% Off Shisha", sub: "Rainy day special — apply when raining", hours: "Conditional", type: "conditional" },
    ],
    Friday: [
      { icon: "💨", label: "Buy 1 Get 1", sub: "Happy hour menu items · all day promotion", hours: "14:00–18:00", type: "timed" },
      { icon: "🍵", label: "Free Tea", sub: "With any special shisha order", hours: "All night", type: "all_night" },
      { icon: "🍸", label: "Cocktail Set", sub: "6 best-sellers — 399K", hours: "All night", type: "all_night" },
      { icon: "🌧", label: "20% Off Shisha", sub: "Rainy day special — apply when raining", hours: "Conditional", type: "conditional" },
    ],
    Saturday: [
      { icon: "💨", label: "Buy 1 Get 1", sub: "Happy hour menu items · all day promotion", hours: "14:00–18:00", type: "timed" },
      { icon: "🍵", label: "Free Tea", sub: "With any special shisha order", hours: "All night", type: "all_night" },
      { icon: "🍸", label: "Cocktail Set", sub: "6 best-sellers — 399K", hours: "All night", type: "all_night" },
      { icon: "🌧", label: "20% Off Shisha", sub: "Rainy day special — apply when raining", hours: "Conditional", type: "conditional" },
      { icon: "🍷", label: "Girls Night — Free Flow Wine", sub: "All girls free flow wine 21:00–23:00 · Mừng 2 Tết", hours: "21:00–23:00", type: "timed" },
    ],
    Sunday: [
      { icon: "💨", label: "Buy 1 Get 1", sub: "Happy hour menu items · all day promotion", hours: "14:00–18:00", type: "timed" },
      { icon: "🍵", label: "Free Tea", sub: "With any special shisha order", hours: "All night", type: "all_night" },
      { icon: "🍸", label: "Cocktail Set", sub: "6 best-sellers — 399K", hours: "All night", type: "all_night" },
      { icon: "🌧", label: "20% Off Shisha", sub: "Rainy day special — apply when raining", hours: "Conditional", type: "conditional" },
    ],
  }
  const todayPromos = promosByDay[ict.weekday] ?? promosByDay["Monday"]

  // ── Task board ───────────────────────────────────────────────────────────────
  // useManagerTasks only fetches tasks assigned TO this user, keeping it
  // separate from the owner dashboard which uses useAllDelegationTasks
  const { data: allTasks = [], isLoading: tasksLoading } = useManagerTasks([
    "todo", "in_progress", "blocked", "done",
  ])

  const [columnOverrides, setColumnOverrides] = useState<Record<string, { status: TaskStatus; dueDate?: string }>>({})

  const boardTasks = useMemo(() => (allTasks || []).filter((t) => t.status !== "cancelled"), [allTasks])

  const boardTasksWithOverrides = useMemo(() => boardTasks.map((t) => {
    const ov = columnOverrides[t.id]
    if (!ov) return t
    return { ...t, status: ov.status, dueDate: ov.dueDate !== undefined ? ov.dueDate : t.dueDate }
  }), [boardTasks, columnOverrides])

  const myUserId = profile?.id ?? ""

  const grouped = useMemo(() => {
    const cols: Record<BoardColumnKey, DelegationTask[]> = {
      not_started: [], in_progress: [], finish_today: [], done: [],
    }
    for (const t of boardTasksWithOverrides) {
      if (myUserId && t.assignedTo && t.assignedTo !== myUserId) continue
      cols[mapToBoardColumn(t, todayIso, myUserId)].push(t)
    }
    return cols
  }, [boardTasksWithOverrides, todayIso, myUserId])

  // Tasks delegated BY me to others
  const followUpList = useMemo(() => {
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

  // Tasks delegated TO me FROM others
  const delegatedToMe = useMemo(() => {
    return (allTasks || [])
      .filter((t) =>
        t.assignedTo === myUserId &&
        t.assignedBy !== myUserId &&
        t.status !== "done" &&
        t.status !== "cancelled",
      )
      .slice()
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
        if (a.dueDate) return -1
        if (b.dueDate) return 1
        return 0
      })
      .slice(0, 6)
  }, [allTasks, myUserId])

  const daysRemaining = velocity ? velocity.daysInMonth - velocity.currentDay : null

  const [taskView, setTaskView] = useState<"kanban" | "list">("kanban")
  const staff = useStaffList()
  const people = useMemo(() => (staff.data || []) as any[], [staff.data])

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
    title: "", description: "", notes: "",
    timeStarted: "" as string,
    dueDate: "", dueTime: "",
    category: "operations" as TaskCategory,
    status: "todo" as TaskStatus,
    assignedTo: "",
    priority: "medium" as string,
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
      priority: selectedTask.priority || "medium",
    })
  }, [selectedTask?.id])

  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createDraft, setCreateDraft] = useState<CreateDelegationTaskInput & { priority: string }>(() => ({
    title: "", description: "", notes: "",
    assignedTo: "", dueDate: "", dueTime: "",
    timeStarted: "", category: "operations",
    priority: "medium", status: "todo",
  }))

  function openTask(t: DelegationTask) {
    setSelectedTaskId(t.id)
    setTaskSheetOpen(true)
  }

  function openCreate(col: BoardColumnKey) {
    setCreateError(null)
    const defaultAssignee = people.find((p) => p.role === "manager")?.id || people[0]?.id || ""
    const defaultsByColumn: Partial<CreateDelegationTaskInput> =
      col === "in_progress"
        ? { status: "in_progress", timeStarted: new Date().toISOString() }
        : col === "finish_today"
          ? { status: "todo", dueDate: todayIso }
          : { status: "todo" }
    setCreateDraft({
      title: "", description: "", notes: "",
      assignedTo: defaultAssignee,
      dueDate: defaultsByColumn.dueDate || "",
      dueTime: "", timeStarted: defaultsByColumn.timeStarted || "",
      category: "operations", priority: "medium",
      status: defaultsByColumn.status || "todo",
    })
    setCreateOpen(true)
  }

  function handleMoveTask(taskId: string, toColumn: BoardColumnKey) {
    const col = COLUMNS.find((c) => c.key === toColumn)
    if (!col) return
    const newStatus = col.targetStatus
    const newDueDate = toColumn === "finish_today" ? todayIso : undefined
    setColumnOverrides((prev) => ({
      ...prev,
      [taskId]: { status: newStatus, ...(newDueDate !== undefined && { dueDate: newDueDate }) },
    }))
    updateTask.mutate(
      { id: taskId, status: newStatus, ...(newDueDate !== undefined && { dueDate: newDueDate }) } as any,
      {
        onSettled: () => {
          setColumnOverrides((prev) => {
            const next = { ...prev }
            delete next[taskId]
            return next
          })
        },
      },
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Manager Dashboard</h1>

      {/* ── Section 1: Header (Image 1) ─────────────────────────────────────── */}
      <div className="rounded-card border border-border bg-card px-6 py-4 shadow-card">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-center">
          <div>
            <div className="font-display text-xl tracking-[4px] text-primary">THE ROOF</div>
            <div className="mt-0.5 text-sm font-light tracking-widest text-muted-foreground">
              Da Nang · Club & Lounge
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm tracking-widest text-muted-foreground uppercase">{dateString}</div>
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

      {/* ── Check-In Strip ──────────────────────────────────────────────────── */}
      <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
        {/* Top row: identity + status + buttons */}
        <div className="flex items-center justify-between gap-4 flex-wrap px-5 py-3.5">
          {/* Left: avatar + name + status */}
          <div className="flex items-center gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/20 text-sm font-semibold text-warning">
              {managerInitials}
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{profile?.fullName || firstName}</div>
              <div className="text-xs text-muted-foreground">{managerRoleLabel} · Shift {shiftTimeLabel}</div>
            </div>
            <div className="flex items-center gap-2 pl-2">
              <span className={cn("h-2 w-2 rounded-full shrink-0", checkedIn && !onBreak ? "bg-success" : onBreak ? "bg-warning" : "bg-border")} />
              <span className="text-xs text-muted-foreground">
                {!checkedIn ? "Not checked in" : onBreak ? "On break" : "Checked in"}
              </span>
            </div>
            {checkedIn && (
              <div className="rounded-sm border border-border bg-secondary px-2.5 py-1 font-mono text-xs text-foreground">
                {shiftTimerStr}
              </div>
            )}
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2">
            {showCheckoutConfirm && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                <span className="text-xs text-destructive">End your shift and submit EOD report?</span>
                <button
                  onClick={doCheckOut}
                  className="rounded px-3 py-1 bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Yes, Check Out
                </button>
                <button
                  onClick={() => setShowCheckoutConfirm(false)}
                  className="rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {checkedIn && !showCheckoutConfirm && (
              <button
                onClick={toggleBreak}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  onBreak
                    ? "border-warning/30 bg-warning/10 text-warning hover:bg-warning/20"
                    : "border-border bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {onBreak ? "▶ End Break" : "☕ Take Break"}
              </button>
            )}

            {!showCheckoutConfirm && (
              <button
                onClick={() => {
                  if (!checkedIn) {
                    doCheckIn()
                  } else {
                    setShowCheckoutConfirm(true)
                  }
                }}
                className={cn(
                  "rounded-md px-4 py-1.5 text-xs font-semibold tracking-wide transition-colors",
                  checkedIn
                    ? "border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
                    : "bg-foreground text-background hover:opacity-80"
                )}
              >
                {checkedIn ? "→ Check Out" : "→ Check In"}
              </button>
            )}
          </div>
        </div>

        {/* Timeline log — only visible once checked in */}
        {checkedIn && (
          <div className="border-t border-border bg-secondary/40 px-5 py-3 flex flex-wrap gap-x-8 gap-y-2">
            {/* Checked-in row */}
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
              <span className="text-[11px] text-muted-foreground">Checked in</span>
              <span className="font-mono text-[11px] text-foreground">{checkInTime ? fmtTime(checkInTime) : "--:--"}</span>
              <span className="text-[11px] text-muted-foreground">·</span>
              <span className="font-mono text-[11px] text-foreground">({shiftTimerStr})</span>
            </div>

            {/* Completed breaks */}
            {breakLog.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-warning/60 shrink-0" />
                <span className="text-[11px] text-muted-foreground">Break {i + 1}</span>
                <span className="font-mono text-[11px] text-foreground">{fmtTime(b.start)}</span>
                <span className="text-[11px] text-muted-foreground">–</span>
                <span className="font-mono text-[11px] text-foreground">{fmtTime(b.end)}</span>
                <span className="text-[11px] text-muted-foreground">·</span>
                <span className="font-mono text-[11px] text-foreground">{fmtSecs(b.durationSecs)}</span>
              </div>
            ))}

            {/* Active break — live timer */}
            {onBreak && breakStartTime && (
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse shrink-0" />
                <span className="text-[11px] text-warning font-medium">Break {breakLog.length + 1}</span>
                <span className="font-mono text-[11px] text-foreground">{fmtTime(breakStartTime)}</span>
                <span className="text-[11px] text-muted-foreground">·</span>
                <span className="font-mono text-[11px] text-warning">{breakTimerStr}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* HQ + Weather row */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr] min-w-0">
        <CardShell title="HQ — DA NANG" icon={<Activity className="h-4 w-4" />} className="min-w-0">
          <div className="grid gap-4">
            <AnalogClock hour={ict.hour} minute={ict.minute} second={ict.second} />
            <div className="text-center">
              <div className="font-display text-[26px] tracking-[4px] text-foreground">{timeString}</div>
              <div className="mt-1 text-xs tracking-wider text-muted-foreground uppercase">ICT · UTC+7</div>
            </div>
          </div>
        </CardShell>

        <CardShell title="DA NANG — WEATHER" icon={<CalendarClock className="h-4 w-4" />} className="min-w-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row items-stretch gap-0">
            <div className="min-w-0 sm:min-w-[200px] sm:border-r border-b sm:border-b-0 border-border sm:pr-6 pb-4 sm:pb-0">
              <div className="flex items-center gap-3">
                <div className="text-[32px]">🌤</div>
                <div className="font-display text-[44px] leading-none tracking-[2px] text-foreground">27°</div>
              </div>
              <div className="mt-2 text-xs text-secondary-foreground tracking-wide">Broken Clouds · Humidity 78%</div>
              <div className="mt-3 flex items-center gap-1.5 rounded-sm border border-info/15 bg-info/8 px-2.5 py-1.5 text-xs text-info">
                <Zap className="h-3.5 w-3.5 shrink-0" /> Rain expected Saturday — prep covers & heaters by 13:00
              </div>
            </div>
            <div className="flex flex-1 items-center sm:pl-5 pt-4 sm:pt-0 overflow-x-auto">
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
                    <div className="rounded-sm border border-warning/20 bg-warning/10 px-1 py-0.5 text-sm tracking-wider text-warning uppercase">{x.badge}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </CardShell>
      </div>

      {/* ── Ritual Phase Banner ─────────────────────────────────────────────── */}
      <div className="rounded-card border border-border bg-card px-5 py-3 shadow-card flex items-center justify-between gap-4 flex-wrap">
        {/* Left: phase name + cues */}
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Current Phase</div>
            <div className="font-subheading text-base font-medium italic text-primary">Seduction</div>
          </div>
          <div className="border-l border-border pl-4 text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Now:</span> Amber warm lighting active · Shisha round check due · CharleS set running
            <br />
            <span className="font-semibold text-foreground">Coming:</span> Candle relight at 21:00 · Brief bar team on Girls Wine at 20:45
          </div>
        </div>
        {/* Right: next phase + countdown + phase dots */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-xs text-muted-foreground">
            Next: <span className="font-semibold text-foreground">Expansion</span>
          </div>
          <div className="rounded-sm border border-border bg-secondary px-3 py-1 font-mono text-sm text-foreground">
            {ritualCountdown}
          </div>
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-1 w-6 rounded-full",
                  i === 0 ? "bg-muted-foreground/40" : i === 1 ? "bg-primary" : "bg-border"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 2: Today's Pulse ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionTitle label="TODAY'S PULSE" />

        <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1fr_1fr] items-stretch">

          {/* ── Col 1: Team on Shift ── */}
          <div className="rounded-card border border-border bg-card shadow-card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Team on Shift Today</div>
              {todayShifts.length > 0 && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {todayShifts.length} members
                </span>
              )}
            </div>
            <div className="flex-1 px-4 py-2">
              {todayShifts.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">No shifts scheduled today</div>
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
                            <div className="flex items-center gap-1.5 py-1.5">
                              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: theme.accent }} />
                              <span className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: theme.accent }}>{label}</span>
                              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: theme.badgeBg, color: theme.accent }}>{shifts.length}</span>
                            </div>
                            {shifts.map((shift) => {
                              const initials = (shift.staffName || "?")
                                .split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
                              const isActive = shift.status === "in_progress"
                              return (
                                <div key={shift.id} className="flex items-center gap-2 py-1.5 pl-3 border-b border-border last:border-0" style={{ borderLeft: `2px solid ${theme.accent}22`, marginLeft: '3px', paddingLeft: '8px' }}>
                                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white" style={{ background: theme.accent }}>
                                    {initials}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-foreground truncate">{shift.staffName}</div>
                                    <div className="text-[10px] text-muted-foreground truncate">
                                      {(shift as any).jobRole || shift.role}
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                    {shift.startTime?.slice(0, 5)}–{shift.endTime?.slice(0, 5)}
                                  </span>
                                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isActive ? "bg-success" : "bg-border")} />
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
            {/* View Full Roster link */}
            {todayShifts.length > 0 && (
              <button
                type="button"
                onClick={() => navigate("/manager/schedule")}
                className="flex items-center justify-between w-full px-4 py-3 border-t border-border text-left hover:bg-secondary/40 transition-colors"
              >
                <div>
                  <div className="text-[11px] font-semibold text-foreground">View full roster</div>
                  <div className="text-[10px] text-muted-foreground">See all {todayShifts.length} members scheduled today</div>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">—</span>
              </button>
            )}
            {/* Tasks alert strip */}
            {allTasks.filter(t => t.status !== "done" && t.status !== "cancelled").length > 0 && (
              <div className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/8 px-3 py-2">
                <span className="text-[11px]">⚑</span>
                <span className="flex-1 text-[11px] text-warning">
                  {allTasks.filter(t => t.status !== "done" && t.status !== "cancelled").length} tasks pending
                  {allTasks.filter(t => t.assignedBy !== myUserId && t.status !== "done").length > 0
                    ? ` · ${allTasks.filter(t => t.assignedBy !== myUserId && t.status !== "done").length} from owner`
                    : ""}
                </span>
                <button type="button" onClick={() => navigate("/manager/tasks")}
                  className="text-[11px] font-semibold text-warning underline whitespace-nowrap">
                  View Tasks →
                </button>
              </div>
            )}
          </div>

          {/* ── Col 2: Tasks — Today ── */}
          <div className="rounded-card border border-border bg-card shadow-card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Tasks — Today</div>
              {!isOwnerPreviewing && (
                <span className="text-[11px] text-muted-foreground">
                  {allTasks.filter(t => t.status !== "done" && t.status !== "cancelled").length} pending
                </span>
              )}
            </div>
            <div className="flex-1 px-4 py-2">
              {isOwnerPreviewing ? (
                <div className="py-6 text-center text-xs text-muted-foreground italic">
                  Log in as this manager to see their tasks.
                </div>
              ) : tasksLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">Loading…</div>
              ) : allTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground italic">No tasks today</div>
              ) : (
                allTasks.slice(0, 6).map((task) => {
                  const isDone = task.status === "done"
                  const fromOwner = task.assignedBy !== myUserId
                  const priorityColor =
                    task.priority === "urgent" || task.priority === "high" ? "text-destructive" : "text-warning"
                  return (
                    <div key={task.id} className="flex items-start gap-2 py-2 border-b border-border last:border-0">
                      <button
                        type="button"
                        onClick={() => updateTask.mutateAsync({ id: task.id, status: isDone ? "todo" : "done" })}
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0 rounded-sm border transition-colors",
                          isDone ? "border-success bg-success text-success-foreground" : "border-border bg-background"
                        )}
                      >
                        {isDone && <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-xs leading-snug", isDone ? "line-through text-muted-foreground" : "text-foreground")}>
                          {task.title}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className={cn("text-[10px] font-bold uppercase", isDone ? "text-success" : priorityColor)}>
                            {isDone ? "Done" : task.priority}
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {fromOwner ? "From Owner" : "My Task"}
                          </span>
                        </div>
                      </div>
                      {!isDone && (
                        <button
                          type="button"
                          onClick={() => updateTask.mutateAsync({ id: task.id, status: "blocked" })}
                          className="shrink-0 flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-destructive hover:text-destructive transition-colors mt-0.5"
                        >
                          <ArrowUpRight className="h-3 w-3" /> Escalate
                        </button>
                      )}
                    </div>
                  )
                })
              )}
              {/* Add task inline — hidden when owner is previewing */}
              {!isOwnerPreviewing && <div className="mt-2 flex items-center gap-2 border-t border-dashed border-border pt-2">
                <input
                  type="text"
                  placeholder="+ Add a task..."
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim()
                      if (!val) return
                      createTask.mutateAsync({ title: val, assignedTo: myUserId, priority: "medium", category: "general" })
                      ;(e.target as HTMLInputElement).value = ""
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    const input = (e.currentTarget.previousSibling as HTMLInputElement)
                    const val = input?.value?.trim()
                    if (!val) return
                    createTask.mutateAsync({ title: val, assignedTo: myUserId, priority: "medium", category: "general" })
                    input.value = ""
                  }}
                  className="rounded border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                >
                  Add
                </button>
              </div>}
            </div>
          </div>

          {/* ── Col 3: Reservations ── */}
          <div className="rounded-card border border-border bg-card shadow-card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Reservations</div>
              <span className="text-[11px] text-muted-foreground">
                {allCsvReservations.filter(r => r.status === "today").length} tonight
              </span>
            </div>
            <div className="flex-1 px-4 py-3">
              <div className="font-mono text-[30px] font-normal leading-none text-foreground">
                {csvPaxLoading ? "—" : allCsvReservations.filter(r => r.status === "today").length}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">Confirmed tonight</div>
              {/* Next reservation alert */}
              {(() => {
                const upcoming = allCsvReservations
                  .filter(r => r.status === "upcoming" || r.status === "today")
                  .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
                const next = upcoming[0]
                if (!next) return null
                return (
                  <div className="mt-2 flex items-center gap-2 rounded-md border border-info/25 bg-info/8 px-2.5 py-2">
                    <span className="flex-1 text-[11px] text-info">
                      🕐 Next: {next.name} {next.numberOfGuests ? `(${next.numberOfGuests} pax)` : ""}
                      {next.notes ? ` — ${next.notes}` : ""}
                    </span>
                  </div>
                )
              })()}
              <div className="mt-2 space-y-0 divide-y divide-border">
                {allCsvReservations
                  .filter(r => r.status === "today")
                  .slice(0, 3)
                  .map((r, i) => (
                    <div key={i} className="flex items-center gap-2 py-2">
                      <span className="font-mono text-[11px] font-medium w-10 shrink-0">{r.time}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-foreground truncate">{r.name}</div>
                        {r.notes && <div className="text-[10px] text-muted-foreground truncate">{r.notes}</div>}
                      </div>
                      {r.numberOfGuests > 0 && <span className="font-mono text-[10px] text-muted-foreground shrink-0">{r.numberOfGuests} pax</span>}
                    </div>
                  ))}
              </div>
              {allCsvReservations.filter(r => r.status === "upcoming").length > 0 && (
                <div className="mt-2 inline-flex rounded-sm border border-border bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                  {allCsvReservations.filter(r => r.status === "upcoming").length} upcoming total
                </div>
              )}
            </div>
          </div>

          {/* ── Col 4: Google Rating + Monthly Pax merged ── */}
          <div className="rounded-card border border-border bg-card shadow-card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Google Rating & Monthly Pax</div>
            </div>
            <div className="flex-1 px-4 py-3">
              {/* Rating half */}
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="text-[11px] text-primary">★★★★★</div>
                  <div className="font-mono text-2xl font-normal leading-none text-foreground mt-1">
                    {googleReviews?.rating ? googleReviews.rating.toFixed(1) : "—"}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {googleReviews?.reviewCount ? googleReviews.reviewCount.toLocaleString() : "—"} reviews total
                  </div>
                  {googleReviews?.monthlySummaries && googleReviews.monthlySummaries.length >= 2 && (
                    <div className="mt-2 rounded-sm bg-secondary px-2 py-1.5 text-[10px] text-muted-foreground leading-relaxed">
                      {googleReviews.monthlySummaries[0].count} in <strong className="text-foreground">{googleReviews.monthlySummaries[0].monthLabel}</strong><br/>
                      {googleReviews.monthlySummaries[1].count} so far in <strong className="text-foreground">{googleReviews.monthlySummaries[1].monthLabel}</strong>
                    </div>
                  )}
                </div>
                {/* Vertical divider */}
                <div className="w-px self-stretch bg-border shrink-0" />
                {/* Pax half */}
                <div className="flex-1">
                  <div className="text-[10px] text-muted-foreground mb-1">Monthly Pax</div>
                  <div className="font-mono text-2xl font-normal leading-none text-foreground">
                    {kpiLoading ? "—" : mtdPax.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Target: {paxTarget ? Number(paxTarget).toLocaleString() : "—"}
                  </div>
                  <div className="mt-2 h-1 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", monthlyPaxPercent && monthlyPaxPercent >= 100 ? "bg-success" : "bg-warning")}
                      style={{ width: `${Math.min(100, monthlyPaxPercent ?? 0)}%` }}
                    />
                  </div>
                  {monthlyPaxPercent !== null && (
                    <div className={cn(
                      "mt-1.5 inline-flex rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold",
                      monthlyPaxPercent >= 100
                        ? "border-success/25 bg-success/8 text-success"
                        : "border-warning/25 bg-warning/8 text-warning"
                    )}>
                      {monthlyPaxPercent >= 100 ? "On track" : "Behind"} · {monthlyPaxPercent}%
                    </div>
                  )}
                  {paxTarget && mtdPax < Number(paxTarget) && daysRemaining !== null && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {(Number(paxTarget) - mtdPax).toLocaleString()} pax to go · {daysRemaining} days left
                    </div>
                  )}
                </div>
              </div>
              {/* Divider + review prompt */}
              <div className="my-3 h-px bg-border" />
              <div className="flex items-center gap-2 rounded-md border border-success/25 bg-success/8 px-2.5 py-2">
                <span className="text-[11px]">💬</span>
                <span className="text-[11px] text-success">Prompt guests for Google reviews at close</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Section 3: Task Board (Image 3) ─────────────────────────────────── */}
      <div className="space-y-3">
        <SectionTitle label="TASK BOARD & TEAM ACCOUNTABILITY" />

        {isOwnerPreviewing && (
          <div className="rounded-card border border-warning/30 bg-warning/5 px-5 py-4 text-sm text-warning">
            <span className="font-semibold">Preview mode:</span> The task board is personal to each manager.
            Log in as a manager account to see and manage their tasks.
          </div>
        )}

        {!isOwnerPreviewing && <div className="grid gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]" style={{ alignItems: "start" }}>

          {/* Left: My Tasks kanban */}
          <div>
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="text-xs tracking-wider text-muted-foreground uppercase">My tasks</div>
              <div className="flex items-center gap-2">
                <div className="flex overflow-hidden rounded-sm border border-border bg-secondary">
                  <button type="button" onClick={() => setTaskView("kanban")}
                    className={cn("px-3 py-1 text-xs tracking-wider uppercase", taskView === "kanban" ? "bg-card text-primary shadow-card" : "text-muted-foreground")}>
                    Kanban
                  </button>
                  <button type="button" onClick={() => setTaskView("list")}
                    className={cn("px-3 py-1 text-xs tracking-wider uppercase", taskView === "list" ? "bg-card text-primary shadow-card" : "text-muted-foreground")}>
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
                <div className="grid grid-cols-[1fr_110px_90px_80px] px-3 py-2 text-[10px] tracking-widest text-muted-foreground uppercase border-b border-border">
                  <div>Task</div><div>Status</div><div>Priority</div><div>Due</div>
                </div>
                {(() => {
                  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
                    todo:        { label: "Not Started",  cls: "border-[#6b7280]/30 bg-[#6b7280]/10 text-[#6b7280]" },
                    in_progress: { label: "In Progress",  cls: "border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]" },
                    done:        { label: "Done",         cls: "border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]" },
                    blocked:     { label: "Delegated",    cls: "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]" },
                  }
                  const myTasks = boardTasks.filter((t) => !myUserId || !t.assignedTo || t.assignedTo === myUserId)
                  if (myTasks.length === 0) {
                    return <div className="px-3 py-6 text-center text-xs text-muted-foreground italic">No tasks.</div>
                  }
                  return myTasks.map((t) => {
                    const badge = STATUS_BADGE[t.status] ?? STATUS_BADGE.todo
                    const pri = priorityPill(t.priority)
                    const isOverdue = t.dueDate && t.dueDate < todayIso && t.status !== "done"
                    return (
                      <button key={t.id} type="button" onClick={() => openTask(t)}
                        className={cn("grid w-full grid-cols-[1fr_110px_90px_80px] items-center border-t border-border px-3 py-2.5 text-left hover:bg-secondary/50", t.status === "done" && "opacity-60")}>
                        <div className={cn("text-sm truncate", t.status === "done" ? "line-through text-muted-foreground" : "text-foreground")}>{t.title}</div>
                        <div><span className={cn("rounded-sm border px-1.5 py-0.5 text-[9px] tracking-wide uppercase", badge.cls)}>{badge.label}</span></div>
                        <div><span className={cn("rounded-sm border px-1.5 py-0.5 text-[10px] tracking-wide uppercase", pri.className)}>{pri.label}</span></div>
                        <div className={cn("text-[10px] tabular-nums", isOverdue ? "text-error" : "text-muted-foreground")}>{formatDue(t.dueDate)}</div>
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

          {/* Right: Two panels stacked */}
          <div className="space-y-3">

            {/* Delegated — Follow Up (tasks I delegated to others) */}
            <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <div className="text-xs tracking-widest font-semibold text-foreground uppercase whitespace-nowrap">
                  Delegated — Follow Up
                </div>
                {followUpList.length > 0 && (
                  <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    {followUpList.filter((x) => x.task.dueDate && x.task.dueDate < todayIso && x.task.status !== "done").length > 0 && (
                      <span className="rounded-sm border border-warning/25 bg-warning/8 px-1.5 py-0.5 text-[9px] tracking-wide text-warning uppercase">
                        {followUpList.filter((x) => x.task.dueDate && x.task.dueDate < todayIso && x.task.status !== "done").length} overdue
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div>
                {followUpList.length === 0 ? (
                  <div className="px-4 py-5 text-xs text-muted-foreground italic">No delegated tasks.</div>
                ) : (
                  followUpList.map(({ task, isFresh }) => {
                    const assignee = people.find((p) => p.id === task.assignedTo)
                    const assigneeName = assignee?.full_name || assignee?.email || "Unknown"
                    const assigneeFirst = assigneeName.split(" ")[0]
                    const assigneeInitials = assigneeName.split(" ").filter(Boolean).slice(0, 2).map((x: string) => x[0]).join("").toUpperCase() || "?"
                    const cat = task.category || "general"
                    const isOverdue = task.dueDate && task.dueDate < todayIso && task.status !== "done"
                    const isDone = task.status === "done"
                    const accentCls = isDone ? "border-l-[#10b981]" : isOverdue ? "border-l-[#ef4444]" : isFresh ? "border-l-[#3b82f6]" : "border-l-border"
                    const badge = isDone
                      ? { label: "Done", cls: "border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]" }
                      : isOverdue
                        ? { label: `Overdue ${Math.round((new Date(todayIso).getTime() - new Date(task.dueDate!).getTime()) / 86400000)}d`, cls: "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]" }
                        : task.dueDate === todayIso
                          ? { label: "Today", cls: "border-primary/30 bg-primary/10 text-primary" }
                          : isFresh
                            ? { label: "Today", cls: "border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]" }
                            : { label: "This Week", cls: "border-border bg-secondary text-muted-foreground" }
                    return (
                      <button key={task.id} type="button" onClick={() => openTask(task)}
                        className={cn("w-full text-left flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 border-l-[3px] transition-colors hover:bg-secondary/40", accentCls, isDone && "opacity-60")}>
                        <div className={cn("shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center", isDone ? "border-[#10b981] bg-[#10b981]" : "border-border")}>
                          {isDone && <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn("text-sm font-medium leading-snug truncate", isDone ? "line-through text-muted-foreground" : "text-foreground")}>{task.title}</div>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span>Assigned:</span>
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/20 text-[7px] font-bold text-primary">{assigneeInitials}</span>
                            <span>{assigneeFirst}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="capitalize">{cat}</span>
                          </div>
                        </div>
                        <span className={cn("shrink-0 rounded-sm border px-1.5 py-0.5 text-[9px] tracking-wide uppercase whitespace-nowrap", badge.cls)}>{badge.label}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Delegated From (tasks assigned to me by others) */}
            <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <div className="text-xs tracking-widest font-semibold text-foreground uppercase whitespace-nowrap">
                  Delegated From
                </div>
                {delegatedToMe.length > 0 && (
                  <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground shrink-0">
                    {delegatedToMe.length}
                  </span>
                )}
              </div>
              <div>
                {delegatedToMe.length === 0 ? (
                  <div className="px-4 py-5 text-xs text-muted-foreground italic">No tasks delegated to you.</div>
                ) : (
                  delegatedToMe.map((task) => {
                    const assigner = people.find((p) => p.id === task.assignedBy)
                    const assignerName = assigner?.full_name || task.assignedByProfile?.fullName || "Unknown"
                    const assignerFirst = assignerName.split(" ")[0]
                    const assignerInitials = assignerName.split(" ").filter(Boolean).slice(0, 2).map((x: string) => x[0]).join("").toUpperCase() || "?"
                    const cat = task.category || "general"
                    const isOverdue = task.dueDate && task.dueDate < todayIso && task.status !== "done"
                    const accentCls = isOverdue ? "border-l-[#ef4444]" : task.dueDate === todayIso ? "border-l-primary" : "border-l-[#3b82f6]"
                    const badge = isOverdue
                      ? { label: `Overdue ${Math.round((new Date(todayIso).getTime() - new Date(task.dueDate!).getTime()) / 86400000)}d`, cls: "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]" }
                      : task.dueDate === todayIso
                        ? { label: "Today", cls: "border-primary/30 bg-primary/10 text-primary" }
                        : task.dueDate
                          ? { label: formatDue(task.dueDate), cls: "border-border bg-secondary text-muted-foreground" }
                          : { label: "No due date", cls: "border-border bg-secondary text-muted-foreground" }
                    return (
                      <button key={task.id} type="button" onClick={() => openTask(task)}
                        className={cn("w-full text-left flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 border-l-[3px] transition-colors hover:bg-secondary/40", accentCls)}>
                        <div className="shrink-0 h-5 w-5 rounded-full border-2 border-[#3b82f6] flex items-center justify-center">
                          <span className="text-[7px] font-bold text-[#3b82f6]">{assignerInitials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium leading-snug truncate text-foreground">{task.title}</div>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span>From:</span>
                            <span>{assignerFirst}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="capitalize">{cat}</span>
                          </div>
                        </div>
                        <span className={cn("shrink-0 rounded-sm border px-1.5 py-0.5 text-[9px] tracking-wide uppercase whitespace-nowrap", badge.cls)}>{badge.label}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>}
      </div>

      {/* ── Section 4: Floor Issues + Promo Cheatsheet + Pipeline */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Left column: Floor Issues + Promo Cheatsheet */}
        <div className="space-y-6 lg:col-span-1">

          {/* Floor Issues */}
          <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-warning" />
                <div className="text-xs tracking-widest font-semibold text-foreground uppercase">Floor Issues</div>
              </div>
              <div className="flex items-center gap-2">
                {openIssues.length > 0 && (
                  <span className="rounded-sm border border-warning/25 bg-warning/8 px-2 py-0.5 text-[10px] tracking-wide text-warning uppercase">
                    {openIssues.length} open
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIssueFormOpen(true)}
                  className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] tracking-wider text-muted-foreground uppercase hover:border-primary/30 hover:text-primary transition-colors"
                >
                  <Plus className="h-3 w-3" /> Log issue
                </button>
              </div>
            </div>
            <div className="divide-y divide-border">
              {openIssues.length === 0 ? (
                <div className="px-5 py-6 text-center text-xs text-muted-foreground italic">No open floor issues — all clear ✓</div>
              ) : (
                openIssues.slice(0, 5).map((issue) => {
                  const priorityCls =
                    issue.priority === "high"
                      ? "border-l-[#ef4444]"
                      : issue.priority === "medium"
                        ? "border-l-[#f59e0b]"
                        : "border-l-border"
                  return (
                    <div key={issue.id} className={cn("flex items-start gap-3 px-5 py-3.5 border-l-[3px]", priorityCls)}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground leading-snug">{issue.title}</div>
                        {issue.location && (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" /> {issue.location}</div>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">
                          Logged {new Date(issue.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} · Unresolved
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate("/owner/wishlist")}
                        className="shrink-0 flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] tracking-wider text-muted-foreground uppercase hover:border-primary/30 hover:text-primary transition-colors whitespace-nowrap"
                      >
                        <ArrowUpRight className="h-3 w-3" /> Escalate
                      </button>
                    </div>
                  )
                })
              )}
            </div>
            <div className="px-5 py-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIssueFormOpen(true)}
                className="w-full rounded-sm border border-dashed border-border/60 px-3 py-2 text-[10px] tracking-wider text-muted-foreground uppercase hover:border-primary/40 hover:text-primary transition-colors text-center"
              >
                + Log a new floor issue
              </button>
            </div>
          </div>

          {/* Tonight's Promo Cheatsheet */}
          <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="text-xs tracking-widest font-semibold text-foreground uppercase">Tonight's Promo Cheatsheet</div>
              <span className="rounded-sm border border-primary/25 bg-primary/8 px-2 py-0.5 text-[10px] tracking-wide text-primary uppercase">
                {todayPromos.length} active
              </span>
            </div>
            <div className="divide-y divide-border">
              {todayPromos.map((promo, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="text-2xl shrink-0">{promo.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground leading-tight">{promo.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{promo.sub}</div>
                  </div>
                  <div className={cn(
                    "shrink-0 rounded-sm border px-2 py-0.5 text-[10px] tracking-wide uppercase whitespace-nowrap",
                    promo.type === "all_night"
                      ? "border-success/25 bg-success/8 text-success"
                      : promo.type === "conditional"
                        ? "border-border bg-secondary text-muted-foreground"
                        : "border-primary/25 bg-primary/8 text-primary",
                  )}>
                    {promo.hours}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: This Week's Pipeline */}
        <div className="rounded-card border border-border bg-card shadow-card overflow-hidden h-fit lg:col-span-2">
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
                <div className="min-w-0">
                  <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-0.5 lg:hidden">DJ 1</div>
                  <div className={cn("text-xs truncate", row.dj1 === "—" ? "text-muted-foreground/40" : "text-secondary-foreground")}>{row.dj1}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-0.5 lg:hidden">DJ 2</div>
                  <div className={cn("text-xs truncate", row.dj2 === "—" ? "text-muted-foreground/40" : "text-secondary-foreground")}>{row.dj2}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-0.5 lg:hidden">Genre</div>
                  <div className={cn("text-xs truncate", row.genre === "—" ? "text-muted-foreground/40" : "text-secondary-foreground")}>{row.genre}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs tracking-widest font-semibold text-foreground uppercase mb-0.5 lg:hidden">Promotion</div>
                  <div className={cn("text-xs", row.promo === "—" ? "text-muted-foreground/40" : "text-secondary-foreground")}>{row.promo}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Dialogs & Sheets ─────────────────────────────────────────────────── */}

      {/* Edit Tonight's Revenue */}
      <Dialog open={tonightEditOpen} onOpenChange={setTonightEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tonight's revenue (manual)</DialogTitle></DialogHeader>
          <div className="grid gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">VND amount</div>
            <input
              inputMode="numeric"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. 42500000"
              value={tonightDraft}
              onChange={(e) => setTonightDraft(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTonightEditOpen(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={upsertDailyInput.isPending}
              onClick={async () => {
                const value = Number(tonightDraft.replace(/[^\d.-]/g, "") || 0)
                await upsertDailyInput.mutateAsync({ date: todayIso, tonightsRevenue: value })
                setTonightEditOpen(false)
              }}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit monthly PAX target */}
      <Dialog open={paxTargetEditOpen} onOpenChange={setPaxTargetEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Monthly pax target</DialogTitle></DialogHeader>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaxTargetEditOpen(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={upsertMonthlyTarget.isPending}
              onClick={async () => {
                const value = Number(paxTargetDraft.replace(/[^\d.-]/g, "") || 0)
                if (value > 0) {
                  await upsertMonthlyTarget.mutateAsync({ metric: "pax", periodStartIso, value })
                }
                setPaxTargetEditOpen(false)
              }}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Floor Issue dialog */}
      <Dialog open={issueFormOpen} onOpenChange={setIssueFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Log a Floor Issue
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">Issue description</div>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. AC unit on west side making noise"
                value={issueDraft.title}
                onChange={(e) => setIssueDraft((s) => ({ ...s, title: e.target.value }))}
              />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">Location</div>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Table 5, Bar area, Entrance"
                value={issueDraft.location}
                onChange={(e) => setIssueDraft((s) => ({ ...s, location: e.target.value }))}
              />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">Additional details</div>
              <textarea
                rows={3}
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                placeholder="Any extra context…"
                value={issueDraft.description}
                onChange={(e) => setIssueDraft((s) => ({ ...s, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIssueFormOpen(false); setIssueDraft({ title: "", description: "", location: "" }) }}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!issueDraft.title.trim() || createMaintenance.isPending}
              onClick={async () => {
                await createMaintenance.mutateAsync({
                  title: issueDraft.title.trim(),
                  description: issueDraft.description || null,
                  location: issueDraft.location || null,
                  category: "other",
                  priority: "medium",
                  status: "open",
                })
                setIssueFormOpen(false)
                setIssueDraft({ title: "", description: "", location: "" })
              }}
            >
              Log Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task detail sheet */}
      <Sheet open={taskSheetOpen} onOpenChange={(open) => { setTaskSheetOpen(open); if (!open) setSelectedTaskId(null) }}>
        <SheetContent side="right" className="sm:max-w-[540px] p-0 flex flex-col gap-0 overflow-hidden">
          {selectedTask ? (
            <>
              <div className="flex-1 overflow-y-auto px-8 pt-10 pb-6 space-y-6">
                <textarea
                  rows={2}
                  className="w-full resize-none bg-transparent text-2xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 leading-snug"
                  placeholder="Untitled"
                  value={editDraft.title}
                  onChange={(e) => setEditDraft((s) => ({ ...s, title: e.target.value }))}
                />
                {taskError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{taskError}</div>
                )}
                <div className="divide-y divide-border border border-border rounded-md overflow-hidden">
                  {/* Status */}
                  <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                    <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground"><span>◎</span> Status</div>
                    <div className="flex-1 flex flex-wrap gap-1.5 py-2">
                      {[
                        { value: "todo",        label: "Not Started", color: "bg-[#6b7280]/15 text-[#6b7280] border-[#6b7280]/25" },
                        { value: "in_progress", label: "In Progress", color: "bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/25" },
                        { value: "finish_today", label: "Finish Today", color: "bg-primary/15 text-primary border-primary/25" },
                        { value: "blocked",     label: "Delegated",   color: "bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/25" },
                        { value: "done",        label: "Done",        color: "bg-[#10b981]/15 text-[#10b981] border-[#10b981]/25" },
                      ].map((s) => (
                        <button key={s.value} type="button"
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
                        >{s.label}</button>
                      ))}
                    </div>
                  </div>
                  {/* Due date */}
                  <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                    <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5 shrink-0" /> Day</div>
                    <div className="flex-1 flex items-center gap-3">
                      <input type="date" className="bg-transparent text-sm text-foreground outline-none cursor-pointer"
                        value={editDraft.dueDate} onChange={(e) => setEditDraft((s) => ({ ...s, dueDate: e.target.value }))} />
                    </div>
                  </div>
                  {/* Category */}
                  <div className="flex items-start min-h-[40px] px-4 py-2 hover:bg-secondary/40 transition-colors">
                    <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground pt-1"><Tag className="h-3.5 w-3.5 shrink-0" /> Category</div>
                    <div className="flex-1 flex flex-wrap gap-1.5">
                      {CATEGORY_OPTIONS.map((o) => (
                        <button key={o.value} type="button" onClick={() => setEditDraft((d) => ({ ...d, category: o.value }))}
                          className={cn("rounded-sm border px-2 py-0.5 text-[10px] tracking-wide transition-all",
                            editDraft.category === o.value ? "border-primary/30 bg-primary/10 text-primary font-semibold" : "border-border bg-transparent text-muted-foreground hover:bg-secondary")}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Assigned to */}
                  <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                    <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground"><User className="h-3.5 w-3.5 shrink-0" /> Assigned to</div>
                    <div className="flex-1">
                      <select className="w-full bg-transparent text-sm text-foreground outline-none cursor-pointer"
                        value={editDraft.assignedTo} onChange={(e) => setEditDraft((s) => ({ ...s, assignedTo: e.target.value }))}>
                        <option value="">Select person…</option>
                        {people.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.full_name || p.email || p.id}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {/* Priority */}
                  <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                    <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground"><span>!</span> Priority</div>
                    <div className="flex-1 flex gap-1.5">
                      {[
                        { value: "low", label: "Low", dot: "bg-[#6b7280]" },
                        { value: "medium", label: "Medium", dot: "bg-[#f59e0b]" },
                        { value: "high", label: "High", dot: "bg-[#f97316]" },
                        { value: "urgent", label: "Urgent", dot: "bg-[#ef4444]" },
                      ].map((p) => (
                        <button key={p.value} type="button" onClick={() => setEditDraft((d) => ({ ...d, priority: p.value }))}
                          className={cn("flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] tracking-wide transition-all",
                            editDraft.priority === p.value ? "border-border bg-secondary text-foreground font-semibold" : "border-transparent bg-transparent text-muted-foreground hover:bg-secondary")}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} />{p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Description */}
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground px-1">Description</div>
                  <textarea rows={4}
                    className="w-full resize-none rounded-sm border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-border/80"
                    placeholder="Add a description…"
                    value={editDraft.description}
                    onChange={(e) => setEditDraft((s) => ({ ...s, description: e.target.value }))} />
                </div>
              </div>
              {/* Footer */}
              <div className="shrink-0 border-t border-border px-8 py-4 flex items-center justify-between gap-3 bg-card">
                <button type="button" disabled={deleteTask.isPending}
                  onClick={async () => {
                    setTaskError(null)
                    try {
                      await deleteTask.mutateAsync(selectedTask.id)
                      setTaskSheetOpen(false)
                      setSelectedTaskId(null)
                    } catch (e) { setTaskError((e as Error)?.message || "Failed to delete") }
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-error transition-colors">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setTaskSheetOpen(false); setSelectedTaskId(null) }}>Cancel</Button>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90"
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
                      } catch (e) { setTaskError((e as Error)?.message || "Failed to save") }
                    }}>
                    Save changes
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Create task sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="sm:max-w-[540px] p-0 flex flex-col gap-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-8 pt-10 pb-6 space-y-6">
            <textarea autoFocus rows={2}
              className="w-full resize-none bg-transparent text-2xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 leading-snug"
              placeholder="Untitled"
              value={createDraft.title}
              onChange={(e) => setCreateDraft((s) => ({ ...s, title: e.target.value }))} />
            {createError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{createError}</div>
            )}
            <div className="divide-y divide-border border border-border rounded-md overflow-hidden">
              {/* Status */}
              <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground"><span>◎</span> Status</div>
                <div className="flex-1 flex flex-wrap gap-1.5 py-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button key={s.value} type="button" onClick={() => setCreateDraft((d) => ({ ...d, status: s.value as TaskStatus }))}
                      className={cn("rounded-sm border px-2 py-0.5 text-[10px] tracking-wide transition-all",
                        createDraft.status === s.value ? "border-primary/30 bg-primary/10 text-primary font-semibold" : "border-border bg-transparent text-muted-foreground hover:bg-secondary")}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Due date */}
              <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5 shrink-0" /> Day</div>
                <div className="flex-1">
                  <input type="date" className="bg-transparent text-sm text-foreground outline-none cursor-pointer"
                    value={createDraft.dueDate || ""}
                    onChange={(e) => setCreateDraft((s) => ({ ...s, dueDate: e.target.value }))} />
                </div>
              </div>
              {/* Category */}
              <div className="flex items-start min-h-[40px] px-4 py-2 hover:bg-secondary/40 transition-colors">
                <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground pt-1"><Tag className="h-3.5 w-3.5 shrink-0" /> Category</div>
                <div className="flex-1 flex flex-wrap gap-1.5">
                  {CATEGORY_OPTIONS.map((o) => (
                    <button key={o.value} type="button" onClick={() => setCreateDraft((d) => ({ ...d, category: o.value }))}
                      className={cn("rounded-sm border px-2 py-0.5 text-[10px] tracking-wide transition-all",
                        createDraft.category === o.value ? "border-primary/30 bg-primary/10 text-primary font-semibold" : "border-border bg-transparent text-muted-foreground hover:bg-secondary")}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Assigned to */}
              <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground"><User className="h-3.5 w-3.5 shrink-0" /> Assigned to</div>
                <div className="flex-1">
                  <select className="w-full bg-transparent text-sm text-foreground outline-none cursor-pointer"
                    value={createDraft.assignedTo}
                    onChange={(e) => setCreateDraft((s) => ({ ...s, assignedTo: e.target.value }))}>
                    <option value="">Select person…</option>
                    {people.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.full_name || p.email || p.id}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Priority */}
              <div className="flex items-center min-h-[40px] px-4 hover:bg-secondary/40 transition-colors">
                <div className="w-32 shrink-0 flex items-center gap-2 text-xs text-muted-foreground"><span>!</span> Priority</div>
                <div className="flex-1 flex gap-1.5">
                  {[
                    { value: "low", label: "Low", dot: "bg-[#6b7280]" },
                    { value: "medium", label: "Medium", dot: "bg-[#f59e0b]" },
                    { value: "high", label: "High", dot: "bg-[#f97316]" },
                    { value: "urgent", label: "Urgent", dot: "bg-[#ef4444]" },
                  ].map((p) => (
                    <button key={p.value} type="button" onClick={() => setCreateDraft((d) => ({ ...d, priority: p.value as any }))}
                      className={cn("flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] tracking-wide transition-all",
                        createDraft.priority === p.value ? "border-border bg-secondary text-foreground font-semibold" : "border-transparent bg-transparent text-muted-foreground hover:bg-secondary")}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} />{p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Description */}
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground px-1">Description</div>
              <textarea rows={3}
                className="w-full resize-none rounded-sm border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-border/80"
                placeholder="Add a description…"
                value={createDraft.description || ""}
                onChange={(e) => setCreateDraft((s) => ({ ...s, description: e.target.value }))} />
            </div>
          </div>
          {/* Footer */}
          <div className="shrink-0 border-t border-border px-8 py-4 flex justify-end gap-2 bg-card">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={createTask.isPending || !createDraft.title.trim() || !createDraft.assignedTo}
              onClick={async () => {
                setCreateError(null)
                try {
                  await createTask.mutateAsync({
                    title: createDraft.title.trim(),
                    description: createDraft.description || undefined,
                    assignedTo: createDraft.assignedTo,
                    dueDate: createDraft.dueDate || undefined,
                    dueTime: createDraft.dueTime || undefined,
                    category: createDraft.category,
                    priority: createDraft.priority as any,
                    status: createDraft.status,
                  })
                  setCreateOpen(false)
                } catch (e) { setCreateError((e as Error)?.message || "Failed to create") }
              }}>
              Create task
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
