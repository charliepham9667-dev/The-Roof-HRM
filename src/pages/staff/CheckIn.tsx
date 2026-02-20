import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useShifts } from '../../hooks/useShifts';
import { useClockIn, useClockOut, useMyAttendanceHistory } from '../../hooks/useClockRecords';

// ─── helpers ─────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0'); }

function fmtHHMM(d: Date) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

function fmtHHMMSS(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}

function fmtBreakMs(ms: number) {
  if (ms <= 0) return '00:00';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60), rem = m % 60;
  return h ? `${h}h ${pad2(rem)}m` : `${m}m`;
}

function fmtMinutes(mins: number) {
  if (mins <= 0) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${pad2(m)}m` : `${h}h`;
}

function fmtNetHours(ms: number) {
  const h = ms / 3600000;
  return h.toFixed(2) + 'h';
}

function fmtShortTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return fmtHHMM(d);
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatWeekday(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── main component ───────────────────────────────────────────────────────────

export function CheckIn() {
  const profile = useAuthStore((s) => s.profile);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const { data: shifts } = useShifts(now);
  const todayShift = shifts?.find((s) => s.staffId === profile?.id && s.shiftDate === todayStr);

  const clockInMut = useClockIn();
  const clockOutMut = useClockOut();
  const clkPending = clockInMut.isPending || clockOutMut.isPending;

  // ── live check-in state ──────────────────────────────────────────────────
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [onBreak, setOnBreak] = useState(false);
  const [breakStart, setBreakStart] = useState<Date | null>(null);
  const [totalBreakMs, setTotalBreakMs] = useState(0);
  const [shiftDone, setShiftDone] = useState(false);
  const [checkOutTime, setCheckOutTime] = useState<Date | null>(null);

  // live tickers
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    if (!checkedIn || shiftDone) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [checkedIn, shiftDone]);

  const elapsedMs = checkedIn && checkInTime ? nowMs - checkInTime.getTime() : 0;
  const currentBreakMs = onBreak && breakStart ? nowMs - breakStart.getTime() : 0;
  const totalBreakMsLive = totalBreakMs + currentBreakMs;
  const netMs = Math.max(0, elapsedMs - totalBreakMsLive);
  const isOvertime = netMs > 8 * 3600000;

  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  async function handleCheckIn() {
    try {
      await clockInMut.mutateAsync({});
      setCheckedIn(true);
      setCheckInTime(new Date());
      setTotalBreakMs(0);
      setOnBreak(false);
      setShiftDone(false);
    } catch (e: any) {
      showToast(e.message || 'Failed to clock in');
    }
  }

  function handleToggleBreak() {
    if (!onBreak) {
      setBreakStart(new Date());
      setOnBreak(true);
    } else {
      const dur = breakStart ? Date.now() - breakStart.getTime() : 0;
      setTotalBreakMs((p) => p + dur);
      setBreakStart(null);
      setOnBreak(false);
    }
  }

  async function handleCheckOut() {
    try {
      await clockOutMut.mutateAsync({});
      const outTime = new Date();
      if (onBreak && breakStart) {
        setTotalBreakMs((p) => p + (outTime.getTime() - breakStart.getTime()));
        setOnBreak(false);
        setBreakStart(null);
      }
      setCheckedIn(false);
      setShiftDone(true);
      setCheckOutTime(outTime);
      setShowCheckoutConfirm(false);
    } catch (e: any) {
      showToast(e.message || 'Failed to clock out');
      setShowCheckoutConfirm(false);
    }
  }

  // ── attendance history ───────────────────────────────────────────────────
  // Show 3 months back max; use month navigation
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month
  const targetDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthOffset);
    return d;
  }, [monthOffset]);
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth(); // 0-indexed
  const monthLabel = `${MONTH_NAMES[targetMonth]} ${targetYear}`;

  const { data: history = [], isLoading: histLoading } = useMyAttendanceHistory(90 + monthOffset * 30);

  const filteredHistory = useMemo(() => {
    return history.filter((r) => {
      const d = new Date(r.date + 'T12:00:00');
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });
  }, [history, targetYear, targetMonth]);

  const [logFilter, setLogFilter] = useState<'all' | 'overtime' | 'break'>('all');
  const displayRows = useMemo(() => {
    if (logFilter === 'overtime') return filteredHistory.filter((r) => r.overtimeMinutes > 0);
    if (logFilter === 'break') return filteredHistory.filter((r) => r.breakMinutes > 0);
    return filteredHistory;
  }, [filteredHistory, logFilter]);

  // Monthly summary stats
  const monthlySummary = useMemo(() => {
    const completed = filteredHistory.filter((r) => r.clockOut !== null);
    const totalMins = completed.reduce((s, r) => s + r.totalMinutes, 0);
    const breakMins = completed.reduce((s, r) => s + r.breakMinutes, 0);
    const otMins = completed.reduce((s, r) => s + r.overtimeMinutes, 0);
    return { shifts: completed.length, totalMins, breakMins, otMins };
  }, [filteredHistory]);

  const shiftTimeLabel = todayShift
    ? `${todayShift.startTime.slice(0, 5)} – ${todayShift.endTime.slice(0, 5)}`
    : null;

  const statusLabel = !checkedIn && !shiftDone ? 'Not Checked In'
    : onBreak ? 'On Break'
    : shiftDone ? 'Shift Complete'
    : 'On Shift';

  const statusClass = onBreak
    ? 'bg-amber-50 border-amber-200 text-amber-700'
    : checkedIn
    ? 'bg-green-50 border-green-200 text-green-700'
    : shiftDone
    ? 'bg-blue-50 border-blue-200 text-blue-700'
    : 'bg-secondary border-border text-muted-foreground';

  const dotClass = onBreak ? 'bg-amber-500'
    : checkedIn ? 'bg-green-600'
    : 'bg-muted-foreground';

  return (
    <div className="flex flex-col gap-5">

      {/* ── ACTIVE SHIFT PANEL ─────────────────────────────────────────── */}
      <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">

        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <span className="text-sm font-semibold text-foreground">Today's Shift</span>
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${statusClass}`}>
            <span className={`h-[7px] w-[7px] rounded-full ${dotClass} ${checkedIn && !onBreak ? 'animate-pulse' : ''}`} />
            {statusLabel}
          </div>
        </div>

        {/* 4-stat row */}
        <div className="grid grid-cols-4 divide-x divide-border px-6 py-5">
          {/* Check In */}
          <div className="pr-6">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Check In</div>
            <div className="font-mono text-[22px] font-medium leading-none text-foreground">
              {checkInTime ? fmtHHMM(checkInTime) : '—'}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {shiftDone && checkOutTime
                ? `→ Out: ${fmtHHMM(checkOutTime)}`
                : checkInTime ? 'Checked in' : 'Not started'}
            </div>
          </div>

          {/* Time on Shift */}
          <div className="px-6">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Time on Shift</div>
            <div className={`font-mono text-[28px] font-medium leading-none ${checkedIn ? 'text-green-600' : 'text-foreground'}`}>
              {fmtHHMMSS(shiftDone ? elapsedMs : elapsedMs)}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {checkedIn ? 'Time running' : shiftDone ? 'Final time' : 'Waiting to start'}
            </div>
          </div>

          {/* Break Time */}
          <div className="px-6">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Break Time</div>
            <div className={`font-mono text-[28px] font-medium leading-none ${totalBreakMsLive > 0 ? 'text-amber-600' : 'text-foreground'}`}>
              {fmtBreakMs(totalBreakMsLive)}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {onBreak ? 'Break in progress' : totalBreakMsLive > 0 ? 'Total this shift' : 'No breaks yet'}
            </div>
          </div>

          {/* Net Hours */}
          <div className="pl-6">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Net Hours</div>
            <div className={`font-mono text-[28px] font-medium leading-none ${isOvertime ? 'text-red-600' : 'text-foreground'}`}>
              {fmtNetHours(netMs)}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {isOvertime ? '⚠ Overtime' : '8h threshold'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-6 pb-5">

          {/* Toast */}
          {toast && (
            <span className="text-xs text-destructive">{toast}</span>
          )}

          {/* Pre check-in */}
          {!checkedIn && !shiftDone && !showCheckoutConfirm && (
            <button
              onClick={handleCheckIn}
              disabled={clkPending}
              className="flex items-center gap-2 rounded-lg bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-60"
            >
              {clkPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '→'}
              Check In
            </button>
          )}

          {/* Shift done */}
          {shiftDone && (
            <button
              disabled
              className="flex items-center gap-2 rounded-lg bg-foreground/40 px-6 py-3 text-sm font-semibold text-background cursor-default opacity-60"
            >
              ✓ Shift Ended
            </button>
          )}

          {/* Post check-in buttons */}
          {checkedIn && !showCheckoutConfirm && (
            <>
              <button
                onClick={() => setShowCheckoutConfirm(true)}
                disabled={clkPending}
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
              >
                ✕ Check Out
              </button>
              <button
                onClick={handleToggleBreak}
                className={`rounded-lg border px-5 py-3 text-sm font-medium transition-colors ${
                  onBreak
                    ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'border-border bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                {onBreak ? '▶ End Break' : '☕ Take Break'}
              </button>
              {shiftTimeLabel && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Scheduled: <strong className="text-foreground">{shiftTimeLabel}</strong>
                </span>
              )}
            </>
          )}

          {/* Checkout confirm strip */}
          {showCheckoutConfirm && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <span className="flex-1 text-sm text-red-700">End your shift? This will record your clock-out time.</span>
              <button
                onClick={handleCheckOut}
                disabled={clkPending}
                className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {clkPending ? <Loader2 className="h-3 w-3 animate-spin inline" /> : 'Yes, Clock Out'}
              </button>
              <button
                onClick={() => setShowCheckoutConfirm(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MONTHLY SUMMARY ─────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            This Month — {monthLabel}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-4 gap-3.5">
          {[
            { label: 'Shifts Worked', value: String(monthlySummary.shifts), sub: 'This month', color: 'text-green-600' },
            { label: 'Total Hours', value: fmtMinutes(monthlySummary.totalMins), sub: 'Excl. break time', color: 'text-foreground' },
            { label: 'Total Break Time', value: fmtMinutes(monthlySummary.breakMins), sub: 'Across all shifts', color: 'text-amber-600' },
            { label: 'Overtime', value: fmtMinutes(monthlySummary.otMins), sub: 'Over 8h threshold', color: monthlySummary.otMins > 0 ? 'text-red-600' : 'text-foreground' },
          ].map((s) => (
            <div key={s.label} className="rounded-card border border-border bg-card px-5 py-4 shadow-card">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</div>
              <div className={`font-mono text-[26px] font-medium leading-none ${s.color}`}>{s.value}</div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SHIFT HISTORY LOG ───────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Shift History</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Filter bar */}
        <div className="mb-3 flex items-center gap-2">
          {(['all', 'overtime', 'break'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setLogFilter(f)}
              className={`rounded-full border px-3.5 py-1 text-xs font-medium transition-colors ${
                logFilter === f
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'All Shifts' : f === 'overtime' ? 'Overtime' : 'With Breaks'}
            </button>
          ))}
          <div className="flex-1" />
          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonthOffset((p) => p + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm text-muted-foreground transition-colors hover:bg-secondary"
            >
              ‹
            </button>
            <span className="min-w-[110px] text-center text-sm font-medium text-foreground">{monthLabel}</span>
            <button
              onClick={() => setMonthOffset((p) => Math.max(0, p - 1))}
              disabled={monthOffset === 0}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-sm text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30"
            >
              ›
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
          {histLoading ? (
            <div className="space-y-3 px-6 py-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : displayRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {filteredHistory.length === 0
                ? `No shifts recorded for ${monthLabel}.`
                : 'No shifts match this filter.'}
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/60">
                  {['Date', 'Clock In', 'Clock Out', 'Break', 'Net Hours', 'Status'].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${i === 5 ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayRows.map((row) => {
                  const isToday = row.date === todayStr;
                  const isOT = row.overtimeMinutes > 0;
                  const isInProgress = row.clockIn && !row.clockOut;

                  return (
                    <tr
                      key={row.date}
                      className={`transition-colors ${isToday ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-secondary/50'}`}
                    >
                      {/* Date */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{formatDateLabel(row.date)}</span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{formatWeekday(row.date)}</span>
                      </td>

                      {/* Clock In */}
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {fmtShortTime(row.clockIn)}
                      </td>

                      {/* Clock Out */}
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {fmtShortTime(row.clockOut)}
                      </td>

                      {/* Break */}
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {row.breakMinutes > 0 ? fmtMinutes(row.breakMinutes) : '—'}
                      </td>

                      {/* Net Hours */}
                      <td className="px-4 py-3">
                        {isInProgress ? (
                          <span className="text-xs text-muted-foreground">Live</span>
                        ) : row.totalMinutes > 0 ? (
                          <span className={`font-mono text-sm font-semibold ${isOT ? 'text-red-600' : 'text-foreground'}`}>
                            {fmtMinutes(row.totalMinutes)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3 text-right">
                        {isInProgress ? (
                          <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                            In Progress
                          </span>
                        ) : isOT ? (
                          <span className="inline-flex items-center rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                            +{fmtMinutes(row.overtimeMinutes)} OT
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                            Regular
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}

export default CheckIn;
