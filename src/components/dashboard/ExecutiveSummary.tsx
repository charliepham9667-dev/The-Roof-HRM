import { Building2, Loader2 } from 'lucide-react';
import { useRevenueVelocity } from '../../hooks/useDashboardData';
import { useKPISummary } from '../../hooks/useDashboardData';

// Format VND with commas
function formatVND(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' đ';
}

// Format VND in millions
function formatM(value: number): string {
  return `${(value / 1000000).toFixed(1)}M đ`;
}

export interface ExecutiveSummaryProps {
  /** If true, renders content only without card wrapper */
  noContainer?: boolean;
}

export function ExecutiveSummary({ noContainer = false }: ExecutiveSummaryProps) {
  const { data: velocity, isLoading: velocityLoading } = useRevenueVelocity();
  const { data: kpi, isLoading: kpiLoading } = useKPISummary();

  const isLoading = velocityLoading || kpiLoading;

  if (isLoading) {
    if (noContainer) {
      return (
        <div className="w-full flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="rounded-card border border-border bg-card p-6 w-full shadow-card flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!velocity || !kpi) {
    if (noContainer) {
      return (
        <div className="w-full flex items-center justify-center min-h-[300px]">
          <p className="text-muted-foreground">Unable to load summary</p>
        </div>
      );
    }

    return (
      <div className="rounded-card border border-border bg-card p-6 w-full shadow-card flex items-center justify-center min-h-[300px]">
        <p className="text-muted-foreground">Unable to load summary</p>
      </div>
    );
  }

  const {
    monthlyTarget,
    mtdRevenue,
    surplus,
    projectedMonthEnd,
    avgDailyRevenue,
    currentDay,
    daysInMonth,
    showStretchGoal,
    stretchGoal,
    requiredPaceForStretch,
    yesterdayRevenue,
  } = velocity;

  const remainingDays = daysInMonth - currentDay;
  const paxValue = kpi.pax.value;
  const paxTrend = kpi.pax.trend;
  const avgSpend = kpi.avgSpend.value;

  // Determine momentum status
  const yesterdayBelowAvg = yesterdayRevenue < avgDailyRevenue;
  const targetCleared = mtdRevenue >= monthlyTarget;

  // Calculate last year pax (approximate from trend)
  const lastYearPax = paxTrend > 0 ? Math.round(paxValue / (1 + paxTrend / 100)) : 0;

  // Generate strategic headline
  const generateHeadline = () => {
    if (targetCleared) {
      if (yesterdayBelowAvg) {
        return `We have cleared the ${formatM(monthlyTarget)} monthly target with ${formatM(mtdRevenue)} secured. However, momentum slowed yesterday, widening the gap to the ${formatM(stretchGoal)} stretch goal.`;
      } else {
        return `Strong performance! We've exceeded the ${formatM(monthlyTarget)} target with ${formatM(mtdRevenue)} secured and maintaining momentum toward the ${formatM(stretchGoal)} stretch goal.`;
      }
    } else {
      const gap = monthlyTarget - mtdRevenue;
      return `We're ${formatM(gap)} away from the ${formatM(monthlyTarget)} monthly target. ${remainingDays} days remaining to close the gap.`;
    }
  };

  // Generate forecast text
  const generateForecast = () => {
    if (showStretchGoal) {
      return `At our current daily average (${formatM(avgDailyRevenue)}), we are projected to land at ${formatM(projectedMonthEnd)}. To hit ${formatM(stretchGoal)}, we must average ${formatM(requiredPaceForStretch)}/day for the final ${remainingDays} days.`;
    } else {
      const requiredDaily = (monthlyTarget - mtdRevenue) / remainingDays;
      return `At our current daily average (${formatM(avgDailyRevenue)}), we are projected to land at ${formatM(projectedMonthEnd)}. To hit target, we need ${formatM(requiredDaily)}/day for the final ${remainingDays} days.`;
    }
  };

  const content = (
    <>
      {/* Strategic Headline */}
      <div>
        <p className="text-sm text-foreground/80 leading-relaxed">
          <span className="text-primary font-semibold">Strategic Headline: </span>
          {generateHeadline()}
        </p>
      </div>

      {/* Performance Snapshot */}
      <div className="border-b border-border pb-4">
        <p className="text-sm font-semibold text-foreground mb-2">Performance Snapshot:</p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-muted-foreground">•</span>
            <span>
              <span className="text-primary font-medium">Goal Status: </span>
              <span className="text-foreground/80">
                We are <span className={`font-semibold ${surplus >= 0 ? 'text-success' : 'text-error'}`}>
                  {surplus >= 0 ? '+' : ''}{formatM(surplus)}
                </span> {surplus >= 0 ? 'over' : 'under'} the monthly target.
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-foreground">•</span>
            <span>
              <span className="text-primary font-medium">Volume: </span>
              <span className="text-foreground/80">
                Guest count has reached <span className="font-semibold text-foreground">{paxValue.toLocaleString()} pax</span>.
                {paxTrend > 0 && lastYearPax > 0 && (
                  <> This is a <span className="font-semibold text-success">{paxTrend.toFixed(0)}% increase</span> over the same period last year ({lastYearPax.toLocaleString()} pax).</>
                )}
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-foreground">•</span>
            <span>
              <span className="text-primary font-medium">Avg Spend: </span>
              <span className="text-foreground/80">
                Average spend per guest is <span className="font-semibold text-foreground">{formatVND(avgSpend)}</span>.
                {kpi.avgSpend.trend < 0 && (
                  <span className="text-warning"> ({kpi.avgSpend.trend.toFixed(1)}% vs last year)</span>
                )}
              </span>
            </span>
          </li>
        </ul>
      </div>

      {/* Forecast */}
      <div className="bg-background rounded-lg border border-border p-4 shadow-[0px_2px_3px_0px_rgba(0,0,0,0.15)]">
        <p className="text-sm">
          <span className="text-primary font-semibold">Forecast: </span>
          <span className="text-foreground/80">{generateForecast()}</span>
        </p>
      </div>
    </>
  );

  if (noContainer) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <div className="rounded-card border border-border bg-card p-4 md:p-6 w-full shadow-card flex flex-col min-h-[300px]">
      <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
        <Building2 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
        <h3 className="text-base md:text-lg font-semibold text-foreground">Executive Summary</h3>
      </div>
      <div className="space-y-4">{content}</div>
    </div>
  );
}
