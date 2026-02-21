import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart2, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Megaphone, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useShifts, useTodayShifts } from '@/hooks/useShifts';
import { useRoofCalendarWeekData } from '@/hooks/useWeekAtGlanceCsv';

// ─── Helpers (ICT-safe, matches owner dashboard exactly) ──────────────────────

const ICT_TZ = 'Asia/Ho_Chi_Minh';

function getTodayIso() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ICT_TZ }).formatToParts(new Date());
  const map = new Map(parts.map((p) => [p.type, p.value]));
  return `${map.get('year')}-${map.get('month')}-${map.get('day')}`;
}

function buildWeekDates(anchorIso: string) {
  const [y, m, d] = anchorIso.split('-').map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d));
  const dowMon0 = (anchor.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(y, m - 1, d - dowMon0));
  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(start);
    dt.setUTCDate(start.getUTCDate() + i);
    return { day: dayNames[i], dateNum: dt.getUTCDate(), iso: dt.toISOString().slice(0, 10) };
  });
}

function fmtTime(t: string | null | undefined) {
  return t ? t.slice(0, 5) : '';
}

function fmtWeekRange(weekDates: { iso: string; dateNum: number }[]) {
  const [, fm, fd] = weekDates[0].iso.split('-').map(Number);
  const [, lm, ld] = weekDates[6].iso.split('-').map(Number);
  const mo = (n: number) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][n-1];
  return `${mo(fm)} ${fd} – ${mo(lm)} ${ld}`;
}

function formatPipelineWhen(dateIso: string, startTime: string | null, endTime: string | null) {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: ICT_TZ, weekday: 'short' }).format(dt);
  const month = new Intl.DateTimeFormat('en-US', { timeZone: ICT_TZ, month: 'short' }).format(dt);
  const datePart = `${weekday} ${dt.getUTCDate()} ${month}`;
  if (startTime && endTime) return `${datePart}, ${startTime} – ${endTime}`;
  return datePart;
}

