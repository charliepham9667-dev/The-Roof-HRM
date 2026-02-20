import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useEvents } from '@/hooks/useEvents';
import { useShifts } from '@/hooks/useShifts';
import { usePromotions } from '@/hooks/usePromotions';
import type { CalendarEvent } from '@/types';
import type { Shift } from '@/hooks/useShifts';
import type { Promotion } from '@/hooks/usePromotions';

// ─── helpers ─────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0'); }
function toISO(d: Date) { return d.toISOString().split('T')[0]; }

function getMonWeekStart(d: Date) {
  const c = new Date(d); c.setHours(0, 0, 0, 0);
  const dow = c.getDay(); // 0=Sun
  c.setDate(c.getDate() - (dow === 0 ? 6 : dow - 1));
  return c;
}

function addDays(d: Date, n: number) {
  const c = new Date(d); c.setDate(c.getDate() + n); return c;
}

function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }

function firstDowOfMonth(y: number, m: number) {
  const dow = new Date(y, m - 1, 1).getDay();
  return dow === 0 ? 6 : dow - 1; // Mon=0
}

function fmtTime(t: string | null | undefined) {
  if (!t) return '';
  return t.slice(0, 5);
}

function fmtWeekRange(ws: Date) {
  const we = addDays(ws, 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(ws)} – ${fmt(we)}, ${we.getFullYear()}`;
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Classify event type → pill style
type PillKind = 'dj' | 'theme' | 'private' | 'holiday' | 'shift' | 'promo';

function eventKind(ev: CalendarEvent): PillKind {
  const t = ev.eventType;
  if (t === 'holiday') return 'holiday';
  if (t === 'special_event') {
    const title = ev.title.toLowerCase();
    if (title.includes('dj') || title.includes('live')) return 'dj';
    if (title.includes('private') || title.includes('booking')) return 'private';
    return 'theme';
  }
  if (t === 'promotion') return 'promo';
  return 'theme';
}

const PILL_CLASSES: Record<PillKind, string> = {
  dj:      'bg-amber-50 border border-amber-200 text-amber-800',
  theme:   'bg-purple-50 border border-purple-200 text-purple-800',
  private: 'bg-blue-50 border border-blue-200 text-blue-700',
  holiday: 'bg-red-50 border border-red-200 text-red-700',
  shift:   'bg-green-50 border border-green-200 text-green-700',
  promo:   'bg-rose-50 border border-rose-200 text-rose-700',
};

const KIND_ICON: Record<PillKind, string> = {
  dj: '🎧', theme: '🎭', private: '🔒', holiday: '🎌', shift: '⏱', promo: '🏷',
};

// ─── Side panel ──────────────────────────────────────────────────────────────

interface SidePanelProps {
  dateStr: string;
  events: CalendarEvent[];
  myShift: Shift | null;
  teamShifts: Shift[];
  promos: Promotion[];
  isManager: boolean;
}

function SidePanel({ dateStr, events, myShift, teamShifts, promos, isManager }: SidePanelProps) {
  const d = new Date(dateStr + 'T12:00:00');
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
  const dateFull = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const activePromos = promos.filter((p) =>
    p.isActive && p.status === 'active' &&
    p.startDate <= dateStr && (!p.endDate || p.endDate >= dateStr)
  );

  const teamMembers = teamShifts.filter((s) => s.shiftDate === dateStr);

  const hasContent = events.length || myShift || activePromos.length || teamMembers.length;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="border-b border-border px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{dateFull}</div>
        <div className="mt-1 font-serif text-xl font-medium text-foreground">{dayName}</div>
      </div>

      {!hasContent ? (
        <div className="flex flex-col items-center justify-center flex-1 px-5 py-12 text-center">
          <span className="text-3xl mb-2">🌙</span>
          <p className="text-sm text-muted-foreground">No events planned</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Regular operations</p>
        </div>
      ) : (
        <>
          {/* Tonight's events */}
          {events.length > 0 && (
            <div className="border-b border-border px-5 py-4">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Tonight's Events
              </div>
              <div className="space-y-3">
                {events.map((ev) => {
                  const kind = eventKind(ev);
                  return (
                    <div key={ev.id} className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-sm">{KIND_ICON[kind]}</span>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {ev.eventType.replace('_', ' ')}
                        </div>
                        <div className="text-sm font-medium text-foreground">{ev.title}</div>
                        {(ev.startTime || ev.description) && (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {ev.startTime && `${fmtTime(ev.startTime)}${ev.endTime ? `–${fmtTime(ev.endTime)}` : ''}`}
                            {ev.startTime && ev.description && ' · '}
                            {ev.description}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active promos */}
          {activePromos.length > 0 && (
            <div className="border-b border-border px-5 py-4">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Active Promotions
              </div>
              <div className="space-y-2.5">
                {activePromos.map((p) => {
                  const isCond = p.targetAudience?.toLowerCase().includes('cond');
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="text-sm">🏷</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground">{p.name}</div>
                        {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                      </div>
                      <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        isCond ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
                      }`}>
                        {isCond ? 'Conditional' : p.targetAudience || 'All Night'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* My shift */}
          {myShift && (
            <div className="border-b border-border px-5 py-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                My Shift
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                <span className="text-sm">⏱</span>
                <div>
                  <div className="font-mono text-sm font-medium text-green-800">
                    {fmtTime(myShift.startTime)} – {fmtTime(myShift.endTime)}
                  </div>
                  <div className="text-xs text-green-700 capitalize">{myShift.role.replace(/_/g, ' ')}</div>
                </div>
              </div>
            </div>
          )}

          {/* Team on shift (manager view) */}
          {isManager && teamMembers.length > 0 && (
            <div className="border-b border-border px-5 py-4">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Team on Shift
              </div>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map((s) => {
                  const initials = (s.staffName || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                  return (
                    <div key={s.id} className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-foreground">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary">
                        {initials}
                      </div>
                      {s.staffName?.split(' ')[0] ?? 'Staff'}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface VenueCalendarProps {
  isManager?: boolean;
}

export function VenueCalendar({ isManager = false }: VenueCalendarProps) {
  const profile = useAuthStore((s) => s.profile);
  const todayIso = toISO(new Date());

  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthYear, setMonthYear] = useState(new Date().getFullYear());
  const [monthNum, setMonthNum] = useState(new Date().getMonth() + 1); // 1-indexed
  const [selectedDate, setSelectedDate] = useState(todayIso);

  // ── Compute date range for data fetching ──────────────────────────────────
  const { rangeStart, rangeEnd, weekStart } = useMemo(() => {
    if (viewMode === 'week') {
      const ws = addDays(getMonWeekStart(new Date()), weekOffset * 7);
      return {
        weekStart: ws,
        rangeStart: toISO(ws),
        rangeEnd: toISO(addDays(ws, 6)),
      };
    } else {
      const firstDay = new Date(monthYear, monthNum - 1, 1);
      const lastDay = new Date(monthYear, monthNum, 0);
      return {
        weekStart: firstDay,
        rangeStart: toISO(firstDay),
        rangeEnd: toISO(lastDay),
      };
    }
  }, [viewMode, weekOffset, monthYear, monthNum]);

  // ── Data hooks ────────────────────────────────────────────────────────────
  const { data: allEvents = [] } = useEvents(rangeStart, rangeEnd);
  const shiftsQuery = useShifts(viewMode === 'week' ? weekStart : new Date(monthYear, monthNum - 1, 15));
  const allShifts: Shift[] = shiftsQuery.data ?? [];
  const { promotions = [] } = usePromotions();

  const myShiftsByDate = useMemo(() => {
    const map = new Map<string, Shift>();
    allShifts.filter((s) => s.staffId === profile?.id).forEach((s) => map.set(s.shiftDate, s));
    return map;
  }, [allShifts, profile?.id]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of allEvents) {
      const start = ev.startDate;
      const end = ev.endDate || start;
      // Expand multi-day events
      let cur = start;
      while (cur <= end) {
        if (!map.has(cur)) map.set(cur, []);
        map.get(cur)!.push(ev);
        const d = new Date(cur + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        cur = toISO(d);
      }
    }
    return map;
  }, [allEvents]);

  // ── Navigation ────────────────────────────────────────────────────────────
  function navigate(dir: 1 | -1) {
    if (viewMode === 'week') {
      setWeekOffset((p) => p + dir);
    } else {
      let m = monthNum + dir;
      let y = monthYear;
      if (m > 12) { m = 1; y++; }
      if (m < 1)  { m = 12; y--; }
      setMonthNum(m); setMonthYear(y);
    }
  }

  function goToday() {
    setWeekOffset(0);
    setMonthNum(new Date().getMonth() + 1);
    setMonthYear(new Date().getFullYear());
    setSelectedDate(todayIso);
  }

  const periodLabel = viewMode === 'week'
    ? fmtWeekRange(weekStart)
    : `${MONTHS[monthNum - 1]} ${monthYear}`;

  // ── Side panel data for selected date ─────────────────────────────────────
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const selectedMyShift = myShiftsByDate.get(selectedDate) ?? null;
  const selectedTeamShifts = isManager ? allShifts : [];

  // ── Week grid render ──────────────────────────────────────────────────────
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // ── Month grid render ─────────────────────────────────────────────────────
  const monthCells = useMemo(() => {
    const total = daysInMonth(monthYear, monthNum);
    const startDow = firstDowOfMonth(monthYear, monthNum);
    const prevTotal = daysInMonth(monthYear, monthNum === 1 ? 12 : monthNum - 1);
    const cells: { iso: string; day: number; otherMonth: boolean }[] = [];

    for (let i = startDow - 1; i >= 0; i--) {
      const day = prevTotal - i;
      const y = monthNum === 1 ? monthYear - 1 : monthYear;
      const m = monthNum === 1 ? 12 : monthNum - 1;
      cells.push({ iso: `${y}-${pad2(m)}-${pad2(day)}`, day, otherMonth: true });
    }
    for (let d = 1; d <= total; d++) {
      cells.push({ iso: `${monthYear}-${pad2(monthNum)}-${pad2(d)}`, day: d, otherMonth: false });
    }
    const rem = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= rem; d++) {
      const y = monthNum === 12 ? monthYear + 1 : monthYear;
      const m = monthNum === 12 ? 1 : monthNum + 1;
      cells.push({ iso: `${y}-${pad2(m)}-${pad2(d)}`, day: d, otherMonth: true });
    }
    return cells;
  }, [monthYear, monthNum]);

  return (
    <div className="flex h-full flex-col overflow-hidden -m-4 md:-m-6">

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-5 py-3.5 flex-shrink-0">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[180px] text-sm font-semibold text-foreground">{periodLabel}</span>
          <button
            onClick={() => navigate(1)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary"
          >
            Today
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 ml-2">
          {([
            ['bg-amber-400', 'DJ / Live'],
            ['bg-purple-400', 'Themed'],
            ['bg-blue-400', 'Private'],
            ['bg-red-400', 'Holiday'],
          ] as const).map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-sm ${color}`} />
              {label}
            </div>
          ))}
        </div>

        {/* Week / Month toggle */}
        <div className="ml-auto flex rounded-lg border border-border bg-secondary/60 p-0.5">
          {(['week', 'month'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`rounded-md px-4 py-1 text-xs font-medium capitalize transition-colors ${
                viewMode === m
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main area: grid + side panel ─────────────────────────────── */}
      <div className="flex flex-col md:flex-row min-h-0 flex-1 overflow-hidden">

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">

          {viewMode === 'week' ? (
            /* ── WEEK VIEW ─────────────────────────────────────────── */
            <div className="overflow-x-auto pb-1">
            <div className="grid grid-cols-7 gap-2 min-w-[500px]">
              {weekDays.map((day, i) => {
                const iso = toISO(day);
                const isToday = iso === todayIso;
                const isSel = iso === selectedDate;
                const dayEvs = eventsByDate.get(iso) ?? [];
                const myShift = myShiftsByDate.get(iso) ?? null;

                return (
                  <div
                    key={iso}
                    onClick={() => setSelectedDate(iso)}
                    className={`flex min-h-[180px] cursor-pointer flex-col overflow-hidden rounded-lg border transition-all ${
                      isSel
                        ? 'border-amber-500 border-[1.5px] shadow-md'
                        : isToday
                        ? 'border-amber-400'
                        : 'border-border hover:border-muted-foreground/40'
                    } bg-card`}
                  >
                    {/* Day header */}
                    <div className={`border-b border-border px-2.5 py-2 ${isToday ? 'bg-amber-600' : ''}`}>
                      <div className={`text-[9px] font-semibold uppercase tracking-widest ${isToday ? 'text-amber-100' : 'text-muted-foreground'}`}>
                        {DOW[i]}
                      </div>
                      <div className={`font-mono text-xl font-medium leading-none mt-1 ${isToday ? 'text-white' : 'text-foreground'}`}>
                        {day.getDate()}
                      </div>
                    </div>

                    {/* Events */}
                    <div className="flex flex-1 flex-col gap-1 p-1.5">
                      {dayEvs.map((ev) => {
                        const kind = eventKind(ev);
                        return (
                          <div key={ev.id} className={`rounded px-1.5 py-1 text-[10px] leading-tight ${PILL_CLASSES[kind]}`}>
                            <div className="font-semibold">{KIND_ICON[kind]} {ev.title}</div>
                            {ev.startTime && (
                              <div className="opacity-70 mt-0.5">{fmtTime(ev.startTime)}{ev.endTime ? `–${fmtTime(ev.endTime)}` : ''}</div>
                            )}
                          </div>
                        );
                      })}
                      {myShift && (
                        <div className={`rounded px-1.5 py-1 text-[10px] leading-tight ${PILL_CLASSES.shift}`}>
                          <div className="font-semibold">⏱ My Shift</div>
                          <div className="opacity-70 mt-0.5">{fmtTime(myShift.startTime)}–{fmtTime(myShift.endTime)}</div>
                        </div>
                      )}
                      {dayEvs.length === 0 && !myShift && (
                        <div className="flex flex-1 items-center justify-center text-[10px] italic text-muted-foreground/50">
                          No events
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          ) : (
            /* ── MONTH VIEW ────────────────────────────────────────── */
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {/* Day-of-week header */}
              <div className="grid grid-cols-7 border-b border-border bg-secondary/60">
                {DOW.map((d) => (
                  <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {d}
                  </div>
                ))}
              </div>

              {/* Weeks */}
              {Array.from({ length: monthCells.length / 7 }, (_, row) => (
                <div key={row} className="grid grid-cols-7 border-b border-border last:border-b-0">
                  {monthCells.slice(row * 7, row * 7 + 7).map((cell) => {
                    const isToday = cell.iso === todayIso;
                    const isSel = cell.iso === selectedDate;
                    const dayEvs = eventsByDate.get(cell.iso) ?? [];
                    const myShift = myShiftsByDate.get(cell.iso) ?? null;
                    const allItems = [...dayEvs, ...(myShift ? [{ kind: 'shift', title: 'My Shift', startTime: myShift.startTime }] : [])];

                    return (
                      <div
                        key={cell.iso}
                        onClick={() => setSelectedDate(cell.iso)}
                        className={`min-h-[90px] cursor-pointer border-r border-border p-1.5 last:border-r-0 transition-colors ${
                          cell.otherMonth ? 'bg-secondary/40 opacity-50' :
                          isSel && !isToday ? 'bg-amber-50' :
                          isToday ? 'bg-amber-50/60' : 'hover:bg-secondary/40'
                        }`}
                      >
                        <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-medium ${
                          isToday ? 'bg-amber-600 text-white' : 'text-foreground'
                        }`}>
                          {cell.day}
                        </div>
                        <div className="space-y-0.5">
                          {allItems.slice(0, 2).map((item, idx) => {
                            if ('eventType' in item) {
                              const kind = eventKind(item as CalendarEvent);
                              return (
                                <div key={idx} className={`truncate rounded px-1 py-0.5 text-[9px] font-semibold ${PILL_CLASSES[kind]}`}>
                                  {KIND_ICON[kind]} {item.title}
                                </div>
                              );
                            }
                            return (
                              <div key={idx} className={`truncate rounded px-1 py-0.5 text-[9px] font-semibold ${PILL_CLASSES.shift}`}>
                                ⏱ My Shift
                              </div>
                            );
                          })}
                          {allItems.length > 2 && (
                            <div className="pl-1 text-[9px] text-muted-foreground">+{allItems.length - 2} more</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Side panel ─────────────────────────────────────────────── */}
        <div className="w-full md:w-72 md:flex-shrink-0 border-t md:border-t-0 md:border-l border-border bg-card overflow-hidden">
          <SidePanel
            dateStr={selectedDate}
            events={selectedEvents}
            myShift={selectedMyShift}
            teamShifts={selectedTeamShifts}
            promos={promotions}
            isManager={isManager}
          />
        </div>
      </div>
    </div>
  );
}

export default VenueCalendar;
