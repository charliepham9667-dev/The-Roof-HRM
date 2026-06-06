import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { useMonthlyPerformance } from '../../hooks/useDashboardData';
import type { MonthlyPerformanceData } from '../../hooks/useDashboardData';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CHART_COLORS } from '@/lib/chart-colors';
import { FinanceSummaryStatCell } from '@/components/finance/finance-ui';
import {
  summarizeMonthlyPerformance,
  formatSummaryM,
  formatSummaryVnd,
} from '@/lib/finance-monthly-summary';
import { cn } from '@/lib/utils';

type Period = 'tm' | '3m' | '6m' | '12m';
type MonthlyVariant = 'default' | 'financeSummary';

const BAR_COLORS_LOCAL = {
  actual: CHART_COLORS.primary,      // orange
  actualPartial: '#E7C8B1',           // peach for current month
  lastYear: '#D7CDB8',                // sand
  target: '#6C2B29',                  // burgundy
};

function formatBarLabel(value: number): string {
  return formatSummaryM(value);
}

function pctVsTarget(actual: number, target: number): { label: string; positive: boolean } | null {
  if (target <= 0) return null;
  const pct = Math.round(((actual - target) / target) * 100);
  return { label: `${pct >= 0 ? '+' : ''}${pct}% vs target`, positive: pct >= 0 };
}

// ── CSS bar chart ────────────────────────────────────────────────────────────

const BAR_AREA_H = 260; // px — the bar/target drawing area

