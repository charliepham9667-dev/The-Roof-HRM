import * as React from 'react';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { useMonthlyPerformance } from '../../hooks/useDashboardData';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BAR_COLORS, CHART_COLORS } from '@/lib/chart-colors';

type Period = 'tm' | '3m' | '6m' | '12m';

const colors = {
  actual: BAR_COLORS.current,
  target: BAR_COLORS.target,
  grid: CHART_COLORS.grid,
};

const chartConfig = {
  actual: { label: 'Actual', color: BAR_COLORS.current },
  target: { label: 'Target', color: BAR_COLORS.target },
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

export interface MonthlyPerformanceProps {
  /** If true, renders content only without card wrapper */
  noContainer?: boolean;
}

export function MonthlyPerformance({ noContainer = false }: MonthlyPerformanceProps) {
  const isMobile = useIsMobile();
  const [period, setPeriod] = React.useState<Period>('6m');

  React.useEffect(() => {
    if (isMobile) setPeriod('3m');
  }, [isMobile]);

  const { data: monthlyData, isLoading, isFetching, error } = useMonthlyPerformance(period);

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

  if (error || !monthlyData || monthlyData.length === 0) {
    if (noContainer) {
      return (
        <div className="min-h-[280px] md:min-h-[380px] w-full flex items-center justify-center">
          <p className="text-muted-foreground">No monthly data available</p>
        </div>
      );
    }

    return (
      <div className="rounded-card border border-border bg-card p-4 md:p-6 min-h-[280px] md:min-h-[380px] w-full shadow-card flex items-center justify-center">
        <p className="text-muted-foreground">No monthly data available</p>
      </div>
    );
  }

  // Get current month data (last in array)
  const currentMonth = monthlyData[monthlyData.length - 1];

  const isOnTarget = currentMonth.achievementPercent >= 100;

  const periodLabel =
    period === 'tm'
      ? 'This month'
      : period === '3m'
        ? 'Last 3 months'
        : period === '6m'
          ? 'Last 6 months'
          : 'Last 12 months';

  const content = (
    <>
      <div className="@container/card flex h-full flex-col">
        <div className="relative">
          <div className="grid gap-1 pr-44">
            <span
              className={`flex items-center gap-1 text-sm font-medium ${
                isOnTarget ? 'text-success' : 'text-error'
              }`}
            >
              {isOnTarget ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {currentMonth.achievementPercent}%
              {isFetching && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </span>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </div>

          <div className="absolute right-0 top-0">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="flex w-40" aria-label="Select a value">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent className="rounded-control">
                <SelectItem value="tm" className="rounded-lg">
                  This month
                </SelectItem>
                <SelectItem value="12m" className="rounded-lg">
                  Last 12 months
                </SelectItem>
                <SelectItem value="6m" className="rounded-lg">
                  Last 6 months
                </SelectItem>
                <SelectItem value="3m" className="rounded-lg">
                  Last 3 months
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 flex-1">
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-full min-h-[250px] w-full block [&_.recharts-surface]:!h-full [&_.recharts-surface]:!w-full"
          >
            <BarChart accessibilityLayer data={monthlyData}>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis
                dataKey="monthKey"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => {
                  const y = String(value).slice(0, 4)
                  const m = String(value).slice(5, 7)
                  const d = new Date(`${y}-${m}-01T00:00:00`)
                  return d.toLocaleDateString('en-US', { month: 'short' })
                }}
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
                    indicator="dashed"
                    labelFormatter={(value) => {
                      const y = String(value).slice(0, 4)
                      const m = String(value).slice(5, 7)
                      const d = new Date(`${y}-${m}-01T00:00:00`)
                      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    }}
                    formatter={(value, name) => {
                      if (name === 'actualRevenue') return [formatVndFull(Number(value)), 'Actual']
                      if (name === 'targetRevenue') return [formatVndFull(Number(value)), 'Target']
                      return [formatVndFull(Number(value)), String(name)]
                    }}
                  />
                }
              />
              <Bar dataKey="targetRevenue" fill={colors.target} radius={4} />
              <Bar
                dataKey="actualRevenue"
                fill={colors.actual}
                radius={4}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </div>
    </>
  );

  if (noContainer) {
    return <div className="flex h-full flex-col gap-4">{content}</div>;
  }

  return (
    <div className="rounded-card border border-border bg-card p-4 md:p-6 min-h-[280px] md:min-h-[380px] w-full shadow-card flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base md:text-lg font-semibold text-foreground">Monthly Performance</h3>
      </div>
      <div className="space-y-4">{content}</div>
    </div>
  );
}
