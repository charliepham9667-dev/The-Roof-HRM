import { AlertCircle, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useCompliance } from '../../hooks/useDashboardData';

type AlertStatus = 'action_required' | 'needs_attention' | 'passed' | 'pending';

// Calculate days remaining until due date
function getDaysRemaining(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const today = new Date();
  const due = new Date(dueDate);
  const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

const statusConfig: Record<AlertStatus, {
  icon: typeof AlertCircle;
  bgColor: string;
  borderColor: string;
  textColor: string;
  badgeBg: string;
  badgeText: string;
}> = {
  action_required: {
    icon: AlertCircle,
    bgColor: 'bg-error/20',
    borderColor: 'border-error/30',
    textColor: 'text-error',
    badgeBg: 'bg-error',
    badgeText: 'Action Required',
  },
  needs_attention: {
    icon: AlertTriangle,
    bgColor: 'bg-warning/20',
    borderColor: 'border-warning/30',
    textColor: 'text-warning',
    badgeBg: 'bg-warning',
    badgeText: 'Needs Attention',
  },
  passed: {
    icon: CheckCircle,
    bgColor: 'bg-success/20',
    borderColor: 'border-success/30',
    textColor: 'text-success',
    badgeBg: 'bg-success',
    badgeText: 'Passed',
  },
  pending: {
    icon: AlertTriangle,
    bgColor: 'bg-muted/50',
    borderColor: 'border-muted',
    textColor: 'text-muted-foreground',
    badgeBg: 'bg-muted-foreground',
    badgeText: 'Pending',
  },
};

export interface ComplianceAlertsProps {
  /** If true, renders content only without card wrapper */
  noContainer?: boolean;
}

export function ComplianceAlerts({ noContainer = false }: ComplianceAlertsProps) {
  const { data: complianceItems, isLoading, error } = useCompliance();

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
          <p className="text-muted-foreground">Failed to load compliance data</p>
        </div>
      );
    }

    return (
      <div className="rounded-card border border-border bg-card p-4 md:p-6 min-h-[200px] md:min-h-[256px] w-full shadow-card flex items-center justify-center">
        <p className="text-muted-foreground">Failed to load compliance data</p>
      </div>
    );
  }

  const list = (complianceItems || []).map((item) => {
    const config = statusConfig[item.status];
    const Icon = config.icon;
    const daysRemaining = getDaysRemaining(item.dueDate);

    return (
      <div
        key={item.id}
        className={`flex items-start gap-3 rounded-lg p-3 ${config.bgColor} border ${config.borderColor}`}
      >
        <Icon className={`h-5 w-5 mt-0.5 ${config.textColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
            {daysRemaining !== null && daysRemaining > 0 && (
              <span className="rounded-full bg-error/30 px-2 py-0.5 text-[10px] font-medium text-error">
                {daysRemaining} days
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-2">{item.description}</p>
          <span
            className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium text-white ${config.badgeBg}`}
          >
            {config.badgeText}
          </span>
        </div>
      </div>
    );
  });

  if (noContainer) {
    return (
      <div className="h-full min-h-0 w-full flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">{list}</div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border bg-card p-4 md:p-6 min-h-[200px] md:min-h-[256px] w-full shadow-card flex flex-col">
      <h3 className="text-base md:text-lg font-semibold text-foreground mb-3 md:mb-4">Compliance Alerts</h3>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">{list}</div>
    </div>
  );
}
