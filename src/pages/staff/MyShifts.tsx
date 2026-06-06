import { useState, useMemo } from 'react';
import { X, Loader2, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '../../stores/authStore';
import { useShifts } from '../../hooks/useShifts';
import type { Shift } from '../../hooks/useShifts';

// ─── helpers ─────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0'); }

function getMonWeekStart(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function toISO(d: Date) { return d.toISOString().split('T')[0]; }

function fmtShiftTime(t: string) { return t.slice(0, 5); }

function shiftHours(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}.${pad2(Math.round(m / 60 * 100)).slice(0, 2)}h` : `${h}h`;
}

function shiftHoursNum(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

function nextShiftLabel(shift: Shift, todayIso: string) {
  const d = new Date(shift.shiftDate + 'T12:00:00');
  if (shift.shiftDate === todayIso) return 'Tonight';
  const diff = Math.round((d.getTime() - new Date().setHours(0,0,0,0)) / 86400000);
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function relativeDays(shiftDate: string, todayIso: string) {
  const diff = Math.round(
    (new Date(shiftDate + 'T12:00:00').getTime() - new Date(todayIso + 'T12:00:00').getTime()) / 86400000
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `In ${diff} days`;
}

function weekRangeLabel(weekStart: Date) {
  const end = addDays(weekStart, 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(weekStart)} – ${fmt(end)}, ${end.getFullYear()}`;
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' '); }

// ─── Swap Modal ───────────────────────────────────────────────────────────────

interface SwapModalProps {
  shift: Shift | null;
  teammates: string[];
  onClose: () => void;
  onSubmit: (shiftId: string, colleague: string, note: string) => void;
  submitting: boolean;
}

