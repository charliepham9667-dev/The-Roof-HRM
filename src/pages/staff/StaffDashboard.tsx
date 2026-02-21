import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, ListChecks, AlertTriangle, CloudSun, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '../../stores/authStore';
import { useShifts, useUpcomingShiftReminder } from '../../hooks/useShifts';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { useClockIn, useClockOut, useClockStatus } from '../../hooks/useClockRecords';
import { useMyTaskTemplates, useTaskCompletion, useToggleTaskItem } from '../../hooks/useTasks';
import type { TaskTemplate } from '../../types';

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

// ─── analog clock ────────────────────────────────────────────────────────────

function AnalogClock({ date }: { date: Date }) {
  const h = (date.getHours() % 12) * 30 + date.getMinutes() * 0.5;
  const m = date.getMinutes() * 6 + date.getSeconds() * 0.1;
  const s = date.getSeconds() * 6;
  const hand = (deg: number, len: number) => ({
    x2: 26 + len * Math.sin((deg * Math.PI) / 180),
    y2: 26 - len * Math.cos((deg * Math.PI) / 180),
  });
  return (
    <svg width="56" height="56" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r="24.5" fill="none" stroke="var(--border-color)" strokeWidth="1.5" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return (
          <line key={i}
            x1={26 + 20 * Math.sin(a)} y1={26 - 20 * Math.cos(a)}
            x2={26 + 23 * Math.sin(a)} y2={26 - 23 * Math.cos(a)}
            stroke="currentColor" strokeWidth="1" className="text-muted-foreground/40"
          />
        );
      })}
      <line x1="26" y1="26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-foreground" {...hand(h, 11)} />
      <line x1="26" y1="26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-foreground" {...hand(m, 16)} />
      <line x1="26" y1="26" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-primary" {...hand(s, 19)} />
      <circle cx="26" cy="26" r="2.5" className="fill-foreground" />
    </svg>
  );
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

// ─── task row ────────────────────────────────────────────────────────────────


// ─── checklist panel ─────────────────────────────────────────────────────────

