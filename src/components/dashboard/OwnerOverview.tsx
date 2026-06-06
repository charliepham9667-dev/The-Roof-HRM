import { useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useKPISummary, useRevenueVelocity, MonthParam } from '../../hooks/useDashboardData';
import { WeeklySalesTrend } from './WeeklySalesTrend';
import { MonthlyPerformance } from './MonthlyPerformance';
import { TargetManager } from './TargetManager';
import { ExecutiveSummary } from './ExecutiveSummary';
import { FinancialHeadroomView } from '@/components/finance/FinancialHeadroomView';
import { MonthlyPLTable } from '@/components/finance/MonthlyPLTable';
import { FinanceKpiTile } from '@/components/finance/FinanceKpiTile';
import { MonthPaceCard } from '@/components/finance/MonthPaceCard';
import { VelocityInsightPill } from '@/components/finance/VelocityInsightPill';
import { computeMonthPace } from '@/lib/finance-pace';
import {
  DashboardCard,
  DashboardCardContent,
} from '@/components/ui';

function formatVND(value: number): string {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B đ`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M đ`;
  if (value >= 1000) return `${Math.round(value / 1000)}K đ`;
  return `${value} đ`;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatHeaderDate(d: Date): string {
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  return `${weekday} · ${month} ${day}`;
}

function MonthPicker({ selected, onChange }: { selected: MonthParam; onChange: (m: MonthParam) => void }) {
  const now = new Date();
  const isCurrentMonth = selected.year === now.getFullYear() && selected.month === now.getMonth();

  const prev = () => {
    if (selected.month === 0) onChange({ year: selected.year - 1, month: 11 });
    else onChange({ year: selected.year, month: selected.month - 1 });
  };
  const next = () => {
    if (isCurrentMonth) return;
    if (selected.month === 11) onChange({ year: selected.year + 1, month: 0 });
    else onChange({ year: selected.year, month: selected.month + 1 });
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-0.5 shadow-sm">
      <button onClick={prev} className="p-1 rounded hover:bg-muted transition-colors" aria-label="Previous month">
        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
      </button>
      <span className="text-sm font-medium text-foreground min-w-0 sm:min-w-[130px] text-center select-none">
        {MONTH_NAMES[selected.month]} {selected.year}
        {isCurrentMonth && <span className="ml-1 text-xs text-primary font-normal">(current)</span>}
      </span>
      <button
        onClick={next}
        disabled={isCurrentMonth}
        className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}

export function OwnerOverview() {
  const [showTargetManager, setShowTargetManager] = useState(false);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<MonthParam>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  const { data: kpi, isLoading: kpiLoading, error: kpiError } = useKPISummary(selectedMonth);
  const { data: velocity, isLoading: velocityLoading } = useRevenueVelocity(selectedMonth);

  const isCurrentMonth =
    selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth();
  const remainingDays = velocity
    ? Math.max(0, velocity.daysInMonth - velocity.currentDay)
    : 0;

  const pace = velocity
    ? computeMonthPace({
        mtdRevenue: velocity.mtdRevenue,
        monthlyTarget: velocity.monthlyTarget,
        dayOfMonth: velocity.currentDay,
        daysInMonth: velocity.daysInMonth,
        avgDailyRevenue: velocity.avgDailyRevenue,
      })
    : null;

  const headerDateLabel = isCurrentMonth
    ? formatHeaderDate(now)
    : `VIEWING · ${MONTH_NAMES[selectedMonth.month].toUpperCase()} ${selectedMonth.year}`;

  const isLoading = kpiLoading || velocityLoading;

  return (
    <div className="flex-1 space-y-4 bg-[#FDFBF7] -m-4 p-4 md:-m-6 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-primary">
            {headerDateLabel}
          </p>
          <h1 className="font-serif text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[32px]">
            Finance Summary
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {velocity && isCurrentMonth && (
            <VelocityInsightPill
              isOnTrack={pace?.isAheadOfPace ?? false}
              avgDailyRevenue={velocity.avgDailyRevenue}
              remainingDays={remainingDays}
            />
          )}
          <MonthPicker selected={selectedMonth} onChange={setSelectedMonth} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : kpiError || !kpi || !velocity ? (
          <div className="col-span-full rounded-lg border border-border bg-card p-6 text-center text-sm text-error">
            Failed to load KPIs. Check Supabase connection.
          </div>
        ) : (
          <>
            <FinanceKpiTile
              label="Total Revenue · MTD"
              value={formatVND(kpi.revenue.value)}
              trendPercent={kpi.revenue.trend}
              comparisonLine={`vs ${formatVND(kpi.lastYear.revenue)} same period last year`}
            />
            <FinanceKpiTile
              label="Pax · MTD"
              value={kpi.pax.value.toLocaleString()}
              trendPercent={kpi.pax.trend}
              comparisonLine={`vs ${kpi.lastYear.pax.toLocaleString()} same period last year`}
            />
            <FinanceKpiTile
              label="Avg Spend"
              value={formatVND(kpi.avgSpend.value)}
              trendPercent={kpi.avgSpend.trend}
              tone={kpi.avgSpend.trend < 0 ? 'warning' : 'default'}
              comparisonLine={
                kpi.avgSpend.trend < 0
                  ? 'Volume up, ticket down · check menu mix'
                  : `vs ${formatVND(kpi.lastYear.avgSpend)} same period last year`
              }
            />
            <MonthPaceCard
              mtdRevenue={velocity.mtdRevenue}
              monthlyTarget={velocity.monthlyTarget}
              dayOfMonth={velocity.currentDay}
              daysInMonth={velocity.daysInMonth}
              avgDailyRevenue={velocity.avgDailyRevenue}
              onEditTarget={() => setShowTargetManager(true)}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <DashboardCard className="lg:col-span-4 h-auto md:h-[430px] !overflow-visible border-border/80 bg-card">
          <DashboardCardContent className="pt-6">
            <WeeklySalesTrend noContainer variant="financeSummary" />
          </DashboardCardContent>
        </DashboardCard>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <DashboardCard className="w-full min-w-0 border-border/80 bg-card lg:flex-[1] lg:min-w-0">
          <DashboardCardContent className="pt-5">
            <ExecutiveSummary noContainer selectedMonth={selectedMonth} showHeader />
          </DashboardCardContent>
        </DashboardCard>

        <DashboardCard className="flex min-h-[300px] w-full min-w-0 flex-col border-border/80 bg-card lg:flex-[2] lg:min-w-0">
          <DashboardCardContent className="flex-1 pt-5">
            <MonthlyPerformance noContainer variant="financeSummary" />
          </DashboardCardContent>
        </DashboardCard>
      </div>

      <FinancialHeadroomView />
      <MonthlyPLTable />
      <TargetManager isOpen={showTargetManager} onClose={() => setShowTargetManager(false)} />
    </div>
  );
}
