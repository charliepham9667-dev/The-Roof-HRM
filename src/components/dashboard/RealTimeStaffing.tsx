import { Users, AlertTriangle, UserCheck, Loader2 } from 'lucide-react';
import { useStaffing } from '../../hooks/useDashboardData';

export interface RealTimeStaffingProps {
  /** If true, renders content only without card wrapper */
  noContainer?: boolean;
}

export function RealTimeStaffing({ noContainer = false }: RealTimeStaffingProps) {
  const { data, isLoading, error } = useStaffing();

  if (isLoading) {
    if (noContainer) {
      return (
        <div className="h-full w-full flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="rounded-card border border-border bg-card p-4 md:p-6 min-h-[200px] md:min-h-[256px] w-full shadow-card flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    if (noContainer) {
      return (
        <div className="h-full w-full flex items-center justify-center">
          <p className="text-muted-foreground">Failed to load staffing data</p>
        </div>
      );
    }

    return (
      <div className="rounded-card border border-border bg-card p-4 md:p-6 min-h-[200px] md:min-h-[256px] w-full shadow-card flex items-center justify-center">
        <p className="text-muted-foreground">Failed to load staffing data</p>
      </div>
    );
  }

  const activeStaff = data?.activeStaff || 0;
  const totalRequired = data?.totalRequired || 0;
  const coverage = data?.coveragePercentage || 0;
  const guestStaffRatio = data?.guestStaffRatio ? `${data.guestStaffRatio} : 1` : 'N/A';
  const coverageGaps = data?.coverageGaps || [];
  const hasGaps = coverageGaps.length > 0;

  const content = (
    <>
      <div className="flex items-center justify-end">
        <span className="flex items-center gap-1.5 rounded-full bg-success/20 px-2 py-0.5 text-xs font-medium text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          LIVE
        </span>
      </div>

      <div className="space-y-4">
        {/* Active Staff */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Users className="h-4 w-4 text-foreground/70" />
            </div>
            <span className="text-sm text-foreground/70">Active Staff</span>
          </div>
          <div className="text-right">
            <span className="text-xl font-bold text-foreground">
              {activeStaff}<span className="text-muted-foreground">/{totalRequired}</span>
            </span>
            <p className="text-xs text-muted-foreground">{coverage}% coverage</p>
          </div>
        </div>

        {/* Coverage Gaps */}
        {hasGaps && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-warning/10 border border-warning/30 p-2 md:p-3">
            <div className="flex items-center gap-2 md:gap-3">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-medium text-foreground">Coverage Gaps</p>
                <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                  {coverageGaps.map(g => `${g.count} ${g.role}`).join(', ')} shortage
                </p>
              </div>
            </div>
            <button className="rounded-control bg-foreground px-3 py-2 md:px-3 md:py-1.5 text-xs font-medium text-background hover:bg-foreground/90 transition-colors min-h-[36px] md:min-h-0 w-full sm:w-auto">
              RESOLVE
            </button>
          </div>
        )}

        {/* Guest:Staff Ratio */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <UserCheck className="h-4 w-4 text-foreground/70" />
            </div>
            <span className="text-sm text-foreground/70">Guest:Staff Ratio</span>
          </div>
          <span className="text-xl font-bold text-foreground">{guestStaffRatio}</span>
        </div>
      </div>
    </>
  );

  if (noContainer) {
    return <div className="h-full min-h-0 w-full flex flex-col space-y-3">{content}</div>;
  }

  return (
    <div className="rounded-card border border-border bg-card p-4 md:p-6 min-h-[200px] md:min-h-[256px] w-full shadow-card flex flex-col">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="text-base md:text-lg font-semibold text-foreground">Real-time Staffing</h3>
        <span className="flex items-center gap-1.5 rounded-full bg-success/20 px-2 py-0.5 text-xs font-medium text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          LIVE
        </span>
      </div>
      {content}
    </div>
  );
}
