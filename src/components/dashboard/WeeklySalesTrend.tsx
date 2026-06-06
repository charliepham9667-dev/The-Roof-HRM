import * as React from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { useWeeklySales } from '../../hooks/useDashboardData';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { CHART_COLORS } from '@/lib/chart-colors';
import { cn } from '@/lib/utils';

type TimeRange = '7d' | '30d';
type WeeklyVariant = 'default' | 'financeSummary';

const colors = {
  actual: CHART_COLORS.primary,
  lastYear: '#9CA3AF',
  grid: CHART_COLORS.grid,
};

const chartConfig = {
  actual: { label: 'Actual', color: colors.actual },
  lastYear: { label: 'Last year', color: colors.lastYear },
} satisfies ChartConfig;

function formatVndAxis(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
    notation: 'compact',
  }).format(value);
}

function formatVndFull(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTickLabel(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function WeeklyTotalsLegend({
  actualTotal,
  lastYearTotal,
  actualColor,
  lastYearColor,
  inline = false,
}: {
  actualTotal: number
  lastYearTotal: number
  actualColor: string
  lastYearColor: string
  inline?: boolean
}) {
  return (
    <div
      className={
        inline
          ? 'flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-[11.5px] text-muted-foreground'
          : 'flex flex-col gap-2 pt-3 pb-1 text-xs text-muted-foreground'
      }
    >
      <span className="inline-flex items-center gap-2">
        <svg width="20" height="2" aria-hidden>
          <line x1="0" y1="1" x2="20" y2="1" stroke={actualColor} strokeWidth="2.4" />
        </svg>
        This year
        <strong className="font-mono font-medium tabular-nums text-foreground">
          {formatVndFull(actualTotal)}
        </strong>
      </span>
      <span className="inline-flex items-center gap-2">
        <svg width="20" height="2" aria-hidden>
          <line
            x1="0"
            y1="1"
            x2="20"
            y2="1"
            stroke={lastYearColor}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        </svg>
        Last year
        <strong className="font-mono font-medium tabular-nums text-[#6B7280]">
          {lastYearTotal > 0 ? formatVndFull(lastYearTotal) : 'No data'}
        </strong>
      </span>
    </div>
  )
}

export interface WeeklySalesTrendProps {
  noContainer?: boolean;
  variant?: WeeklyVariant;
}

export function WeeklySalesTrend({
  noContainer = false,
  variant = 'default',
}: WeeklySalesTrendProps) {
  const isFinanceSummary = variant === 'financeSummary';
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState<TimeRange>('7d');

  React.useEffect(() => {
    // Mobile always starts at 7d; desktop starts at 30d
    setTimeRange(isMobile ? '7d' : '30d');
  }, [isMobile]);

  const { data: weeklyData, isLoading, isFetching } = useWeeklySales(timeRange);

  const thisPeriodTotal = (weeklyData || []).reduce((sum, d) => sum + (d.actual || 0), 0);
  const lastYearTotal = (weeklyData || []).reduce((sum, d) => sum + (d.lastYear || 0), 0);

  const periodLabel = isFinanceSummary ? 'last 30 days' : timeRange === '7d' ? 'last 7 days' : 'last 30 days';

  if (isLoading) {
    const skeletonContent = (
      <div className="space-y-3 w-full p-4">
        <Skeleton className="h-4 w-36" />
        <div className="flex items-end gap-1 h-[220px] md:h-[320px] pt-2">
          {[60, 80, 45, 90, 70, 55, 85].map((h, i) => (
            <Skeleton key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="flex gap-4 pt-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    );

    if (noContainer) {
      return (
        <div className="min-h-[280px] md:min-h-[380px] w-full">
          {skeletonContent}
        </div>
      );
    }

    return (
      <div className="rounded-card border border-border bg-card min-h-[280px] md:min-h-[380px] w-full shadow-card">
        {skeletonContent}
      </div>
    );
  }

  if (!weeklyData || weeklyData.length === 0) {
    if (noContainer) {
      return (
        <div className="min-h-[280px] md:min-h-[380px] w-full flex items-center justify-center">
          <p className="text-muted-foreground">No sales data available</p>
        </div>
      );
    }

    return (
      <div className="rounded-card border border-border bg-card p-4 md:p-6 min-h-[280px] md:min-h-[380px] w-full shadow-card flex items-center justify-center">
        <p className="text-muted-foreground">No sales data available</p>
      </div>
    );
  }

  const content = (
    <>
      <div className="@container/card">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">Weekly Sales Trend</p>
              <p className="text-xs text-muted-foreground">
                {periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)} · daily revenue
              </p>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                <div className="flex rounded-lg border border-border bg-secondary/50 p-0.5 text-xs font-medium">
                  {(['7d', '30d'] as TimeRange[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setTimeRange(r)}
                      className={cn(
                        "rounded-md px-2.5 py-1 transition-all",
                        timeRange === r
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <WeeklyTotalsLegend
                actualTotal={thisPeriodTotal}
                lastYearTotal={lastYearTotal}
                actualColor={colors.actual}
                lastYearColor={colors.lastYear}
                inline
              />
            </div>
          </div>

          <div className="pt-2">
            <div
              style={
                {
                  ['--color-actual']: colors.actual,
                  ['--color-lastYear']: colors.lastYear,
                } as React.CSSProperties
              }
            >
              <ChartContainer config={chartConfig} className="aspect-auto h-[220px] md:h-[250px] w-full">
                <ComposedChart data={weeklyData}>
                  <defs>
                    <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-actual)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--color-actual)" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="2 4" />

                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval="preserveStartEnd"
                    minTickGap={24}
                    tickFormatter={(value) => formatTickLabel(String(value))}
                  />

                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={isMobile ? 44 : 64}
                    tickFormatter={(v) => formatVndAxis(Number(v))}
                  />

                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => formatTickLabel(String(value))}
                        formatter={(value, name) => {
                          if (name === 'actual') return [formatVndFull(Number(value)), 'This year'];
                          if (name === 'lastYear') return [formatVndFull(Number(value)), 'Last year'];
                          return [formatVndFull(Number(value)), String(name)];
                        }}
                        indicator="dot"
                      />
                    }
                  />

                  <Area
                    dataKey="actual"
                    type="monotone"
                    fill="url(#fillActual)"
                    stroke="var(--color-actual)"
                    strokeWidth={2.4}
                    dot={false}
                  />
                  <Line
                    dataKey="lastYear"
                    type="monotone"
                    stroke="var(--color-lastYear)"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                </ComposedChart>
              </ChartContainer>

              {!isFinanceSummary && (
                <WeeklyTotalsLegend
                  actualTotal={thisPeriodTotal}
                  lastYearTotal={lastYearTotal}
                  actualColor={colors.actual}
                  lastYearColor={colors.lastYear}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (noContainer) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <div className="rounded-card border border-border bg-card p-4 md:p-6 min-h-[280px] md:min-h-[380px] w-full shadow-card flex flex-col">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h3 className="text-base md:text-lg font-semibold text-foreground">Weekly Sales Trend</h3>
      </div>
      {content}
    </div>
  );
}