function MonthColumn({
  entry,
  chartMax,
}: {
  entry: MonthlyPerformanceData;
  chartMax: number;
}) {
  const [hovered, setHovered] = React.useState(false);

  const curPct  = chartMax > 0 ? Math.min(100, (entry.actualRevenue  / chartMax) * 100) : 0;
  const prevPct = chartMax > 0 ? Math.min(100, (entry.lastYearRevenue / chartMax) * 100) : 0;
  const targetPct = (chartMax > 0 && entry.targetRevenue > 0)
    ? Math.min(100, (entry.targetRevenue / chartMax) * 100)
    : null;

  const vs = pctVsTarget(entry.actualRevenue, entry.targetRevenue);
  const isPartial = entry.isPartialMonth;
  const isPositive = vs?.positive ?? false;
  // For months in a prior year we only show the target line + last-year bar.
  // The "this year" orange bar would incorrectly display last-year actuals for those months.
  const isPastYear = entry.year < new Date().getFullYear();

  const revenueLabelColor = isPartial
    ? CHART_COLORS.primary
    : isPositive
      ? '#16A34A'
      : '#1C1411';

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Revenue label */}
      <div
        className="mb-1.5 text-[13px] font-bold tabular-nums"
        style={{
          color: isPastYear ? '#78716C' : revenueLabelColor,
          fontFamily: "'Cormorant Garamond', Georgia, serif",
        }}
      >
        {entry.actualRevenue > 0 ? formatBarLabel(entry.actualRevenue) : ''}
      </div>

      {/* Bar + target line area */}
      <div className="w-full" style={{ height: BAR_AREA_H }}>
        <div className="flex h-full items-end justify-center">
          <div className="relative flex h-full w-[78%] items-end gap-[4px]">
            {/* Bars render first so target line paints on top */}
            {isPastYear ? (
              // Past-year months (e.g. Jun–Dec 2025 in a 12-month view):
              // actualRevenue IS the 2025 data — show it as a single sand bar.
              // No orange bar and no "last year" (2024) bar since we don't have 2024 data.
              <div
                className="min-h-[2px] w-1/2 rounded-t-[3px]"
                style={{
                  height: `${curPct}%`,
                  backgroundColor: BAR_COLORS_LOCAL.lastYear,
                }}
              />
            ) : (
              <>
                {/* Last year sand bar */}
                <div
                  className="min-h-[2px] flex-1 rounded-t-[3px]"
                  style={{
                    height: `${prevPct}%`,
                    backgroundColor: BAR_COLORS_LOCAL.lastYear,
                  }}
                />
                {/* This year orange bar */}
                <div
                  className="min-h-[2px] flex-1 rounded-t-[3px]"
                  style={{
                    height: `${curPct}%`,
                    backgroundColor: isPartial ? BAR_COLORS_LOCAL.actualPartial : BAR_COLORS_LOCAL.actual,
                  }}
                />
              </>
            )}

            {/* Target line + label — rendered after bars so it always paints on top */}
            {targetPct !== null && (
              <>
                {/* Value label above the line */}
                <div
                  className="pointer-events-none absolute left-0 right-0 flex justify-center"
                  style={{ bottom: `calc(${targetPct}% + 4px)`, zIndex: 20 }}
                >
                  <span
                    className="text-[8.5px] font-semibold leading-none"
                    style={{ color: BAR_COLORS_LOCAL.target }}
                  >
                    {formatBarLabel(entry.targetRevenue)}
                  </span>
                </div>
                {/* The line — white outline keeps it visible against bars */}
                <div
                  className="pointer-events-none absolute left-0 right-0 rounded-full"
                  style={{
                    bottom: `${targetPct}%`,
                    height: 2.5,
                    backgroundColor: BAR_COLORS_LOCAL.target,
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.55)',
                    zIndex: 20,
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hover tooltip — floats just above the tallest bar */}
      {hovered && (
        <div
          className="pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-2.5 py-2 shadow-lg"
          style={{
            // bottom = label area + height of tallest rendered bar + 8px gap
            bottom: `calc(${34 + (Math.max(curPct, isPastYear ? 0 : prevPct) / 100) * BAR_AREA_H + 8}px)`,
          }}
        >
          <p className="text-[10px] font-semibold text-foreground">
            {entry.isPartialMonth ? `${entry.month} MTD` : `${entry.month} ${entry.year}`}
          </p>
          <div className="mt-1 space-y-0.5">
            {isPastYear ? (
              // For 2025 months the single sand bar IS the 2025 actual.
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="inline-block h-2 w-2 rounded-[2px]" style={{ backgroundColor: BAR_COLORS_LOCAL.lastYear }} />
                <span className="text-muted-foreground">Actual {entry.year}:</span>
                <span className="font-semibold text-foreground">{formatBarLabel(entry.actualRevenue)}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="inline-block h-2 w-2 rounded-[2px] bg-primary" />
                  <span className="text-muted-foreground">This year:</span>
                  <span className="font-semibold text-foreground">{formatBarLabel(entry.actualRevenue)}</span>
                </div>
                {entry.lastYearRevenue > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="inline-block h-2 w-2 rounded-[2px]" style={{ backgroundColor: BAR_COLORS_LOCAL.lastYear }} />
                    <span className="text-muted-foreground">Last year:</span>
                    <span className="font-semibold text-foreground">{formatBarLabel(entry.lastYearRevenue)}</span>
                  </div>
                )}
              </>
            )}
            {entry.targetRevenue > 0 && (
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="inline-block h-0.5 w-2 rounded" style={{ backgroundColor: BAR_COLORS_LOCAL.target }} />
                <span className="text-muted-foreground">Target:</span>
                <span className="font-semibold" style={{ color: BAR_COLORS_LOCAL.target }}>{formatBarLabel(entry.targetRevenue)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Month name */}
      <div
        className={cn(
          'mt-1.5 text-[10px]',
          isPartial ? 'font-bold text-primary' : 'font-medium text-muted-foreground',
        )}
      >
        {isPartial ? `${entry.month} MTD` : entry.month}
      </div>

      {/* % vs target */}
      {vs && (
        <div
          className={cn(
            'text-[9px] font-semibold',
            vs.positive ? 'text-green-600' : 'text-red-600',
          )}
        >
          {vs.label}
        </div>
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export interface MonthlyPerformanceProps {
  noContainer?: boolean;
  variant?: MonthlyVariant;
}

export function MonthlyPerformance({
  noContainer = false,
  variant = 'default',
}: MonthlyPerformanceProps) {
  const isFinanceSummary = variant === 'financeSummary';
  const isMobile = useIsMobile();
  const [period, setPeriod] = React.useState<Period>('6m');

  React.useEffect(() => {
    if (isMobile) setPeriod('3m');
  }, [isMobile, isFinanceSummary]);

  const { data: monthlyData, isLoading, isFetching, error } = useMonthlyPerformance(period);

  if (isLoading) {
    const loader = (
      <div className="flex min-h-[280px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
    if (noContainer) return loader;
    return (
      <div className="flex min-h-[280px] w-full items-center justify-center rounded-card border border-border bg-card p-4 shadow-card md:min-h-[380px] md:p-6">
        {loader}
      </div>
    );
  }

  if (error || !monthlyData || monthlyData.length === 0) {
    const empty = <p className="text-muted-foreground">No monthly data available</p>;
    if (noContainer) return empty;
    return (
      <div className="flex min-h-[280px] w-full items-center justify-center rounded-card border border-border bg-card p-4 shadow-card md:min-h-[380px] md:p-6">
        {empty}
      </div>
    );
  }

  const summary = summarizeMonthlyPerformance(monthlyData);

  // Compute chart Y-max with headroom
  const rawMax = Math.max(
    ...monthlyData.flatMap((d) =>
      [d.actualRevenue, d.lastYearRevenue, d.targetRevenue].filter((v) => v > 0),
    ),
    1,
  );
  const chartMax = rawMax * 1.12;

  const periodLabel =
    period === 'tm' ? 'This month'
    : period === '3m' ? 'Last 3 months'
    : period === '6m' ? 'Last 6 months'
    : 'Last 12 months';

  const periodSelect = (
    <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
      <SelectTrigger className="h-7 w-[9.5rem] shrink-0 rounded-full border px-3 py-0.5 text-[11px]" aria-label="Chart period">
        <SelectValue placeholder="Period" />
      </SelectTrigger>
      <SelectContent className="rounded-control">
        <SelectItem value="6m">Last 6 months</SelectItem>
        <SelectItem value="12m">Last 12 months</SelectItem>
        <SelectItem value="3m">Last 3 months</SelectItem>
        <SelectItem value="tm">This month</SelectItem>
      </SelectContent>
    </Select>
  );

  // ── Legend ────────────────────────────────────────────────────────────────
  const legend = (
    <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-primary" />
        This year
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: BAR_COLORS_LOCAL.lastYear }} />
        Last year
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-4" style={{ height: 2, background: BAR_COLORS_LOCAL.target, borderRadius: 1 }} />
        Target
      </span>
    </div>
  );

  // ── Header ────────────────────────────────────────────────────────────────
  const header = isFinanceSummary ? (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="font-serif text-[18px] font-semibold leading-tight text-foreground">
          Monthly Performance
        </h3>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          {periodLabel} · revenue vs prior year vs target
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
        {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {legend}
        {periodSelect}
      </div>
    </div>
  ) : (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Monthly Performance</p>
        <p className="text-xs text-muted-foreground">{periodLabel}</p>
      </div>
      <div className="flex items-center gap-2">
        {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {periodSelect}
      </div>
    </div>
  );

  // ── Chart ─────────────────────────────────────────────────────────────────
  const chart = (
    <div className="w-full overflow-x-auto">
      <div className="flex w-full min-w-[280px] gap-1 sm:gap-2">
        {monthlyData.map((entry) => (
          <MonthColumn key={entry.monthKey} entry={entry} chartMax={chartMax} />
        ))}
      </div>
    </div>
  );

  // ── Footer ────────────────────────────────────────────────────────────────
  const footer = isFinanceSummary ? (
    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-dashed border-border/60 pt-[14px] lg:grid-cols-4">
      <FinanceSummaryStatCell
        boxed
        label={
          period === 'tm' ? 'MTD Revenue'
          : period === '3m' ? '3-Mo Revenue'
          : period === '12m' ? '12-Mo Revenue'
          : '6-Mo Revenue'
        }
        value={formatSummaryVnd(summary.sixMoRevenue)}
        sub={
          summary.sixMoVsPriorPct != null ? (
            <span className={summary.sixMoVsPriorPct >= 0 ? 'text-success' : 'text-error'}>
              {summary.sixMoVsPriorPct >= 0 ? '↑' : '↓'} {Math.abs(summary.sixMoVsPriorPct)}% vs prior{' '}
              {period === 'tm' ? 'month' : period === '3m' ? '3mo' : period === '12m' ? '12mo' : '6mo'}
            </span>
          ) : undefined
        }
      />
      <FinanceSummaryStatCell
        boxed
        label="Avg Per Month"
        value={formatSummaryVnd(summary.avgPerMonth)}
        sub={
          <span className="text-success">↑ target was {formatSummaryM(summary.avgTarget)}</span>
        }
      />
      <FinanceSummaryStatCell
        boxed
        label="Best Month"
        value={`${summary.bestMonth.month} · ${formatSummaryM(summary.bestMonth.revenue)}`}
        sub={(() => {
          const b = monthlyData.find((m) => m.month === summary.bestMonth.month);
          if (!b) return undefined;
          const p = pctVsTarget(b.actualRevenue, b.targetRevenue);
          return p ? (
            <span className={p.positive ? 'text-success' : 'text-error'}>
              {p.positive ? '↑' : '↓'} {p.label}
            </span>
          ) : undefined;
        })()}
      />
      <FinanceSummaryStatCell
        boxed
        label="Targets Hit"
        value={`${summary.targetsHit} of ${summary.targetsTotal}`}
        sub={
          summary.closestMiss ? (
            <span className="text-warning">↑ {summary.closestMiss.month} just missed</span>
          ) : (
            <span className="text-success">All full months on target</span>
          )
        }
      />
    </div>
  ) : null;

  // ── Non-financeSummary legend (below chart) ───────────────────────────────
  const defaultLegend = !isFinanceSummary ? (
    <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />
        This year
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BAR_COLORS_LOCAL.lastYear }} />
        Last year
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-3" style={{ height: 2, background: BAR_COLORS_LOCAL.target }} />
        Target
      </span>
    </div>
  ) : null;

  const content = (
    <>
      {header}
      {chart}
      {defaultLegend}
      {footer}
    </>
  );

  if (noContainer) {
    return <div className="flex h-full flex-col">{content}</div>;
  }

  return (
    <div className="flex min-h-[280px] w-full flex-col rounded-card border border-border bg-card p-4 shadow-card md:min-h-[380px] md:p-6">
      {content}
    </div>
  );
}
