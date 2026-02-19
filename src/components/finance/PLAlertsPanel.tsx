import { AlertTriangle, TrendingDown, TrendingUp, CheckCircle, Zap, DollarSign } from 'lucide-react';
import type { PnlMonthly } from '../../types';

interface PLAlertsPanelProps {
  currentData: PnlMonthly | null;
  previousData?: PnlMonthly | null;
  budgetData?: PnlMonthly | null;
  className?: string;
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'success' | 'info';
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  actionLabel?: string;
}

function generateAlerts(
  current: PnlMonthly | null, 
  previous: PnlMonthly | null,
  budget: PnlMonthly | null
): Alert[] {
  const alerts: Alert[] = [];
  
  if (!current) return alerts;

  // 1. Labor Variance Alert
  if (budget && budget.budgetLabor > 0) {
    const laborVariance = ((current.laborCost - budget.budgetLabor) / budget.budgetLabor) * 100;
    if (laborVariance > 10) {
      alerts.push({
        id: 'labor-variance',
        type: 'critical',
        icon: AlertTriangle,
        title: 'Labor Variance',
        description: `Labor costs are over budget by ${laborVariance.toFixed(0)}%. Review overtime hours.`,
        actionLabel: 'Investigate Log',
      });
    }
  } else if (current.laborPercentage > 20) {
    // No budget, but labor % is high
    alerts.push({
      id: 'labor-high',
      type: 'warning',
      icon: AlertTriangle,
      title: 'High Labor Cost',
      description: `Labor is ${current.laborPercentage.toFixed(1)}% of revenue. Industry target is 15-20%.`,
      actionLabel: 'Review Staffing',
    });
  }

  // 2. COGS Spike Alert
  if (previous && previous.cogsPercentage > 0) {
    const cogsChange = current.cogsPercentage - previous.cogsPercentage;
    if (cogsChange > 2) {
      alerts.push({
        id: 'cogs-spike',
        type: 'warning',
        icon: Zap,
        title: 'COGS Spike',
        description: `COGS increased by ${cogsChange.toFixed(1)}% vs last month. Check supplier pricing.`,
        actionLabel: 'View Details',
      });
    }
  }

  // 3. Revenue Change Alert
  if (previous && previous.netSales > 0) {
    const revenueChange = ((current.netSales - previous.netSales) / previous.netSales) * 100;
    if (revenueChange < -5) {
      alerts.push({
        id: 'revenue-drop',
        type: 'warning',
        icon: TrendingDown,
        title: 'Revenue Decline',
        description: `Revenue dropped ${Math.abs(revenueChange).toFixed(1)}% from last month.`,
        actionLabel: 'Analyze Trends',
      });
    } else if (revenueChange > 10) {
      alerts.push({
        id: 'revenue-growth',
        type: 'success',
        icon: TrendingUp,
        title: 'Revenue Milestone',
        description: `Revenue grew ${revenueChange.toFixed(1)}% vs last month. Strong performance!`,
        actionLabel: 'Analyze Sources',
      });
    }
  }

  // 4. COGS Stability (positive)
  if (current.cogsPercentage <= 26 && current.cogsPercentage > 0) {
    alerts.push({
      id: 'cogs-stable',
      type: 'info',
      icon: CheckCircle,
      title: 'COGS Stability',
      description: `COGS at ${current.cogsPercentage.toFixed(1)}% - within target range. Supplier contracts performing well.`,
    });
  }

  // 5. Profit Margin Check
  if (current.ebitMargin < 10 && current.ebitMargin > 0) {
    alerts.push({
      id: 'low-margin',
      type: 'critical',
      icon: DollarSign,
      title: 'Low Profit Margin',
      description: `EBIT margin at ${current.ebitMargin.toFixed(1)}%. Review cost structure.`,
      actionLabel: 'Cost Analysis',
    });
  }

  // Sort: critical first, then warning, then success, then info
  const order = { critical: 0, warning: 1, success: 2, info: 3 };
  alerts.sort((a, b) => order[a.type] - order[b.type]);

  return alerts.slice(0, 4); // Max 4 alerts
}

const alertStyles = {
  critical: {
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    iconColor: 'text-red-400',
    titleColor: 'text-red-400',
  },
  warning: {
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/10',
    iconColor: 'text-yellow-400',
    titleColor: 'text-yellow-400',
  },
  success: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    titleColor: 'text-emerald-400',
  },
  info: {
    border: 'border-slate-500/30',
    bg: 'bg-slate-500/10',
    iconColor: 'text-slate-400',
    titleColor: 'text-slate-300',
  },
};

export function PLAlertsPanel({ currentData, previousData, budgetData, className = '' }: PLAlertsPanelProps) {
  const alerts = generateAlerts(currentData, previousData ?? null, budgetData ?? null);
  
  const hasCritical = alerts.some(a => a.type === 'critical');

  return (
    <div className={`rounded-card border border-border bg-card p-4 shadow-card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">Bottom Line Alerts</h3>
        {hasCritical && (
          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-error/20 text-error">
            CRITICAL
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <CheckCircle className="h-8 w-8 mb-2 text-success" />
          <p className="text-sm">All metrics within target</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const style = alertStyles[alert.type];
            const Icon = alert.icon;
            
            return (
              <div 
                key={alert.id}
                className={`rounded-lg border ${style.border} ${style.bg} p-3`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`h-4 w-4 mt-0.5 ${style.iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${style.titleColor}`}>
                      {alert.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {alert.description}
                    </p>
                    {alert.actionLabel && (
                      <button className={`text-xs font-medium mt-2 ${style.iconColor} hover:underline`}>
                        {alert.actionLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="w-full mt-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors">
        View All Notifications
      </button>
    </div>
  );
}
