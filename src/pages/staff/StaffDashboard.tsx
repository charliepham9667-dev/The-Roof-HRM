import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, AlertTriangle, CloudSun, Zap, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '../../stores/authStore';
import { useShifts, useUpcomingShiftReminder } from '../../hooks/useShifts';
import { useClockIn, useClockOut, useClockStatus } from '../../hooks/useClockRecords';
import { useMyAssignedTasks } from '../../hooks/useDelegationTasks';
import { useRoofCalendarWeekData } from '@/hooks/useWeekAtGlanceCsv';
import { cn } from '@/lib/utils';
import type { DelegationTask } from '../../types';

function formatPipelineWhen(dateIso: string, startTime: string | null, endTime: string | null) {
  const [y, m, d] = dateIso.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dayName = dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
  const dateStr = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
  if (!startTime) return `${dayName} ${dateStr}`
  const time = endTime ? `${startTime} – ${endTime}` : startTime
  return `${dayName} ${dateStr}, ${time}`
}

interface BreakEntry { start: Date; end: Date; durationSecs: number }

// ─── helpers ────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function pad(n: number) { return String(n).padStart(2, '0'); }


function fmtShift(t: string) { return t.slice(0, 5); }

function capitalize(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return now;
}

// ─── section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── panel wrapper ─────────────────────────────────────────────────────────────

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-card border border-border bg-card shadow-card ${className}`}>
      {children}
    </div>
  );
}

function PanelHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{title}</span>
      {right && <div>{right}</div>}
    </div>
  );
}

// small badge variants
function Pill({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'amber' | 'gold' | 'green' }) {
  const cls = {
    default: 'bg-muted text-muted-foreground',
    amber: 'bg-amber-50 text-amber-700 border border-amber-200',
    gold: 'bg-amber-50 text-amber-700 border border-amber-200',
    green: 'bg-success/10 text-success border border-success/20',
  }[variant];
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>;
}

// ─── shift row item ───────────────────────────────────────────────────────────

function SRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
      <span className="mt-0.5 w-5 shrink-0 text-center text-sm">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

// ─── main dashboard ───────────────────────────────────────────────────────────

export function StaffDashboard() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const now = useClock();
  const todayStr = now.toISOString().split('T')[0];

  // ── Weekly pipeline ──────────────────────────────────────────────────────────
  const { data: roofCalendar } = useRoofCalendarWeekData()
  const roofEvents = roofCalendar?.events ?? []
  const weekDates = useMemo(() => {
    const [y, m, d] = todayStr.split("-").map(Number)
    const anchor = new Date(Date.UTC(y, m - 1, d))
    const dowMon0 = (anchor.getUTCDay() + 6) % 7
    const start = new Date(Date.UTC(y, m - 1, d - dowMon0))
    const dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(start)
      dt.setUTCDate(start.getUTCDate() + i)
      const iso = dt.toISOString().slice(0, 10)
      return { day: dayNames[i], dateNum: dt.getUTCDate(), iso }
    })
  }, [todayStr])
  const pipelineRows = useMemo(() => {
    const byDate = new Map<string, typeof roofEvents>()
    for (const e of roofEvents) {
      if (!e.dateIso) continue
      const list = byDate.get(e.dateIso) || []
      list.push(e)
      byDate.set(e.dateIso, list)
    }
    return weekDates.map((d) => {
      const dayEvents = (byDate.get(d.iso) || []).filter((e) => e.eventName).sort((a, b) => (a.startMinutes ?? 999999) - (b.startMinutes ?? 999999))
      const first = dayEvents[0]
      if (!first) return { iso: d.iso, isToday: d.iso === todayStr, event: "TBD", when: formatPipelineWhen(d.iso, null, null), dj1: "—", dj2: "—", genre: "—", promo: "—" }
      const extra = Math.max(0, dayEvents.length - 1)
      return { iso: d.iso, isToday: d.iso === todayStr, event: `${first.eventName}${extra ? ` +${extra} more` : ""}`, when: formatPipelineWhen(d.iso, first.startTime, first.endTime), dj1: first.dj1 || "—", dj2: first.dj2 || "—", genre: first.genre || "—", promo: first.promotion || "—" }
    })
  }, [roofEvents, weekDates, todayStr])

  const { data: shifts } = useShifts(now);
  useUpcomingShiftReminder();
  const clockInMut = useClockIn();
  const clockOutMut = useClockOut();
  const { isLoading: clockStatusLoading } = useClockStatus();
  const { data: delegatedTasks = [], isLoading: delegatedLoading, isError: delegatedError, refetch: refetchDelegated } = useMyAssignedTasks();

  // ── local check-in / break state (mirrors manager dashboard) ──────────────
  const [checkedIn, setCheckedIn] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [shiftElapsed, setShiftElapsed] = useState(0);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState<Date | null>(null);
  const [breakElapsed, setBreakElapsed] = useState(0);
  const [breakLog, setBreakLog] = useState<BreakEntry[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'warning' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (!checkedIn || !checkInTime) return;
    const id = window.setInterval(() => setShiftElapsed(Math.floor((Date.now() - checkInTime.getTime()) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [checkedIn, checkInTime]);

  useEffect(() => {
    if (!onBreak || !breakStartTime) return;
    const id = window.setInterval(() => setBreakElapsed(Math.floor((Date.now() - breakStartTime.getTime()) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [onBreak, breakStartTime]);

  function fmtSecs(secs: number) {
    return `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;
  }
  function fmtHM(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

  const showToast = (type: 'success' | 'warning' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleClockIn = async () => {
    try {
      const r = await clockInMut.mutateAsync({});
      setCheckedIn(true);
      setCheckInTime(new Date());
      setShiftElapsed(0);
      setOnBreak(false);
      setBreakLog([]);
      showToast(r.isWithinGeofence ? 'success' : 'warning',
        r.isWithinGeofence ? 'Clocked in successfully!' : `Clocked in — ${Math.round(r.distanceFromVenue || 0)}m from venue`);
    } catch (e: any) { showToast('error', e.message || 'Failed to clock in'); }
  };

  const handleClockOut = async () => {
    try {
      await clockOutMut.mutateAsync({});
      setCheckedIn(false);
      setOnBreak(false);
      setCheckInTime(null);
      setShiftElapsed(0);
      setBreakStartTime(null);
      setBreakElapsed(0);
      setBreakLog([]);
      showToast('success', 'Clocked out. See you next shift!');
    } catch (e: any) { showToast('error', e.message || 'Failed to clock out'); }
    setShowCheckoutConfirm(false);
  };

  function toggleBreak() {
    if (!onBreak) {
      setBreakStartTime(new Date());
      setBreakElapsed(0);
      setOnBreak(true);
    } else {
      const now2 = new Date();
      const dur = breakStartTime ? Math.floor((now2.getTime() - breakStartTime.getTime()) / 1000) : 0;
      if (breakStartTime) setBreakLog((prev) => [...prev, { start: breakStartTime, end: now2, durationSecs: dur }]);
      setOnBreak(false);
      setBreakStartTime(null);
      setBreakElapsed(0);
    }
  }

  const clkPending = clockInMut.isPending || clockOutMut.isPending;

  const todayShift = shifts?.find((s) => s.staffId === profile?.id && s.shiftDate === todayStr);
  const firstName = profile?.fullName?.split(' ')[0] || 'Staff';
  const userRole = (profile?.jobRole as string) || todayShift?.role || 'staff';
  const initials = (profile?.fullName || 'ST').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  type PromoType = 'all_night' | 'timed' | 'conditional';
  type PromoItem = { icon: string; label: string; sub: string; hours: string; type: PromoType };
  const promosByDay: Record<string, PromoItem[]> = {
    Monday: [
      { icon: '💨', label: 'Buy 1 Get 1', sub: 'Happy hour menu items · all day promotion', hours: '14:00–18:00', type: 'timed' },
      { icon: '🍵', label: 'Free Tea', sub: 'With any special shisha order', hours: 'ALL NIGHT', type: 'all_night' },
      { icon: '🍸', label: 'Cocktail Set', sub: '6 best-sellers — 399K', hours: 'ALL NIGHT', type: 'all_night' },
      { icon: '🌧', label: '20% Off Shisha', sub: 'Rainy day special — apply when raining', hours: 'CONDITIONAL', type: 'conditional' },
    ],
    Tuesday: [
      { icon: '💨', label: 'Buy 1 Get 1', sub: 'Happy hour menu items · all day promotion', hours: '14:00–18:00', type: 'timed' },
      { icon: '🍵', label: 'Free Tea', sub: 'With any special shisha order', hours: 'ALL NIGHT', type: 'all_night' },
      { icon: '🍸', label: 'Cocktail Set', sub: '6 best-sellers — 399K', hours: 'ALL NIGHT', type: 'all_night' },
      { icon: '🌧', label: '20% Off Shisha', sub: 'Rainy day special — apply when raining', hours: 'CONDITIONAL', type: 'conditional' },
    ],
    Wednesday: [
      { icon: '💨', label: 'Buy 1 Get 1', sub: 'Happy hour menu items · all day promotion', hours: '14:00–18:00', type: 'timed' },
      { icon: '🍵', label: 'Free Tea', sub: 'With any special shisha order', hours: 'ALL NIGHT', type: 'all_night' },
      { icon: '🍸', label: 'Cocktail Set', sub: '6 best-sellers — 399K', hours: 'ALL NIGHT', type: 'all_night' },
      { icon: '🌧', label: '20% Off Shisha', sub: 'Rainy day special — apply when raining', hours: 'CONDITIONAL', type: 'conditional' },
    ],
    Thursday: [
      { icon: '💨', label: 'Buy 1 Get 1', sub: 'Happy hour menu items · all day promotion', hours: '14:00–18:00', type: 'timed' },
      { icon: '🍵', label: 'Free Tea', sub: 'With any special shisha order', hours: 'ALL NIGHT', type: 'all_night' },
      { icon: '🍸', label: 'Cocktail Set', sub: '6 best-sellers — 399K', hours: 'ALL NIGHT', type: 'all_night' },
      { icon: '🌧', label: '20% Off Shisha', sub: 'Rainy day special — apply when raining', hours: 'CONDITIONAL', type: 'conditional' },
    ],
    Friday: [
      { icon: '💨', label: 'Buy 1 Get 1', sub: 'Happy hour menu items · all day promotion', hours: '14:00–18:00', type: 'timed' },
      { icon: '🍵', label: 'Free Tea', sub: 'With any special shisha order', hours: 'ALL NIGHT', type: 'all_night' },
      { icon: '🍸', label: 'Cocktail Set', sub: '6 best-sellers — 399K', hours: 'ALL NIGHT', type: 'all_night' },
      { icon: '🌧', label: '20% Off Shisha', sub: 'Rainy day special — apply when raining', hours: 'CONDITIONAL', type: 'conditional' },
    ],
    Saturday: [
      { icon: '💨', label: 'Buy 1 Get 1', sub: 'Happy hour menu items · all day promotion', hours: '14:00–18:00', type: 'timed' },
      { icon: '🍵', label: 'Free Tea', sub: 'With any special shisha order', hours: 'ALL NIGHT', type: 'all_night' },
      { icon: '🍸', label: 'Cocktail Set', sub: '6 best-sellers — 399K', hours: 'ALL NIGHT', type: 'all_night' },
      { icon: '🌧', label: '20% Off Shisha', sub: 'Rainy day special — apply when raining', hours: 'CONDITIONAL', type: 'conditional' },
      { icon: '🍷', label: 'Girls Night — Free Flow Wine', sub: 'All girls free flow wine 21:00–23:00', hours: '21:00–23:00', type: 'timed' },
    ],
    Sunday: [
      { icon: '💨', label: 'Buy 1 Get 1', sub: 'Happy hour menu items · all day promotion', hours: '14:00–18:00', type: 'timed' },
      { icon: '🍵', label: 'Free Tea', sub: 'With any special shisha order', hours: 'ALL NIGHT', type: 'all_night' },
      { icon: '🍸', label: 'Cocktail Set', sub: '6 best-sellers — 399K', hours: 'ALL NIGHT', type: 'all_night' },
      { icon: '🌧', label: '20% Off Shisha', sub: 'Rainy day special — apply when raining', hours: 'CONDITIONAL', type: 'conditional' },
    ],
  };
  const todayWeekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const todayPromos: PromoItem[] = promosByDay[todayWeekday] ?? promosByDay['Monday'];

  return (
    <div className="flex flex-col gap-4">

      {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}
      <div className="rounded-card border border-border bg-card shadow-card">
        <div className="flex flex-col gap-1.5 px-4 md:px-6 py-3.5 md:flex-row md:items-center md:justify-between">
          {/* Brand */}
          <div>
            <div className="font-display text-base tracking-[4px] text-primary">THE ROOF</div>
            <div className="mt-0.5 text-[11px] font-light tracking-widest text-muted-foreground">Da Nang · Club &amp; Lounge</div>
          </div>

          {/* Centre */}
          <div className="md:text-center min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground truncate">{dateLabel}</div>
            <div className="mt-0.5 font-serif italic text-[14px] text-foreground">{getGreeting()}, {firstName}</div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Open 14:00 – 02:00</span>
            {todayPromos.length > 0 && (
              <span className="rounded border border-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] shrink-0">
                {todayPromos[0].label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── CHECK-IN STRIP ──────────────────────────────────────────────────── */}
      <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
        {/* Top row */}
        <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          {/* Left: avatar + name + status + timer */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">
              {initials}
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{profile?.fullName}</div>
              <div className="text-xs text-muted-foreground">
                {capitalize(userRole)}{todayShift ? ` · Shift ${fmtShift(todayShift.startTime)} – ${fmtShift(todayShift.endTime)}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2 pl-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${
                checkedIn && !onBreak ? 'bg-success' : onBreak ? 'bg-warning animate-pulse' : 'bg-border'
              }`} />
              <span className="text-xs text-muted-foreground">
                {!checkedIn ? 'Not checked in' : onBreak ? 'On break' : 'Checked in'}
              </span>
            </div>
            {checkedIn && (
              <div className="rounded-sm border border-border bg-secondary px-2.5 py-1 font-mono text-xs text-foreground">
                {fmtSecs(shiftElapsed)}
              </div>
            )}
          </div>

          {/* Right: buttons */}
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {toast && (
              <div className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${
                toast.type === 'success' ? 'bg-success/10 text-success' :
                toast.type === 'warning' ? 'bg-warning/10 text-warning' :
                'bg-error/10 text-error'
              }`}>
                {toast.type === 'success' ? <CheckCircle className="h-3.5 w-3.5" /> :
                 toast.type === 'warning' ? <AlertTriangle className="h-3.5 w-3.5" /> :
                 <XCircle className="h-3.5 w-3.5" />}
                {toast.msg}
              </div>
            )}

            {showCheckoutConfirm && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                <span className="text-xs text-destructive">End your shift and clock out?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClockOut}
                  disabled={clkPending}
                  className="h-auto px-3 py-1 text-xs font-semibold"
                >
                  {clkPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, Check Out'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCheckoutConfirm(false)}
                  className="h-auto px-3 py-1 text-xs"
                >
                  Cancel
                </Button>
              </div>
            )}

            {checkedIn && !showCheckoutConfirm && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleBreak}
                className={`h-auto px-3 py-1.5 text-xs font-medium ${
                  onBreak
                    ? 'border-warning/30 bg-warning/10 text-warning hover:bg-warning/20 hover:text-warning'
                    : ''
                }`}
              >
                {onBreak ? '▶ End Break' : '☕ Take Break'}
              </Button>
            )}

            {!showCheckoutConfirm && (
              checkedIn ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCheckoutConfirm(true)}
                  disabled={clkPending || clockStatusLoading}
                  className="h-auto px-4 py-1.5 text-xs font-semibold tracking-wide border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {clkPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '→ Check Out'}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleClockIn}
                  disabled={clkPending || clockStatusLoading}
                  className="h-auto px-4 py-1.5 text-xs font-semibold tracking-wide"
                >
                  {clkPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '→ Check In'}
                </Button>
              )
            )}
          </div>
        </div>

        {/* Timeline log — visible once checked in */}
        {checkedIn && (
          <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-border bg-secondary/40 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
              <span className="text-[11px] text-muted-foreground">Checked in</span>
              <span className="font-mono text-[11px] text-foreground">{checkInTime ? fmtHM(checkInTime) : '--:--'}</span>
              <span className="text-[11px] text-muted-foreground">·</span>
              <span className="font-mono text-[11px] text-foreground">({fmtSecs(shiftElapsed)})</span>
            </div>

            {breakLog.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning/60" />
                <span className="text-[11px] text-muted-foreground">Break {i + 1}</span>
                <span className="font-mono text-[11px] text-foreground">{fmtHM(b.start)}</span>
                <span className="text-[11px] text-muted-foreground">–</span>
                <span className="font-mono text-[11px] text-foreground">{fmtHM(b.end)}</span>
                <span className="text-[11px] text-muted-foreground">·</span>
                <span className="font-mono text-[11px] text-foreground">{fmtSecs(b.durationSecs)}</span>
              </div>
            ))}

            {onBreak && breakStartTime && (
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-warning" />
                <span className="text-[11px] font-medium text-warning">Break {breakLog.length + 1}</span>
                <span className="font-mono text-[11px] text-foreground">{fmtHM(breakStartTime)}</span>
                <span className="text-[11px] text-muted-foreground">·</span>
                <span className="font-mono text-[11px] text-warning">{fmtSecs(breakElapsed)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────────────── */}

      {/* Weather row */}
      <div className="grid grid-cols-1 gap-3.5">

        {/* Weather placeholder */}
        <Panel className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:gap-0">
          <div className="flex-1">
            <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground"><CloudSun className="h-3 w-3 shrink-0" /> Da Nang — Weather</p>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl">⛅</span>
              <span className="text-[22px] sm:text-[28px] font-light text-foreground">27°</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Broken Clouds · Humidity 78%</p>
            <div className="mt-2 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 sm:inline-flex sm:items-center">
              <Zap className="mt-0.5 h-3 w-3 shrink-0 sm:mt-0" /> Rain expected Saturday — prep covers &amp; heaters by 13:00
            </div>
          </div>
          {/* forecast */}
          <div className="flex shrink-0 overflow-x-auto">
            {[
              { d: 'TUE', i: '⛅', h: '27°', l: '22°' },
              { d: 'WED', i: '🌥', h: '25°', l: '22°' },
              { d: 'THU', i: '🌧', h: '25°', l: '22°' },
              { d: 'FRI', i: '🌧', h: '25°', l: '22°' },
              { d: 'SAT', i: '⛈', h: '25°', l: '20°', prep: true },
              { d: 'SUN', i: '🌤', h: '25°', l: '22°' },
              { d: 'MON', i: '🌤', h: '25°', l: '22°' },
            ].map((day) => (
              <div key={day.d} className="flex flex-col items-center gap-0.5 border-l border-border px-3 py-1 first:border-l-0">
                <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{day.d}</span>
                <span className="text-base">{day.i}</span>
                <span className="text-[12px] font-medium text-foreground">{day.h}</span>
                <span className="text-[10px] text-muted-foreground">{day.l}</span>
                {day.prep && (
                  <span className="mt-0.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-700">PREP</span>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* This Week's Pipeline */}
      <div className="rounded-card shadow-card overflow-hidden" style={{ border: "1px solid #e2ddd7", background: "#fff" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2ddd7", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1714" }}>This Week's Pipeline</div>
        </div>
        {pipelineRows.map((row, idx) => {
          const isPast = row.iso < todayStr
          const genres = row.genre !== "—" ? row.genre.split(/[,;]+/).map((g) => g.trim()).filter(Boolean) : []
          const promos = row.promo !== "—" ? row.promo.split(/[,;]+/).map((p) => p.trim()).filter(Boolean) : []
          return (
            <div
              key={`${row.iso}-${idx}`}
              className={cn("border-b border-[#e2ddd7] px-4 py-3 last:border-b-0", row.isToday && "bg-[#fdf3e7]")}
              style={{ opacity: isPast ? 0.55 : 1 }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={cn("text-sm font-semibold truncate", row.isToday ? "text-[#b5620a]" : row.event === "TBD" ? "italic text-[#9c9590]" : "text-[#1a1714]")}>
                    {row.event}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#9c9590]">{row.when}</div>
                </div>
                {row.isToday && (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white" style={{ background: "#b5620a" }}>Tonight</span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-[#9c9590]">DJ 1: </span>{row.dj1}</div>
                <div><span className="text-[#9c9590]">DJ 2: </span>{row.dj2}</div>
              </div>
              {(genres.length > 0 || promos.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {genres.map((g) => <span key={g} className="rounded border border-[#e2ddd7] bg-[#f0ece6] px-1.5 py-0.5 text-[10px] text-[#6b6560]">{g}</span>)}
                  {promos.map((p) => <span key={p} className="rounded border border-[#b8e0c8] bg-[#edf5f0] px-1.5 py-0.5 text-[10px] text-[#2d7a4f]">{p}</span>)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Today's Pulse */}
      <SectionLabel>Today's Pulse</SectionLabel>

      {/* Pulse row: Shift · Tasks · Promos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">

        {/* My Shift */}
        <Panel>
          <PanelHeader
            title="My Shift Tonight"
            right={todayShift && <Pill>{capitalize(todayShift.role)}</Pill>}
          />
          {todayShift ? (
            <>
              <SRow icon="🕐" label="Shift Hours">
                <span className="text-[13px] font-medium text-foreground">{fmtShift(todayShift.startTime)} – {fmtShift(todayShift.endTime)}</span>
              </SRow>
              <SRow icon="👔" label="Role Tonight">
                <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200 capitalize">
                  {todayShift.role}
                </span>
              </SRow>
              <SRow icon="📍" label="Status">
                <span className="text-[13px] font-medium text-foreground capitalize">
                  {todayShift.status.replace('_', ' ')}
                </span>
              </SRow>
              {checkedIn && checkInTime && (
                <SRow icon="⏱" label="Clocked In">
                  <span className="text-[13px] font-medium text-foreground">{fmtHM(checkInTime)}</span>
                </SRow>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-8 text-[13px] text-muted-foreground">
              No shift scheduled today
            </div>
          )}
        </Panel>

        {/* Tasks */}
        <Panel>
          <PanelHeader
            title="Tasks — Today"
            right={<Pill variant="amber">{delegatedTasks.length} assigned</Pill>}
          />
          <div className="px-4 py-3 text-[12px] text-muted-foreground">
            Manage your assigned work in My Tasks. Checklist tracking has moved to Zalo.
          </div>
          <div className="border-t border-border px-4 py-2.5">
            <Button
              variant="outline"
              onClick={() => navigate('/staff/tasks')}
              className="w-full h-auto py-2 text-[12px] font-medium"
            >
              Open My Tasks
            </Button>
          </div>
        </Panel>

        {/* Tonight's Promo Cheatsheet */}
        <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-foreground">Tonight's Promo Cheatsheet</div>
            <span className="rounded-sm border border-primary/25 bg-primary/8 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
              {todayPromos.length} Active
            </span>
          </div>
          <div className="divide-y divide-border">
            {todayPromos.map((promo, i) => (
              <div key={i} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <span className="shrink-0 text-2xl">{promo.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-tight text-foreground">{promo.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{promo.sub}</div>
                  </div>
                </div>
                <div className={`shrink-0 whitespace-nowrap rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                  promo.type === 'all_night'
                    ? 'border-success/25 bg-success/8 text-success'
                    : promo.type === 'conditional'
                      ? 'border-border bg-secondary text-muted-foreground'
                      : 'border-primary/25 bg-primary/8 text-primary'
                }`}>
                  {promo.hours}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delegated to me */}
      <div className="space-y-2">
        <SectionLabel>Delegated to me</SectionLabel>
        <Panel>
          <PanelHeader
            title="Tasks from manager"
            right={
              delegatedTasks.length > 0 && (
                <button
                  onClick={() => navigate('/staff/tasks')}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  View all →
                </button>
              )
            }
          />
          {delegatedLoading && !delegatedError ? (
            <div className="flex items-center justify-center py-8 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading…
            </div>
          ) : delegatedError ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-2">
              <p className="text-[13px] text-muted-foreground">Unable to load delegated tasks.</p>
              <button onClick={() => refetchDelegated()} className="text-xs underline text-muted-foreground hover:text-foreground">Retry</button>
            </div>
          ) : delegatedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <p className="text-[13px] text-muted-foreground">No tasks delegated to you yet</p>
              <p className="text-[11px] text-muted-foreground mt-1">Check back when your manager assigns tasks</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {delegatedTasks.slice(0, 5).map((task: DelegationTask) => (
                  <div
                    key={task.id}
                    onClick={() => navigate('/staff/tasks')}
                    className="flex items-start gap-2 px-4 py-3 hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <CheckSquare className={cn("h-4 w-4 mt-0.5 shrink-0", task.status === 'done' ? 'text-success' : 'text-muted-foreground')} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[13px] font-medium", task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground')}>
                        {task.title}
                      </p>
                      {task.assignedByProfile?.fullName && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">From {task.assignedByProfile.fullName}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {delegatedTasks.length > 5 && (
                <div className="border-t border-border px-4 py-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/staff/tasks')}
                    className="w-full h-auto py-2 text-[12px] font-medium"
                  >
                    View all {delegatedTasks.length} tasks
                  </Button>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>

    </div>
  );
}

export default StaffDashboard;
