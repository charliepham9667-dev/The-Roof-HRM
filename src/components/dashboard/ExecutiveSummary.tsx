import { Loader2 } from 'lucide-react';
import { useRevenueVelocity, useKPISummary, MonthParam } from '../../hooks/useDashboardData';
import { computeMonthPace } from '@/lib/finance-pace';
import { FinanceSummaryStatCell } from '@/components/finance/finance-ui';

function formatVND(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B đ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M đ`;
  return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' đ';
}

function formatM(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

export interface ExecutiveSummaryProps {
  noContainer?: boolean;
  selectedMonth?: MonthParam;
  /** Render title + status pill row (Finance Summary page) */
  showHeader?: boolean;
}

export function ExecutiveSummary({
  noContainer = false,
  selectedMonth,
  showHeader = false,
}: ExecutiveSummaryProps) {
  const { data: velocity, isLoading: velocityLoading } = useRevenueVelocity(selectedMonth);
  const { data: kpi, isLoading: kpiLoading } = useKPISummary(selectedMonth);

  const isLoading = velocityLoading || kpiLoading;

  if (isLoading) {
    const loader = (
      <div className="flex min-h-[200px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
    if (noContainer) return loader;
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center rounded-card border border-border bg-card p-6 shadow-card">
        {loader}
      </div>
    );
  }

  if (!velocity || !kpi) {
    const empty = <p className="text-muted-foreground">Unable to load summary</p>;
    if (noContainer) return empty;
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center rounded-card border border-border bg-card p-6 shadow-card">
        {empty}
      </div>
    );
  }

  const {
    monthlyTarget,
    mtdRevenue,
    projectedMonthEnd,
    avgDailyRevenue,
    currentDay,
    daysInMonth,
    yesterdayRevenue,
  } = velocity;

  const now = new Date();
  const isPast = selectedMonth
    ? selectedMonth.year < now.getFullYear() ||
      (selectedMonth.year === now.getFullYear() && selectedMonth.month < now.getMonth())
    : false;
  const remainingDays = Math.max(0, daysInMonth - currentDay);

  const pace = computeMonthPace({
    mtdRevenue,
    monthlyTarget,
    dayOfMonth: currentDay,
    daysInMonth,
    avgDailyRevenue,
  });

  const targetAbovePct =
    monthlyTarget > 0
      ? Math.round(((projectedMonthEnd - monthlyTarget) / monthlyTarget) * 100)
      : 0;

  const requiredDailyToMiss =
    remainingDays > 0 ? (monthlyTarget - mtdRevenue) / remainingDays : 0;

  const headerRow = showHeader ? (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-serif text-lg font-semibold text-foreground">Executive Summary</h3>
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
          pace.isAheadOfPace ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
        }`}
      >
        {pace.isAheadOfPace ? 'On Track' : 'Behind Pace'} · Day {currentDay}/{daysInMonth}
      </span>
    </div>
  ) : (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <p className="text-xs text-muted-foreground">
        Goal: <span className="font-medium text-foreground">{formatVND(monthlyTarget)}</span>
      </p>
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
          pace.isAheadOfPace ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
        }`}
      >
        {pace.isAheadOfPace ? 'On Track' : 'Behind Pace'} · Day {currentDay}/{daysInMonth}
      </span>
    </div>
  );

  const content = (
    <>
      {headerRow}

      <p className="font-serif text-base leading-relaxed text-foreground">
        <span className="font-semibold text-primary">Strategic Headline · </span>
        {isPast ? (
          <>
            Finished with <strong className="text-success">{formatM(mtdRevenue)} đ</strong> against a{' '}
            <strong>{formatM(monthlyTarget)}</strong> target
            {mtdRevenue >= monthlyTarget ? ' — target cleared.' : '.'}
          </>
        ) : (
          <>
            You&apos;ve cleared <strong className="text-success">{formatM(mtdRevenue)} đ</strong> in {currentDay}{' '}
            days — already{' '}
            <strong className="text-success">
              {pace.paceAheadPercent > 0 ? '+' : ''}
              {pace.paceAheadPercent}% ahead of pace
            </strong>{' '}
            for the {formatM(monthlyTarget)} target. At your current {formatM(avgDailyRevenue)}/day run-rate,
            you&apos;re projected to close at{' '}
            <strong className="text-success">{formatM(projectedMonthEnd)} đ</strong>
            {targetAbovePct > 0 ? ` — ${targetAbovePct}% above target.` : '.'}
          </>
        )}
      </p>

      {kpi.avgSpend.trend < 0 && (
        <p className="mt-3 font-serif text-base leading-relaxed text-foreground">
          <span className="font-semibold text-primary">One watch-out · </span>
          Avg spend per guest is <strong className="text-warning">{formatVND(kpi.avgSpend.value)}</strong>, down{' '}
          {Math.abs(Math.round(kpi.avgSpend.trend * 10) / 10)}% YoY. Pax volume more than made up for it (
          {kpi.pax.value.toLocaleString()} guests, +{Math.round(kpi.pax.trend)}%), but the ticket-mix shift is
          worth a menu review.
        </p>
      )}

      <div className="mt-4 rounded-lg border border-[#E7D5BC]/80 bg-[#F5EDE0] p-3 text-sm leading-relaxed text-foreground/90">
        <span className="font-semibold text-primary">Forecast · </span>
        {isPast ? (
          <>Final daily average was {formatM(avgDailyRevenue)} across the month.</>
        ) : (
          <>
            To miss target you&apos;d need to drop below{' '}
            <strong>{formatM(Math.max(0, requiredDailyToMiss))}/day</strong>
            {yesterdayRevenue > 0 && (
              <>
                {' '}
                — yesterday <strong className="text-success">{formatM(yesterdayRevenue)}</strong>.
              </>
            )}
          </>
        )}
      </div>

      <div
        className={`mt-4 grid gap-3 border-t border-border/60 pt-4 ${
          showHeader ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'
        }`}
      >
        <FinanceSummaryStatCell
          boxed={showHeader}
          label="MTD"
          value={formatVND(mtdRevenue)}
          valueClassName="text-success"
        />
        <FinanceSummaryStatCell
          boxed={showHeader}
          label="Forecast"
          value={formatVND(isPast ? mtdRevenue : projectedMonthEnd)}
          valueClassName="text-success"
        />
        <FinanceSummaryStatCell boxed={showHeader} label="Target" value={formatVND(monthlyTarget)} />
        <FinanceSummaryStatCell boxed={showHeader} label="Days Left" value={String(remainingDays)} />
      </div>
    </>
  );

  if (noContainer) return <div className="space-y-1">{content}</div>;

  return (
    <div className="flex min-h-[300px] w-full flex-col rounded-card border border-border bg-card p-4 shadow-card md:p-6">
      <h3 className="mb-4 font-serif text-lg font-semibold text-foreground">Executive Summary</h3>
      {content}
    </div>
  );
}
