import * as React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { useWeeklySales, useRevenueVelocity } from '../../hooks/useDashboardData';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BAR_COLORS, CHART_COLORS } from '@/lib/chart-colors';

type TimeRange = '7d' | '30d';

const colors = {
  actual: BAR_COLORS.current, // #C74C3C - Terracotta
  lastYear: BAR_COLORS.previous, // #E7C8B1 - Peach
  target: BAR_COLORS.target, // #78716C - Gray
  grid: CHART_COLORS.grid, // #E7E0DA
};

const chartConfig = {
  actual: { label: 'Actual', color: colors.actual },
  lastYear: { label: 'Last year', color: colors.lastYear },
} satisfies ChartConfig;

function formatVndAxis(value: number) {
  // Keep axis compact but still "VND-like".
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
  // "Dates and day"
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${md} ${wd}`;
}

function WeeklyTotalsLegend({
  actualTotal,
  lastYearTotal,
}: {
  actualTotal: number
  lastYearTotal: number
}) {
  return (
    <div className="flex h-[78px] flex-wrap items-center justify-center gap-x-6 gap-y-1 pt-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full border border-border/50"
          style={{ backgroundColor: "var(--color-lastYear)" }}
          aria-hidden="true"
        />
        <span className="text-muted-foreground">Last year</span>
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formatVndFull(lastYearTotal)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full border border-border/50"
          style={{ backgroundColor: "var(--color-actual)" }}
          aria-hidden="true"
        />
        <span className="text-muted-foreground">Actual</span>
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formatVndFull(actualTotal)}
        </span>
      </div>
    </div>
  )
}

export interface WeeklySalesTrendProps {
  /** If true, renders content only without card wrapper */
  noContainer?: boolean;
}

export function WeeklySalesTrend({ noContainer = false }: WeeklySalesTrendProps) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState<TimeRange>('30d');

  React.useEffect(() => {
    if (isMobile) setTimeRange('7d');
  }, [isMobile]);

  const { data: weeklyData, isLoading, isFetching } = useWeeklySales(timeRange);
  const { data: velocityData } = useRevenueVelocity();

  const thisPeriodTotal = (weeklyData || []).reduce((sum, d) => sum + (d.actual || 0), 0);
  const lastYearTotal = (weeklyData || []).reduce((sum, d) => sum + (d.lastYear || 0), 0);
  
  // Daily target in VND (for target series)
  const dailyTarget = velocityData?.dailyTargetPace ?? undefined;
  const periodLabel = timeRange === '7d' ? 'last 7 days' : 'last 30 days';

  if (isLoading) {
    if (noContainer) {
      return (
        <div className="min-h-[280px] md:min-h-[380px] w-full flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="rounded-card border border-border bg-card p-4 md:p-6 min-h-[280px] md:min-h-[380px] w-full shadow-card flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
          {/* Header + period controls (design only) */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Weekly Sales Trends</p>
              <p className="text-xs text-muted-foreground">Total for the {periodLabel}</p>
            </div>

            <div className="flex items-center gap-2">
              {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

              <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <TabsList className="h-8 rounded-md border border-border bg-background p-0.5">
                  <TabsTrigger
                    value="30d"
                    className="h-7 rounded-[6px] px-2.5 text-xs data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none"
                  >
                    Last 30 days
                  </TabsTrigger>
                  <TabsTrigger
                    value="7d"
                    className="h-7 rounded-[6px] px-2.5 text-xs data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none"
                  >
                    Last 7 days
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Chart */}
          <div className="pt-2">
            {/* Expose the same chart CSS variables to the legend below */}
            <div
              style={
                {
                  ["--color-actual"]: colors.actual,
                  ["--color-lastYear"]: colors.lastYear,
                } as React.CSSProperties
              }
            >
              <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-actual)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-actual)" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillLastYear" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-lastYear)" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="var(--color-lastYear)" stopOpacity={0.06} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid vertical={false} stroke={colors.grid} />

                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                    tickFormatter={(value) => formatTickLabel(String(value))}
                  />

                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tickFormatter={(v) => formatVndAxis(Number(v))}
                  />

                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => formatTickLabel(String(value))}
                        formatter={(value, name) => {
                          if (name === 'target') return [formatVndFull(Number(value)), 'Daily Target']
                          if (name === 'actual') return [formatVndFull(Number(value)), 'Actual']
                          if (name === 'lastYear') return [formatVndFull(Number(value)), 'Last year']
                          return [formatVndFull(Number(value)), String(name)]
                        }}
                        indicator="dot"
                      />
                    }
                  />

                  {/* Areas */}
                  <Area
                    dataKey="lastYear"
                    type="natural"
                    fill="url(#fillLastYear)"
                    stroke="var(--color-lastYear)"
                    strokeWidth={1.5}
                  />
                  <Area
                    dataKey="actual"
                    type="natural"
                    fill="url(#fillActual)"
                    stroke="var(--color-actual)"
                    strokeWidth={2}
                  />

                  {/* Daily target line (orange, 60% opacity) */}
                  {typeof dailyTarget === 'number' && (
                    <ReferenceLine
                      y={dailyTarget}
                      stroke={colors.target}
                      strokeOpacity={0.6}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                    />
                  )}
                </AreaChart>
              </ChartContainer>

              {/* Weekly totals (Last year vs Actual) */}
              <WeeklyTotalsLegend actualTotal={thisPeriodTotal} lastYearTotal={lastYearTotal} />
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
        <h3 className="text-base md:text-lg font-semibold text-foreground">Weekly Sales Trends</h3>
      </div>
      {content}
    </div>
  );
}