function SwapModal({ shift, teammates, onClose, onSubmit, submitting }: SwapModalProps) {
  const [selected, setSelected] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(false);

  if (!shift) return null;

  function handleSubmit() {
    if (!selected) { setError(true); setTimeout(() => setError(false), 1200); return; }
    onSubmit(shift!.id, selected, note);
  }

  const timeLabel = `${shift.shiftDate} · ${fmtShiftTime(shift.startTime)}–${fmtShiftTime(shift.endTime)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="text-sm font-semibold text-foreground">Request Shift Swap</span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Info strip */}
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠ Swap requests require manager approval and will be reviewed before confirmation.
          </div>

          {/* Shift being swapped */}
          <div className="flex items-start gap-3 rounded-md border border-border px-3 py-3">
            <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Shift to swap</div>
              <div className="mt-0.5 text-sm font-medium text-foreground">{timeLabel}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{capitalize(shift.role)}</div>
            </div>
          </div>

          {/* Colleague selector */}
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Who do you want to swap with?
            </div>
            {teammates.length === 0 ? (
              <p className="text-xs text-muted-foreground">No teammates found for this shift.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {teammates.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelected(name)}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      selected === name
                        ? 'border-blue-300 bg-blue-50 text-blue-800'
                        : error
                        ? 'border-red-300'
                        : 'border-border bg-secondary hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                      {name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-foreground">{name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Note to manager (optional)
            </div>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for swap request e.g. personal appointment…"
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-border px-5 py-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-auto py-2.5 text-sm font-medium"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 h-auto py-2.5 text-sm font-semibold"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Request →'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MyShifts() {
  const profile = useAuthStore((s) => s.profile);
  const todayIso = toISO(new Date());

  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => {
    const base = getMonWeekStart(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const { data: allShifts = [], isLoading } = useShifts(weekStart);
  const myShifts = useMemo(() => allShifts.filter((s) => s.staffId === profile?.id), [allShifts, profile?.id]);

  // Build 7-day array Mon–Sun
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Swap state — stored as Set of shiftIds that have pending swaps
  const [pendingSwaps, setPendingSwaps] = useState<Set<string>>(new Set());
  const [swapTarget, setSwapTarget] = useState<Shift | null>(null);
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const [swapBannerText, setSwapBannerText] = useState('');
  const [showBanner, setShowBanner] = useState(false);

  function openSwap(shift: Shift) { setSwapTarget(shift); }
  function closeSwap() { setSwapTarget(null); }

  function handleSwapSubmit(shiftId: string, colleague: string, _note: string) {
    setSwapSubmitting(true);
    setTimeout(() => {
      setPendingSwaps((prev) => new Set([...prev, shiftId]));
      const shift = myShifts.find((s) => s.id === shiftId);
      if (shift) {
        setSwapBannerText(
          `Swap request pending: You requested to swap your ${shift.shiftDate} shift with ${colleague}. Waiting for manager approval.`
        );
        setShowBanner(true);
      }
      setSwapSubmitting(false);
      setSwapTarget(null);
    }, 600);
  }

  // Get teammates on same shift date (other staff, not the user)
  function getTeammates(shift: Shift): string[] {
    return allShifts
      .filter((s) => s.shiftDate === shift.shiftDate && s.staffId !== profile?.id && s.staffName)
      .map((s) => s.staffName!.split(' ')[0])
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 6);
  }

  // Week summary stats
  const weekShifts = myShifts.filter((s) => weekDays.some((d) => toISO(d) === s.shiftDate));
  const weekHours = weekShifts.reduce((sum, s) => sum + shiftHoursNum(s.startTime, s.endTime), 0);
  const pendingSwapCount = weekShifts.filter((s) => pendingSwaps.has(s.id)).length;

  // Next upcoming shift (today or future)
  const upcomingShifts = myShifts
    .filter((s) => s.shiftDate >= todayIso)
    .sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));
  const nextShift = upcomingShifts[0] ?? null;

  // Capitalize role label
  function roleLabel(shift: Shift) {
    return capitalize(shift.role);
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── PAGE HEADER ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My Shifts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View your schedule, upcoming shifts, and manage swap requests
        </p>
      </div>

      {/* ── WEEK SUMMARY STATS ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5">
        {[
          {
            label: 'This Week',
            value: String(weekShifts.length),
            sub: 'Shifts scheduled',
            valueClass: 'text-green-600',
          },
          {
            label: 'Hours This Week',
            value: `${Math.round(weekHours * 10) / 10}h`,
            sub: `Across ${weekShifts.length} shift${weekShifts.length !== 1 ? 's' : ''}`,
            valueClass: 'text-foreground',
          },
          {
            label: 'Next Shift',
            value: nextShift ? nextShiftLabel(nextShift, todayIso) : '—',
            sub: nextShift
              ? `${fmtShiftTime(nextShift.startTime)} – ${fmtShiftTime(nextShift.endTime)} · ${roleLabel(nextShift)}`
              : 'No upcoming shifts',
            valueClass: 'text-amber-600',
            valueSmall: true,
          },
          {
            label: 'Swap Requests',
            value: pendingSwapCount > 0 ? `${pendingSwapCount} Pending` : 'None',
            sub: pendingSwapCount > 0 ? 'Awaiting manager approval' : 'No pending swaps',
            valueClass: 'text-foreground',
            valueSmall: true,
          },
        ].map((s) => (
          <div key={s.label} className="rounded-card border border-border bg-card px-5 py-4 shadow-card min-w-0">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</div>
            <div className={`font-mono leading-none truncate ${s.valueClass} ${s.valueSmall ? 'text-lg font-semibold' : 'text-[26px] font-medium'}`}>
              {s.value}
            </div>
            <div className="mt-1.5 text-[11px] text-muted-foreground truncate">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── SWAP PENDING BANNER ──────────────────────────────────────── */}
      {showBanner && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <span className="text-lg">🔄</span>
          <span className="flex-1">
            <strong className="font-semibold">Swap request pending:</strong>{' '}
            {swapBannerText.replace('Swap request pending: ', '')}
          </span>
          <button
            onClick={() => setShowBanner(false)}
            className="rounded-md border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            Withdraw
          </button>
        </div>
      )}

      {/* ── WEEK CALENDAR GRID ───────────────────────────────────────── */}
      <div>
        {/* Header: section label + navigation */}
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">This Week</span>
            <div className="h-px w-8 bg-border" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setWeekOffset((p) => p - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm text-muted-foreground transition-colors hover:bg-secondary"
            >
              ‹
            </button>
            <span className="min-w-[160px] text-center text-sm font-medium text-foreground">
              {weekRangeLabel(weekStart)}
            </span>
            <button
              onClick={() => setWeekOffset((p) => p + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm text-muted-foreground transition-colors hover:bg-secondary"
            >
              ›
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary"
            >
              Today
            </button>
          </div>
        </div>

        {/* Mobile: stacked day cards */}
        <div className="space-y-2 md:hidden">
          {weekDays.map((day) => {
            const iso = toISO(day);
            const isToday = iso === todayIso;
            const dayShift = myShifts.find((s) => s.shiftDate === iso) ?? null;
            const hasPendingSwap = dayShift ? pendingSwaps.has(dayShift.id) : false;
            const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const dayName = DAY_NAMES[weekDays.indexOf(day)];

            return (
              <div
                key={iso}
                className={`rounded-lg border px-4 py-3 ${
                  isToday ? 'border-amber-500 bg-amber-50/50' : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className={`text-sm font-semibold ${isToday ? 'text-amber-700' : 'text-foreground'}`}>
                      {dayName} {day.getDate()}
                    </div>
                    {dayShift ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {fmtShiftTime(dayShift.startTime)} – {fmtShiftTime(dayShift.endTime)} · {roleLabel(dayShift)}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs italic text-muted-foreground">Day off</div>
                    )}
                  </div>
                  {dayShift && (
                    <div className="text-right">
                      <div className="font-mono text-xs text-muted-foreground">
                        {shiftHours(dayShift.startTime, dayShift.endTime)}
                      </div>
                      {hasPendingSwap && (
                        <div className="mt-1 text-[9px] font-semibold uppercase text-blue-600">Swap Pending</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: 7-day grid */}
        <div className="relative hidden md:block">
          <div className="overflow-x-auto pb-1 scrollbar-none">
          <div className="grid grid-cols-7 gap-2.5">
          {weekDays.map((day) => {
            const iso = toISO(day);
            const isToday = iso === todayIso;
            const dayShift = myShifts.find((s) => s.shiftDate === iso) ?? null;
            const hasPendingSwap = dayShift ? pendingSwaps.has(dayShift.id) : false;
            const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const dayName = DAY_NAMES[weekDays.indexOf(day)];

            return (
              <div
                key={iso}
                className={`flex min-h-[140px] flex-col overflow-hidden rounded-lg border transition-colors ${
                  isToday
                    ? 'border-amber-500 border-[1.5px]'
                    : 'border-border hover:border-muted-foreground/40'
                } ${!dayShift ? 'bg-secondary/60 opacity-75' : 'bg-card'}`}
              >
                {/* Day header */}
                <div className={`border-b border-border px-3 py-2 ${isToday ? 'bg-amber-600' : ''}`}>
                  <div className={`text-[10px] font-semibold uppercase tracking-wider ${isToday ? 'text-amber-100' : 'text-muted-foreground'}`}>
                    {dayName}
                  </div>
                  <div className={`font-mono text-lg font-medium leading-none mt-0.5 ${isToday ? 'text-white' : 'text-foreground'}`}>
                    {day.getDate()}
                  </div>
                </div>

                {/* Day body */}
                <div className="flex flex-1 flex-col gap-1.5 p-2">
                  {dayShift ? (
                    <>
                      <div
                        className={`flex-1 cursor-pointer rounded-md border p-2 transition-colors ${
                          hasPendingSwap
                            ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                            : 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                        }`}
                        onClick={() => !hasPendingSwap && openSwap(dayShift)}
                      >
                        <div className={`font-mono text-[11px] font-medium ${hasPendingSwap ? 'text-blue-700' : 'text-amber-700'}`}>
                          {fmtShiftTime(dayShift.startTime)}–{fmtShiftTime(dayShift.endTime)}
                        </div>
                        <div className="mt-1 text-[11px] font-medium text-foreground">{roleLabel(dayShift)}</div>
                        {getTeammates(dayShift).length > 0 && (
                          <div className="mt-1 text-[10px] text-muted-foreground line-clamp-1">
                            {getTeammates(dayShift).join(' · ')}
                          </div>
                        )}
                        {hasPendingSwap && (
                          <div className="mt-1.5 inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-blue-600">
                            🔄 Swap Pending
                          </div>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {shiftHours(dayShift.startTime, dayShift.endTime)}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-1 items-center justify-center text-[11px] italic text-muted-foreground">
                      Day off
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
          </div>{/* end overflow-x-auto */}
          {/* Right-edge fade — visible only when calendar can scroll (below xl) */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-10 xl:hidden bg-gradient-to-l from-background to-transparent" />
        </div>{/* end relative */}
      </div>

      {/* ── UPCOMING SHIFTS TABLE ────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Upcoming Shifts</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Mobile: card list */}
        <div className="space-y-3 md:hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : upcomingShifts.length === 0 ? (
            <div className="rounded-card border border-border bg-card py-12 text-center text-sm text-muted-foreground shadow-card">
              No upcoming shifts.
            </div>
          ) : (
            upcomingShifts.slice(0, 10).map((shift) => {
              const isPending = pendingSwaps.has(shift.id);
              const teammates = getTeammates(shift);
              const dur = shiftHours(shift.startTime, shift.endTime);
              const rel = relativeDays(shift.shiftDate, todayIso);
              const d = new Date(shift.shiftDate + 'T12:00:00');
              const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

              return (
                <div key={shift.id} className="rounded-card border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{dateLabel}</div>
                      <div className="text-[11px] text-muted-foreground">{rel}</div>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground shrink-0">{dur}</div>
                  </div>
                  <div className="mt-2 font-mono text-sm text-foreground">
                    {fmtShiftTime(shift.startTime)} – {fmtShiftTime(shift.endTime)}
                  </div>
                  {teammates.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">{teammates.join(' · ')}</div>
                  )}
                  {shift.notes && (
                    <div className="mt-1 text-[11px] italic text-muted-foreground">{shift.notes}</div>
                  )}
                  <div className="mt-3">
                    {isPending ? (
                      <div className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                        🔄 Swap Pending
                      </div>
                    ) : (
                      <button
                        onClick={() => openSwap(shift)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                      >
                        ⇄ Request Swap
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden overflow-x-auto rounded-card border border-border bg-card shadow-card md:block">
          {/* Table header */}
          <div className="grid grid-cols-[180px_140px_80px_1fr_auto] border-b border-border bg-secondary/60 px-4 py-2.5">
            {['Date', 'Hours', 'Duration', 'Team & Manager', ''].map((h) => (
              <div key={h} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {h}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : upcomingShifts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No upcoming shifts.</div>
          ) : (
            upcomingShifts.slice(0, 10).map((shift) => {
              const isPending = pendingSwaps.has(shift.id);
              const teammates = getTeammates(shift);
              const dur = shiftHours(shift.startTime, shift.endTime);
              const rel = relativeDays(shift.shiftDate, todayIso);
              const d = new Date(shift.shiftDate + 'T12:00:00');
              const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

              return (
                <div
                  key={shift.id}
                  className="grid grid-cols-[180px_140px_80px_1fr_auto] items-center border-b border-border px-4 py-3 last:border-b-0 transition-colors hover:bg-secondary/40"
                >
                  {/* Date */}
                  <div>
                    <div className="text-sm font-medium text-foreground">{dateLabel}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{rel}</div>
                  </div>

                  {/* Hours */}
                  <div className="font-mono text-sm text-muted-foreground">
                    {fmtShiftTime(shift.startTime)} – {fmtShiftTime(shift.endTime)}
                  </div>

                  {/* Duration */}
                  <div className="font-mono text-sm font-medium text-foreground">{dur}</div>

                  {/* Team */}
                  <div>
                    {teammates.length > 0 && (
                      <div className="text-xs text-muted-foreground">{teammates.join(' · ')}</div>
                    )}
                    {shift.notes && (
                      <div className="mt-0.5 text-[11px] italic text-muted-foreground">{shift.notes}</div>
                    )}
                  </div>

                  {/* Swap button */}
                  <div className="pl-4">
                    {isPending ? (
                      <div className="flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                        🔄 Swap Pending
                      </div>
                    ) : (
                      <button
                        onClick={() => openSwap(shift)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                      >
                        ⇄ Request Swap
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── SWAP MODAL ───────────────────────────────────────────────── */}
      {swapTarget && (
        <SwapModal
          shift={swapTarget}
          teammates={getTeammates(swapTarget)}
          onClose={closeSwap}
          onSubmit={handleSwapSubmit}
          submitting={swapSubmitting}
        />
      )}
    </div>
  );
}

export default MyShifts;