function getInitials(name: string) {
  return (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Fixed promotions data (identical to owner dashboard) ─────────────────────

const FIXED_PROMOS = [
  { dayKey: 'MON', name: 'Up in Smoke Mondays',       hours: '18:00 – 20:00', deal: 'Free signature cocktail with any premium / special shisha purchase' },
  { dayKey: 'TUE', name: 'Date Night Tuesdays',        hours: '18:00 – 20:00', deal: 'Free fruit platter (250K) with date night combo — 1 Pizza & 2 cocktails for 675K' },
  { dayKey: 'WED', name: 'Chill & Flow Wednesdays',    hours: '18:00 – 20:00', deal: 'Free premium tea with any special shisha + 30% off your second shisha' },
  { dayKey: 'THU', name: 'Lovers & Friends Thursdays', hours: '18:00 – 20:00', deal: 'Free premium shisha with a spend over 2,000,000 VND' },
  { dayKey: 'FRI', name: 'We Outside Fridays',         hours: '18:00 – 20:00', deal: 'Free cocktail jug with a spend over 1,500,000 VND' },
  { dayKey: 'SAT', name: 'Good Vibes Only Saturdays',  hours: '18:00 – 20:00', deal: 'Free special shisha with a spend over 3,000,000 VND' },
  { dayKey: 'SUN', name: 'Sunset & Slow Down Sundays', hours: '18:00 – 20:00', deal: '20% off all signature cocktails' },
];

const HAPPY_HOUR_ITEMS = [
  { icon: '🍹', label: 'Buy 1 Get 1',    sub: 'Happy hour menu' },
  { icon: '🍵', label: 'Free Tea',        sub: 'With any special shisha' },
  { icon: '🍸', label: 'Cocktail Set',    sub: '6 best-sellers — 399K' },
  { icon: '🌧',  label: '20% Off Shisha', sub: 'Rainy day special' },
];

const DAY_FULL: Record<string, string> = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday',
  FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};

// ─── Main component ───────────────────────────────────────────────────────────

interface VenueBriefingProps {
  isManager?: boolean;
}

export function VenueBriefing({ isManager: _isManager = false }: VenueBriefingProps) {
  const profile = useAuthStore((s) => s.profile);
  const todayIso = useMemo(() => getTodayIso(), []);
  const nowHour = new Date().getHours();
  const isEvening = nowHour >= 17;

  const [weekOffset, setWeekOffset] = useState(0);

  // Week dates — offset from current week
  const weekDates = useMemo(() => {
    const base = buildWeekDates(todayIso);
    if (weekOffset === 0) return base;
    const [y, m, d] = base[0].iso.split('-').map(Number);
    const shifted = new Date(Date.UTC(y, m - 1, d + weekOffset * 7));
    return buildWeekDates(shifted.toISOString().slice(0, 10));
  }, [todayIso, weekOffset]);

  const isCurrentWeek = weekOffset === 0;

  // ── CSV Data (same hook as owner dashboard) ───────────────────────────────
  const { data: roofCalendar, isLoading: weekCsvLoading, error: weekCsvError } = useRoofCalendarWeekData();
  const weekCsv = roofCalendar?.byDate ?? [];
  const roofEvents = roofCalendar?.events ?? [];

  const weekByDate = useMemo(() => {
    const map = new Map<string, (typeof weekCsv)[number]>();
    for (const x of weekCsv) map.set(x.dateIso, x);
    return map;
  }, [weekCsv]);

  // ── Shifts ────────────────────────────────────────────────────────────────
  const { data: todayShifts = [] } = useTodayShifts(todayIso);
  const shiftsQuery = useShifts(new Date(weekDates[0].iso + 'T12:00:00'));
  const allShifts = shiftsQuery.data ?? [];

  const myTodayShift = todayShifts.find((s) => s.staffId === profile?.id) ?? null;

  const myShiftsByDate = useMemo(() => {
    const map = new Map<string, (typeof allShifts)[0]>();
    allShifts.filter((s) => s.staffId === profile?.id).forEach((s) => map.set(s.shiftDate, s));
    return map;
  }, [allShifts, profile?.id]);

  // ── Tonight from CSV ──────────────────────────────────────────────────────
  const tonightEvents = useMemo(
    () => roofEvents.filter((e) => e.dateIso === todayIso && e.eventName).sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0)),
    [roofEvents, todayIso]
  );
  const tonightFirst = tonightEvents[0] ?? null;

  const tonightDJs = useMemo(() => {
    const djs: { name: string; start: string | null; end: string | null; role: string }[] = [];
    for (const e of tonightEvents) {
      if (e.dj1) {
        const m = e.dj1.match(/^(.+?)\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})$/);
        djs.push(m ? { name: m[1], start: m[2], end: m[3], role: 'Opening' } : { name: e.dj1, start: e.startTime, end: null, role: 'Opening' });
      }
      if (e.dj2) {
        const m = e.dj2.match(/^(.+?)\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})$/);
        djs.push(m ? { name: m[1], start: m[2], end: m[3], role: 'Closing' } : { name: e.dj2, start: null, end: e.endTime, role: 'Closing' });
      }
    }
    return djs;
  }, [tonightEvents]);

  const tonightGenres = useMemo(() => {
    const genres = new Set<string>();
    for (const e of tonightEvents) {
      if (e.genre) e.genre.split(/[,;/&]+/).map((g) => g.trim()).filter(Boolean).forEach((g) => genres.add(g));
    }
    return Array.from(genres);
  }, [tonightEvents]);

  const tonightPromo = tonightFirst?.promotion ?? null;

  // ── Pipeline rows — one row per event so all events are visible ──────────
  const pipelineRows = useMemo(() => {
    const byDate = new Map<string, typeof roofEvents>();
    for (const e of roofEvents) {
      if (!e.dateIso) continue;
      const list = byDate.get(e.dateIso) || [];
      list.push(e);
      byDate.set(e.dateIso, list);
    }
    const rows: Array<{
      iso: string; day: string; dateNum: number; isToday: boolean; isFirstForDay: boolean;
      event: string; when: string; dj1: string; dj2: string; genre: string; promo: string;
    }> = [];
    for (const d of weekDates) {
      const dayEvents = (byDate.get(d.iso) || []).filter((e) => e.eventName).sort((a, b) => (a.startMinutes ?? 999999) - (b.startMinutes ?? 999999));
      const isToday = d.iso === todayIso && isCurrentWeek;
      if (dayEvents.length === 0) {
        rows.push({ iso: d.iso, day: d.day, dateNum: d.dateNum, isToday, isFirstForDay: true, event: 'TBD', when: formatPipelineWhen(d.iso, null, null), dj1: '—', dj2: '—', genre: '—', promo: '—' });
      } else {
        dayEvents.forEach((ev, i) => {
          rows.push({
            iso: d.iso, day: d.day, dateNum: d.dateNum, isToday, isFirstForDay: i === 0,
            event: ev.eventName ?? '—',
            when: formatPipelineWhen(d.iso, ev.startTime, ev.endTime),
            dj1: ev.dj1 || '—', dj2: ev.dj2 || '—',
            genre: ev.genre || '—', promo: ev.promotion || '—',
          });
        });
      }
    }
    return rows;
  }, [roofEvents, weekDates, todayIso, isCurrentWeek]);

  // ── Weekly analysis (exact owner dashboard logic) ─────────────────────────
  const weekIsos = useMemo(() => new Set(weekDates.map((d) => d.iso)), [weekDates]);

  const eventCount = useMemo(() => weekDates.filter((d) => roofEvents.some((e) => e.dateIso === d.iso && e.eventName)).length, [weekDates, roofEvents]);

  const djBookedCount = useMemo(() => {
    const djSet = new Set<string>();
    for (const e of roofEvents) {
      if (!weekIsos.has(e.dateIso)) continue;
      if (e.dj1) djSet.add(e.dj1.replace(/\s+\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}$/, '').trim());
      if (e.dj2) djSet.add(e.dj2.replace(/\s+\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}$/, '').trim());
    }
    return djSet.size;
  }, [roofEvents, weekIsos]);

  const clubNightCount = useMemo(() =>
    weekDates.filter((d) => (weekByDate.get(d.iso)?.mode || '').toLowerCase().includes('club') || d.day === 'THU' || d.day === 'FRI' || d.day === 'SAT').length,
    [weekDates, weekByDate]
  );

  const unplannedDays = useMemo(() =>
    weekDates.filter((d) => !roofEvents.some((e) => e.dateIso === d.iso && e.eventName)),
    [weekDates, roofEvents]
  );
  const unplannedCount = unplannedDays.length;

  const rating = eventCount >= 6 ? 'Strong Week' : eventCount >= 4 ? 'Solid Week' : eventCount >= 2 ? 'Light Week' : 'Slow Week';
  const ratingColor = eventCount >= 6 ? '#22c55e' : eventCount >= 4 ? '#84cc16' : eventCount >= 2 ? '#f59e0b' : '#ef4444';

  const insights = useMemo(() => {
    const list: { emoji: string; title: string; body: string }[] = [];

    const djNightCount = new Map<string, number>();
    for (const d of weekDates) {
      const dayDJs = new Set<string>();
      for (const e of roofEvents.filter((e) => e.dateIso === d.iso && e.eventName)) {
        if (e.dj1) dayDJs.add(e.dj1.replace(/\s+\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}$/, '').trim());
        if (e.dj2) dayDJs.add(e.dj2.replace(/\s+\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}$/, '').trim());
      }
      for (const dj of dayDJs) djNightCount.set(dj, (djNightCount.get(dj) ?? 0) + 1);
    }
    const heavyDJs = Array.from(djNightCount.entries()).filter(([, n]) => n >= 3).map(([name]) => name);
    if (heavyDJs.length > 0) {
      list.push({ icon: AlertTriangle, title: 'High DJ Reliance', body: `${heavyDJs.join(', ')} ${heavyDJs.length === 1 ? 'is' : 'are'} booked ${heavyDJs.length === 1 ? djNightCount.get(heavyDJs[0]) : '3+'}+ nights — consider diversifying the lineup.` });
    }

    const clubNoPromo = weekDates.filter((d) => {
      const isClub = (weekByDate.get(d.iso)?.mode || '').toLowerCase().includes('club') || d.day === 'THU' || d.day === 'FRI' || d.day === 'SAT';
      return isClub && !roofEvents.some((e) => e.dateIso === d.iso && e.promotion);
    });
    if (clubNoPromo.length > 0) {
      list.push({ icon: Megaphone, title: 'Club Nights Without Promotion', body: `${clubNoPromo.map((d) => d.day).join(', ')} ${clubNoPromo.length === 1 ? 'has' : 'have'} no promotion attached — add an offer to drive footfall.` });
    }

    if (unplannedCount > 0) {
      list.push({ icon: CalendarDays, title: `${unplannedCount} Unplanned ${unplannedCount === 1 ? 'Night' : 'Nights'}`, body: `${unplannedDays.map((d) => d.day).join(', ')} ${unplannedCount === 1 ? 'has' : 'have'} no event scheduled — opportunity to fill the calendar.` });
    }
    if (unplannedCount === 0 && eventCount === 7) {
      list.push({ icon: CheckCircle2, title: 'Full Week Planned', body: 'Every night this week has an event — great execution on calendar coverage.' });
    }
    if (list.length === 0) {
      list.push({ icon: BarChart2, title: 'Week on Track', body: `${eventCount} events scheduled with ${djBookedCount} DJs across ${clubNightCount} club nights.` });
    }
    return list;
  }, [weekDates, roofEvents, weekByDate, unplannedCount, unplannedDays, eventCount, djBookedCount, clubNightCount]);

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── PAGE HEADER ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Venue Briefing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tonight's event details, pipeline, and team on shift
        </p>
      </div>

      {/* ══ SECTION 1 — TONIGHT'S BRIEFING ══════════════════════════════════ */}
      <div className="space-y-3">
        {/* Section header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <div className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Tonight's Briefing
            </div>
            {isEvening && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
              </span>
            )}
          </div>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Dark banner — exact same style as the HTML mockup */}
        <div style={{ background: '#faf8f5', borderRadius: 10, overflow: 'hidden', position: 'relative', color: '#1a1714', border: '1px solid #e2ddd7' }}>
          {/* Amber gradient line */}
          <div style={{ height: 2, background: 'linear-gradient(90deg, #b5620a 0%, #c9a84c 55%, transparent 100%)' }} />

          {/* Scroll wrapper — horizontal on tablet, vertical stack on phone */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))' }}>

            {/* Col 1: Tonight's Event */}
            <div style={{ padding: '16px 20px', borderRight: '1px solid #e2ddd7' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#9c9590', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                {isEvening && (
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', display: 'inline-block', flexShrink: 0 }} />
                )}
                Tonight's Event
              </div>
              {tonightFirst ? (
                <>
                  <div style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif", fontSize: 17, fontWeight: 600, color: '#1a1714', lineHeight: 1.2 }}>
                    {tonightFirst.eventName}
                  </div>
                  {(tonightFirst.startTime || tonightFirst.endTime) && (
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#9c9590', marginTop: 4 }}>
                      {tonightFirst.startTime}{tonightFirst.startTime && tonightFirst.endTime ? ' – ' : ''}{tonightFirst.endTime} · Club Night
                    </div>
                  )}
                  {tonightPromo && (
                    <div style={{ display: 'inline-flex', marginTop: 7, padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, background: 'rgba(181,98,10,0.12)', color: '#b5620a', border: '1px solid rgba(181,98,10,0.25)' }}>
                      🧧 {tonightPromo}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#9c9590', fontStyle: 'italic' }}>No event tonight</div>
              )}
            </div>

            {/* Col 2: DJs Tonight */}
            <div style={{ padding: '16px 20px', borderRight: '1px solid #e2ddd7' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#9c9590', marginBottom: 10 }}>
                DJs Tonight
              </div>
              {tonightDJs.length > 0 ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                    {tonightDJs.map((dj, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#e2ddd7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#6b6560', flexShrink: 0 }}>
                          {getInitials(dj.name)}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1714' }}>{dj.name}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#9c9590' }}>
                            {dj.start && dj.end ? `${dj.start} – ${dj.end} · ${dj.role}` : dj.role}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {tonightGenres.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, marginTop: 10 }}>
                      {tonightGenres.map((g) => (
                        <span key={g} style={{ padding: '2px 8px', borderRadius: 3, fontSize: 10, background: '#f0ece6', color: '#6b6560', border: '1px solid #e2ddd7' }}>{g}</span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#9c9590', fontStyle: 'italic' }}>No DJs scheduled</div>
              )}
            </div>

            {/* Col 3: Active Promos */}
            <div style={{ padding: '16px 20px', borderRight: '1px solid #e2ddd7' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#9c9590', marginBottom: 10 }}>
                Active Promos
              </div>
              {tonightPromo ? (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                  {tonightPromo.split(/[,;]+/).map((p) => p.trim()).filter(Boolean).map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>🧧</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1714' }}>{p}</div>
                        <div style={{ fontSize: 10, color: '#9c9590', marginTop: 1 }}>All night</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#9c9590', fontStyle: 'italic' }}>No active promos</div>
              )}
            </div>

            {/* Col 4: Team on Shift */}
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#9c9590', marginBottom: 10 }}>
                Team on Shift
              </div>
              {todayShifts.length > 0 ? (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                    {todayShifts.map((s) => {
                      const isMe = s.staffId === profile?.id;
                      const initials = getInitials(s.staffName || '?');
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 20, background: isMe ? 'rgba(181,98,10,0.1)' : '#f0ece6', border: isMe ? '1px solid rgba(181,98,10,0.3)' : '1px solid #e2ddd7' }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: isMe ? 'rgba(181,98,10,0.2)' : '#e2ddd7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: isMe ? '#b5620a' : '#6b6560', flexShrink: 0 }}>
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: isMe ? '#b5620a' : '#1a1714', lineHeight: 1 }}>{(s.staffName || 'Staff').split(' ')[0]}</div>
                            <div style={{ fontSize: 9, color: '#9c9590', lineHeight: 1, marginTop: 1, textTransform: 'capitalize' as const }}>{(s.role || '').replace(/_/g, ' ')}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {myTodayShift && (
                    <div style={{ marginTop: 10, padding: '6px 10px', borderRadius: 5, background: 'rgba(181,98,10,0.08)', border: '1px solid rgba(181,98,10,0.2)', fontSize: 11, color: '#b5620a', fontFamily: "'DM Mono', monospace" }}>
                      Your shift: {fmtTime(myTodayShift.startTime)} – {fmtTime(myTodayShift.endTime)}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#9c9590', fontStyle: 'italic' }}>No shifts scheduled</div>
              )}
            </div>

          </div>
          </div>{/* end scroll wrapper */}
        </div>
      </div>

      {/* ══ SECTION 2 — THIS WEEK'S PIPELINE ════════════════════════════════ */}
      <div className="space-y-3">
        {/* Section header with week nav */}
        <div className="flex items-center gap-3">
          <div className="text-xs font-medium tracking-widest text-muted-foreground uppercase whitespace-nowrap">
            This Week's Pipeline
          </div>
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

        {/* Two-column: vertical glance left, pipeline table right — EXACT owner dashboard */}
        <div className="grid gap-3 lg:grid-cols-[220px_1fr]" style={{ alignItems: 'stretch' }}>

          {/* LEFT — vertical day cards (pixel-perfect copy of owner dashboard) */}
          <div className="flex flex-col gap-1.5" style={{ height: '100%' }}>
            {weekDates.map((d, dIdx) => {
              const row = weekByDate.get(d.iso);
              const isToday = d.iso === todayIso && isCurrentWeek;
              const isPast = d.iso < todayIso && isCurrentWeek;
              const isClub = (row?.mode || '').toLowerCase().includes('club') || d.day === 'THU' || d.day === 'FRI' || d.day === 'SAT';
              const dayEvents = roofEvents.filter((e) => e.dateIso === d.iso && e.eventName).sort((a, b) => (a.startMinutes ?? 999999) - (b.startMinutes ?? 999999));
              const djLines = row?.djLines || [];
              const firstEvent = dayEvents[0];
              const myShift = myShiftsByDate.get(d.iso);
              const isLast = dIdx === weekDates.length - 1;

              return (
                <div key={d.iso} style={{ ...(isLast ? { flex: 1 } : {}), opacity: isPast ? 0.55 : 1, border: isToday ? '1.5px solid #b5620a' : '1px solid #e2ddd7', borderRadius: 8, overflow: 'hidden', background: '#faf8f5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderBottom: '1px solid #e2ddd7', background: isToday ? '#b5620a' : '#f0ece6' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: isToday ? 'rgba(255,255,255,0.75)' : '#9c9590', minWidth: 26 }}>{d.day}</span>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 500, color: isToday ? '#fff' : '#1a1714', marginRight: 'auto', lineHeight: 1 }}>{d.dateNum}</span>
                    {myShift && (
                      <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: isToday ? 'rgba(255,255,255,0.2)' : 'rgba(16,185,129,0.15)', color: isToday ? '#fff' : '#059669', border: isToday ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(16,185,129,0.2)' }}>My Shift</span>
                    )}
                    {isClub ? (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase' as const, letterSpacing: '0.04em', background: isToday ? 'rgba(255,255,255,0.2)' : 'rgba(107,63,160,0.15)', color: isToday ? '#fff' : '#7a4abf', border: isToday ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(107,63,160,0.2)' }}>Club</span>
                    ) : (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase' as const, letterSpacing: '0.04em', background: '#f5edd8', color: '#7a5a10', border: '1px solid #e8d9b0' }}>Lounge</span>
                    )}
                  </div>
                  <div style={{ padding: '8px 10px', backgroundColor: 'rgba(255,255,255,1)', overflowY: 'auto', maxHeight: 90 }}>
                    {weekCsvLoading ? (
                      <div style={{ fontSize: 10, color: '#9c9590' }}>Loading…</div>
                    ) : weekCsvError ? (
                      <div style={{ fontSize: 10, color: '#b5620a' }}>Unable to load.</div>
                    ) : (
                      <>
                        {dayEvents.length > 0 ? dayEvents.map((ev, evIdx) => (
                          <div key={evIdx} style={{ marginTop: evIdx > 0 ? 6 : 0, borderTop: evIdx > 0 ? '1px solid #e2ddd7' : 'none', paddingTop: evIdx > 0 ? 5 : 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? '#b5620a' : '#1a1714', lineHeight: 1.3 }}>{ev.eventName}</div>
                            {(ev.startTime || ev.endTime) && (
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#9c9590', marginTop: 1 }}>
                                {ev.startTime}{ev.startTime && ev.endTime ? ' – ' : ''}{ev.endTime}
                              </div>
                            )}
                          </div>
                        )) : (
                          <div style={{ fontSize: 10, color: '#9c9590', fontStyle: 'italic' }}>TBD</div>
                        )}
                        {djLines.length > 0 && (
                          <div style={{ fontSize: 10, color: '#6b6560', marginTop: 3, display: 'flex', flexDirection: 'column' as const, gap: 1 }}>
                            {djLines.map((line, i) => <div key={i}>{line}</div>)}
                          </div>
                        )}
                        {isToday && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#b5620a', display: 'inline-block' }} />
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#b5620a', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>Tonight</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT — Pipeline card: stretches to match left sidebar height */}
          <div style={{ border: '1px solid #e2ddd7', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, height: '100%' }}>

            {/* Card header */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2ddd7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1714' }}>This Week's Pipeline</div>
              <div style={{ fontSize: 11, color: '#9c9590' }}>{fmtWeekRange(weekDates)} · {eventCount} events</div>
            </div>

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1.2fr 1.6fr', gap: 16, padding: '7px 18px', borderBottom: '1px solid #e2ddd7', background: '#f0ece6' }}>
              {['Event', 'DJ 1', 'DJ 2', 'Genre', 'Promotion'].map((h) => (
                <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#9c9590' }}>{h}</div>
              ))}
            </div>

            {/* Rows — flex:1 fills remaining space; overflow scrolls if many events */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {pipelineRows.map((row, idx) => {
                const isPipelinePast = row.iso < todayIso && isCurrentWeek;
                const genres = row.genre !== '—' ? row.genre.split(/[,;]+/).map((g) => g.trim()).filter(Boolean) : [];
                const promos = row.promo !== '—' ? row.promo.split(/[,;]+/).map((p) => p.trim()).filter(Boolean) : [];
                const topBorder = row.isFirstForDay && idx > 0 ? '2px solid #d4cfc9' : '1px solid #e2ddd7';
                return (
                  <div key={`${row.iso}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1.2fr 1.6fr', gap: 16, padding: '10px 18px', minHeight: 48, borderBottom: '1px solid #e2ddd7', borderTop: topBorder, alignItems: 'center', background: row.isToday ? '#fdf3e7' : 'transparent', opacity: isPipelinePast ? 0.55 : 1 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: row.isToday ? '#b5620a' : row.event === 'TBD' ? '#9c9590' : '#1a1714', fontStyle: row.event === 'TBD' ? 'italic' : 'normal' }}>{row.event}</span>
                        {row.isToday && row.isFirstForDay && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 3, background: '#b5620a', color: '#fff', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Today</span>}
                      </div>
                      <div style={{ fontSize: 10, color: '#9c9590', marginTop: 2 }}>{row.when}</div>
                    </div>
                    <div style={{ minWidth: 0 }}><div style={{ fontSize: 11, color: row.dj1 === '—' ? '#c8c0b5' : '#1a1714' }}>{row.dj1}</div></div>
                    <div style={{ minWidth: 0 }}><div style={{ fontSize: 11, color: row.dj2 === '—' ? '#c8c0b5' : '#1a1714' }}>{row.dj2}</div></div>
                    <div style={{ minWidth: 0, display: 'flex', flexWrap: 'wrap' as const, gap: 3 }}>
                      {genres.length > 0 ? genres.map((g) => <span key={g} style={{ padding: '2px 7px', borderRadius: 3, fontSize: 10, fontWeight: 500, background: '#f0ece6', border: '1px solid #e2ddd7', color: '#6b6560' }}>{g}</span>) : <span style={{ color: '#c8c0b5', fontSize: 11 }}>—</span>}
                    </div>
                    <div style={{ minWidth: 0, display: 'flex', flexWrap: 'wrap' as const, gap: 3 }}>
                      {promos.length > 0 ? promos.map((p) => <span key={p} style={{ padding: '2px 7px', borderRadius: 3, fontSize: 10, fontWeight: 500, background: '#edf5f0', border: '1px solid #b8e0c8', color: '#2d7a4f' }}>{p}</span>) : <span style={{ color: '#c8c0b5', fontSize: 11 }}>—</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Weekly analysis strip — pinned to bottom */}
            <div style={{ borderTop: '2px solid #e2ddd7', background: '#fff' }}>
              {/* Stats bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #e2ddd7', gap: 8, backgroundColor: '#faf8f5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <Sparkles style={{ width: 10, height: 10, color: '#c9a84c', flexShrink: 0 }} />
                  <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#9c9590' }}>Weekly Analysis</span>
                  <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: `${ratingColor}18`, border: `1px solid ${ratingColor}55`, color: ratingColor, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>{rating}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  {[
                    { label: 'Events', value: String(eventCount) },
                    { label: 'DJs Booked', value: String(djBookedCount) },
                    { label: 'Club Nights', value: String(clubNightCount) },
                    { label: 'Unplanned', value: String(unplannedCount), amber: unplannedCount > 0 },
                  ].map((stat, i) => (
                    <div key={stat.label} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', padding: '0 12px', borderLeft: i > 0 ? '1px solid #e2ddd7' : 'none' }}>
                      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 900, color: stat.amber ? '#d97706' : '#1a1714', lineHeight: 1 }}>{stat.value}</span>
                      <span style={{ fontSize: 7, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#9c9590', marginTop: 2 }}>{stat.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Insights */}
              <div style={{ display: 'flex', flexDirection: 'column' as const }}>
                {insights.map((ins, i) => {
                  const InsIcon = ins.icon;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderTop: i > 0 ? '1px solid #f0ece6' : 'none' }}>
                      <InsIcon style={{ width: 11, height: 11, flexShrink: 0, color: '#9c9590' }} />
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#1a1714' }}>{ins.title}</span>
                        <span style={{ fontSize: 10, color: '#6b6560', marginLeft: 5 }}>{ins.body}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>{/* end pipeline card */}
        </div>{/* end two-column grid */}
      </div>

      {/* ══ SECTION 3 — THIS WEEK'S PROMOTIONS (exact copy of owner dashboard) ══ */}
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
            <span className="rounded-sm border border-primary/25 bg-primary/[0.08] px-2 py-0.5 text-[10px] tracking-widest text-primary uppercase">Every day</span>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">14:00 – 18:00</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-primary/10">
            {HAPPY_HOUR_ITEMS.map((item) => (
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
          {FIXED_PROMOS.map((p) => {
            const wd = weekDates.find((d) => d.day === p.dayKey);
            const isToday = wd?.iso === todayIso && isCurrentWeek;
            return (
              <div key={p.dayKey} className={cn('rounded-lg border bg-card shadow-card flex flex-col p-4', isToday ? 'border-primary bg-gradient-to-b from-primary/[0.06] to-card' : 'border-border')}>
                <div className="flex items-center justify-between mb-2">
                  <div className={cn('text-[10px] tracking-widest font-semibold uppercase', isToday ? 'text-primary' : 'text-muted-foreground')}>
                    {DAY_FULL[p.dayKey]}
                  </div>
                  {isToday && (
                    <span className="rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] tracking-[1.5px] text-primary uppercase leading-none">Today</span>
                  )}
                </div>
                <div className="text-xs font-semibold text-foreground leading-snug mb-3 flex-1">{p.name}</div>
                <div className={cn('rounded-md border px-2.5 py-2 text-xs text-secondary-foreground leading-snug mb-3', isToday ? 'border-primary/20 bg-primary/[0.05]' : 'border-primary/15 bg-primary/[0.04]')}>
                  {p.deal}
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums">{p.hours}</div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

export default VenueBriefing;