function ChecklistPanel({ role }: { role: string }) {
  const [tab, setTab] = useState<'opening' | 'closing'>(() => {
    const h = new Date().getHours();
    return h < 16 ? 'opening' : 'closing';
  });
  const { data: templates, isLoading } = useMyTaskTemplates(tab);
  const roleLabel = capitalize(role) || 'Your Role';

  // aggregate progress across all templates

  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
            Daily Checklist — {roleLabel}
          </span>
        </div>
        <div className="flex gap-1.5">
          {(['opening', 'closing'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-0.5 text-[11px] font-medium capitalize transition-colors ${
                tab === t
                  ? 'bg-foreground text-background'
                  : 'border border-border text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !templates?.length ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
          <ListChecks className="h-6 w-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No {tab} checklist for your role</p>
        </div>
      ) : (
        templates.map((tpl) => <ChecklistTemplate key={tpl.id} template={tpl} />)
      )}
    </Panel>
  );
}

function ChecklistTemplate({ template }: { template: TaskTemplate }) {
  const { data: completion } = useTaskCompletion(template.id);
  const toggle = useToggleTaskItem();
  const done = completion?.completedTasks ?? [];
  const total = template.tasks.length;
  const count = done.length;
  const pct = total ? Math.round((count / total) * 100) : 0;
  const isDone = (name: string) => done.some((t) => t.taskName === name);

  return (
    <div>
      {/* progress header */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <div className="flex-1">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {template.name}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">{count} / {total}</span>
          </div>
          <div className="h-[3px] overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-300 ${pct === 100 ? 'bg-success' : 'bg-primary'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* items */}
      <div>
        {template.tasks.map((task, i) => {
          const checked = isDone(task.name);
          return (
            <div
              key={i}
              onClick={() => toggle.mutate({ template, currentCompletedTasks: done, taskName: task.name })}
              className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-muted/20 transition-colors"
            >
              {/* checkbox */}
              <div className={`flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[3px] border transition-all ${
                checked ? 'border-success bg-success' : 'border-border bg-card'
              }`}>
                {checked && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className={`flex-1 text-[12px] leading-snug ${checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                {task.name}
              </span>
            </div>
          );
        })}
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

  const { data: shifts } = useShifts(now);
  const { data: announcements } = useAnnouncements();
  useUpcomingShiftReminder();
  const clockInMut = useClockIn();
  const clockOutMut = useClockOut();
  const { isLoading: clockStatusLoading } = useClockStatus();

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
  const recentAnns = (announcements || []).slice(0, 3);

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
        <div className="flex items-center justify-between px-6 py-3.5">
          {/* Brand */}
          <div>
            <div className="font-display text-base tracking-[4px] text-primary">THE ROOF</div>
            <div className="mt-0.5 text-[11px] font-light tracking-widest text-muted-foreground">Da Nang · Club &amp; Lounge</div>
          </div>

          {/* Centre */}
          <div className="text-center min-w-0 shrink-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground whitespace-nowrap">{dateLabel}</div>
            <div className="mt-0.5 font-serif italic text-[14px] text-foreground whitespace-nowrap">{getGreeting()}, {firstName}</div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground">Open 14:00 – 02:00</span>
            {todayPromos.length > 0 && (
              <span className="rounded border border-foreground px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em]">
                {todayPromos[0].label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── CHECK-IN STRIP ──────────────────────────────────────────────────── */}
      <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
        {/* Top row */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
          {/* Left: avatar + name + status + timer */}
          <div className="flex items-center gap-4">
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
          <div className="flex items-center gap-2">
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

      {/* Clock + Weather row */}
      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-3.5">

        {/* Clock card */}
        <Panel className="flex flex-col items-center gap-2 px-3.5 py-4">
          <span className="self-start flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground"><Zap className="h-3 w-3 shrink-0" /> HQ — Da Nang</span>
          <AnalogClock date={now} />
          <span className="font-mono text-[22px] font-medium tabular-nums text-foreground">
            {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
          </span>
          <span className="text-[10px] text-muted-foreground">ICT · UTC+7</span>
        </Panel>

        {/* Weather placeholder */}
        <Panel className="flex items-center px-5 py-4">
          <div className="flex-1">
            <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground"><CloudSun className="h-3 w-3 shrink-0" /> Da Nang — Weather</p>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl">⛅</span>
              <span className="text-[28px] font-light text-foreground">27°</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Broken Clouds · Humidity 78%</p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              <Zap className="h-3 w-3 shrink-0" /> Rain expected Saturday — prep covers &amp; heaters by 13:00
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
          <PanelHeader title="Tasks — Today" right={<Pill variant="amber">Daily checklist</Pill>} />
          <div
            onClick={() => navigate('/staff/checklists')}
            className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
          >
            <ListChecks className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-[13px] font-medium text-foreground">View your daily checklist</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Opening &amp; closing tasks for {capitalize(userRole)}</p>
            </div>
            <span className="text-muted-foreground text-xs">→</span>
          </div>
          <div className="border-t border-border px-4 py-2">
            <Button
              variant="outline"
              onClick={() => navigate('/staff/checklists')}
              className="w-full h-auto py-2 text-[12px] font-medium"
            >
              Open Checklist
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
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <span className="shrink-0 text-2xl">{promo.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-tight text-foreground">{promo.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{promo.sub}</div>
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

      {/* My Checklist & Announcements */}
      <SectionLabel>My Checklist &amp; Announcements</SectionLabel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">

        {/* Checklist */}
        <ChecklistPanel role={userRole} />

        {/* Announcements */}
        <Panel>
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">Announcements</span>
            <button onClick={() => navigate('/announcements')} className="text-[11px] font-medium text-primary underline hover:no-underline">
              View all
            </button>
          </div>
          {recentAnns.length > 0 ? (
            recentAnns.map((ann) => (
              <div
                key={ann.id}
                onClick={() => navigate(`/announcements/${ann.id}`)}
                className="cursor-pointer border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/20 transition-colors"
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${ann.isRead ? 'bg-muted-foreground/50' : 'bg-success'}`} />
                  <span className="text-[12px] font-semibold text-foreground">{ann.author?.fullName || 'Staff'}</span>
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                    {new Date(ann.publishedAt || ann.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                </div>
                <p className="line-clamp-2 pl-[13px] text-[12px] leading-relaxed text-muted-foreground">{ann.body}</p>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center py-8 text-[13px] text-muted-foreground">
              No announcements
            </div>
          )}
        </Panel>

      </div>
    </div>
  );
}

export default StaffDashboard;
