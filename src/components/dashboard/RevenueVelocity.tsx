import { TrendingUp, TrendingDown, Target, Loader2 } from 'lucide-react';
import { useRevenueVelocity } from '../../hooks/useDashboardData';

// Format VND with commas
function formatVND(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' đ';
}

// Format VND in millions
function formatM(value: number): string {
  return `${(value / 1000000).toFixed(1)}M đ`;
}

export interface RevenueVelocityProps {
  /** If true, renders content only without card wrapper */
  noContainer?: boolean;
}

export function RevenueVelocity({ noContainer = false }: RevenueVelocityProps) {
  const { data, isLoading, error } = useRevenueVelocity();

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

  if (error || !data) {
    if (noContainer) {
      return (
        <div className="w-full flex items-center justify-center min-h-[300px]">
          <p className="text-muted-foreground">Unable to load revenue velocity</p>
        </div>
      );
    }

    return (
      <div className="rounded-card border border-border bg-card p-6 w-full shadow-card flex items-center justify-center min-h-[300px]">
        <p className="text-muted-foreground">Unable to load revenue velocity</p>
      </div>
    );
  }

  const {
    monthlyTarget,
    mtdRevenue,
    goalAchievedPercent,
    currentDay,
    daysInMonth,
    surplus,
    projectedMonthEnd,
    dailyTargetPace,
    showStretchGoal,
    stretchGoal,
    gapToStretch,
    requiredPaceForStretch,
    yesterdayRevenue,
    avgDailyRevenue,
  } = data;

  const isOnTrack = goalAchievedPercent >= (currentDay / daysInMonth) * 100;
  const remainingDays = daysInMonth - currentDay;

  // Generate dynamic insight
  const generateInsight = () => {
    if (showStretchGoal) {
      const paceNeeded = formatM(requiredPaceForStretch);
      if (yesterdayRevenue >= requiredPaceForStretch) {
        return `Great momentum! Yesterday's ${formatM(yesterdayRevenue)} keeps us on track for the stretch goal. Maintain ${paceNeeded}/day for the next ${remainingDays} days.`;
      } else {
        return `We secured the base target, but the path to ${formatM(stretchGoal)} requires ${paceNeeded}/day. Yesterday's ${formatM(yesterdayRevenue)} was below pace.`;
      }
    } else {
      const dailyNeeded = (monthlyTarget - mtdRevenue) / remainingDays;
      if (dailyNeeded <= avgDailyRevenue) {
        return `On track! At current pace (${formatM(avgDailyRevenue)}/day), we'll hit the target with ${remainingDays} days remaining.`;
      } else {
        return `Need to increase daily revenue to ${formatM(dailyNeeded)} for the remaining ${remainingDays} days to hit target.`;
      }
    }
  };

  const content = (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Goal: <span className="text-foreground font-medium">{formatVND(monthlyTarget)}</span>
        </p>
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium w-fit ${
          isOnTrack ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
        }`}>
          {isOnTrack ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {isOnTrack ? 'On Track' : 'Behind Pace'}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* MTD Revenue */}
        <div className="bg-background rounded-lg border border-border p-4 shadow-[0px_2px_3px_0px_rgba(0,0,0,0.15)]">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">MTD Revenue</p>
          <p className="text-xl font-bold text-foreground">{formatVND(mtdRevenue)}</p>
        </div>

        {/* Goal Achieved */}
        <div className="bg-background rounded-lg border border-border p-4 shadow-[0px_2px_3px_0px_rgba(0,0,0,0.15)]">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Goal Achieved</p>
          <p className={`text-xl font-bold ${goalAchievedPercent >= 100 ? 'text-success' : 'text-foreground'}`}>
            {goalAchievedPercent.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground">Day {currentDay} of {daysInMonth}</p>
        </div>

        {/* Surplus/Deficit */}
        <div className="bg-background rounded-lg border border-border p-4 shadow-[0px_2px_3px_0px_rgba(0,0,0,0.15)]">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            {surplus >= 0 ? 'Current Surplus' : 'Current Deficit'}
          </p>
          <p className={`text-xl font-bold ${surplus >= 0 ? 'text-success' : 'text-error'}`}>
            {surplus >= 0 ? '+' : ''}{formatVND(surplus)}
          </p>
        </div>

        {/* Projected Month End */}
        <div className="bg-background rounded-lg border border-border p-4 shadow-[0px_2px_3px_0px_rgba(0,0,0,0.15)]">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Projected Month End</p>
          <p className="text-xl font-bold text-foreground">{formatVND(projectedMonthEnd)}</p>
          <p className="text-xs text-muted-foreground">At current pace</p>
        </div>
      </div>

      {/* Stretch Goal Section (only if > 100% achieved) */}
      {showStretchGoal && (
        <div className="bg-gradient-to-r from-warning/10 to-primary/10 border border-warning/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-warning font-semibold">Stretch Goal: {formatVND(stretchGoal)}</span>
            <span className="text-xs text-muted-foreground">(1.5x target)</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Gap to Stretch</p>
              <p className="text-lg font-bold text-warning">{formatVND(gapToStretch)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Required Pace</p>
              <p className="text-lg font-bold text-warning">{formatM(requiredPaceForStretch)} / day</p>
            </div>
          </div>
        </div>
      )}

      {/* Daily Pace Info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm border-t border-border pt-4">
        <div>
          <span className="text-muted-foreground">Daily Target Pace: </span>
          <span className="text-foreground font-medium">{formatM(dailyTargetPace)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Your Average: </span>
          <span className={`font-medium ${avgDailyRevenue >= dailyTargetPace ? 'text-success' : 'text-error'}`}>
            {formatM(avgDailyRevenue)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Yesterday: </span>
          <span className={`font-medium ${yesterdayRevenue >= dailyTargetPace ? 'text-success' : 'text-warning'}`}>
            {formatM(yesterdayRevenue)}
          </span>
        </div>
      </div>

      {/* Velocity Insight */}
      <div className="bg-background rounded-lg border border-border p-4 shadow-[0px_2px_3px_0px_rgba(0,0,0,0.15)]">
        <p className="text-sm">
          <span className="text-primary font-semibold">Velocity Insight: </span>
          <span className="text-foreground/80">{generateInsight()}</span>
        </p>
      </div>
    </>
  );

  if (noContainer) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <div className="rounded-card border border-border bg-card p-4 md:p-6 w-full shadow-card flex flex-col min-h-[300px]">
      <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
        <Target className="h-4 w-4 md:h-5 md:w-5 text-primary" />
        <h3 className="text-base md:text-lg font-semibold text-foreground">Revenue Velocity</h3>
      </div>
      {content}
    </div>
  );
}
