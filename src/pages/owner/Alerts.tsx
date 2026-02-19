import { AlertTriangle, AlertCircle, Clock, TrendingDown, CheckCircle } from 'lucide-react';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'staffing' | 'compliance' | 'performance' | 'inventory';
  title: string;
  description: string;
  timestamp: string;
  actionLabel?: string;
}

const alerts: Alert[] = [
  {
    id: '1',
    type: 'critical',
    category: 'staffing',
    title: 'Server shortage for tonight',
    description: '1 server called in sick. PM shift is understaffed by 1 person.',
    timestamp: '2 hours ago',
    actionLabel: 'Find Coverage',
  },
  {
    id: '2',
    type: 'warning',
    category: 'compliance',
    title: 'Liquor license expires in 14 days',
    description: 'Renewal application needs to be submitted to avoid service interruption.',
    timestamp: '1 day ago',
    actionLabel: 'Start Renewal',
  },
  {
    id: '3',
    type: 'warning',
    category: 'performance',
    title: 'Labor cost trending above target',
    description: 'Current week labor cost is at 32% vs 30% target.',
    timestamp: '3 hours ago',
    actionLabel: 'View Details',
  },
  {
    id: '4',
    type: 'info',
    category: 'inventory',
    title: 'Low stock alert: Premium vodka',
    description: 'Grey Goose inventory below reorder point. 3 bottles remaining.',
    timestamp: '5 hours ago',
    actionLabel: 'Reorder',
  },
];

const bottlenecks = [
  {
    id: '1',
    area: 'Bar Service',
    issue: 'Average wait time 8 mins (target: 5 mins)',
    impact: 'high',
    suggestion: 'Add 1 bartender during peak hours (9-11 PM)',
  },
  {
    id: '2',
    area: 'Kitchen',
    issue: 'Food order completion 22 mins (target: 15 mins)',
    impact: 'medium',
    suggestion: 'Review prep workflow for appetizers',
  },
  {
    id: '3',
    area: 'Host Stand',
    issue: 'Guest seating delay during peak',
    impact: 'low',
    suggestion: 'Implement reservation staggering',
  },
];

const typeConfig = {
  critical: {
    icon: AlertCircle,
    bg: 'bg-error/10',
    border: 'border-error/30',
    iconColor: 'text-error',
    badge: 'bg-error',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    iconColor: 'text-warning',
    badge: 'bg-warning',
  },
  info: {
    icon: Clock,
    bg: 'bg-info/10',
    border: 'border-info/30',
    iconColor: 'text-info',
    badge: 'bg-info',
  },
};

const impactColors = {
  high: 'text-error',
  medium: 'text-warning',
  low: 'text-success',
};

export function Alerts() {
  const criticalCount = alerts.filter(a => a.type === 'critical').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Alerts & Bottlenecks</h1>
        <p className="text-sm text-muted-foreground mt-1">Issues requiring your attention</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-card border border-error/30 bg-error/10 p-4 shadow-card">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-error" />
            <span className="text-sm text-muted-foreground">Critical</span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{criticalCount}</p>
        </div>
        <div className="rounded-card border border-warning/30 bg-warning/10 p-4 shadow-card">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <span className="text-sm text-muted-foreground">Warnings</span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{warningCount}</p>
        </div>
        <div className="rounded-card border border-success/30 bg-success/10 p-4 shadow-card">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            <span className="text-sm text-muted-foreground">Resolved Today</span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">5</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Bottlenecks</span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{bottlenecks.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Alerts */}
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Active Alerts</h2>
          <div className="space-y-3">
            {alerts.map((alert) => {
              const config = typeConfig[alert.type];
              const Icon = config.icon;
              return (
                <div
                  key={alert.id}
                  className={`rounded-lg border p-4 ${config.bg} ${config.border}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 mt-0.5 ${config.iconColor}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-foreground">{alert.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium text-primary-foreground ${config.badge}`}>
                          {alert.type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{alert.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{alert.timestamp}</span>
                        {alert.actionLabel && (
                          <button className="text-xs font-medium text-primary hover:underline">
                            {alert.actionLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottlenecks */}
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Operational Bottlenecks</h2>
          <div className="space-y-4">
            {bottlenecks.map((item) => (
              <div key={item.id} className="rounded-lg bg-background p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{item.area}</span>
                  <span className={`text-xs font-medium capitalize ${impactColors[item.impact as keyof typeof impactColors]}`}>
                    {item.impact} impact
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{item.issue}</p>
                <div className="flex items-center gap-2 text-xs text-success">
                  <CheckCircle className="h-3 w-3" />
                  <span>{item.suggestion}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
