import { Users, UserCheck, UserX, Clock, TrendingUp, Calendar } from 'lucide-react';

const stats = [
  { label: 'Total Staff', value: '24', icon: Users, color: 'text-info', bg: 'bg-info/20' },
  { label: 'Active Today', value: '16', icon: UserCheck, color: 'text-success', bg: 'bg-success/20' },
  { label: 'On Leave', value: '2', icon: UserX, color: 'text-warning', bg: 'bg-warning/20' },
  { label: 'Avg Hours/Week', value: '38', icon: Clock, color: 'text-purple-400', bg: 'bg-purple-500/20' },
];

const departments = [
  { name: 'Bar', headcount: 8, onDuty: 4, efficiency: 92 },
  { name: 'Floor', headcount: 10, onDuty: 6, efficiency: 88 },
  { name: 'Kitchen', headcount: 4, onDuty: 4, efficiency: 95 },
  { name: 'Host', headcount: 2, onDuty: 2, efficiency: 90 },
];

const recentActivity = [
  { id: '1', staff: 'Minh Tran', action: 'Clocked in', time: '2:00 PM', role: 'Bartender' },
  { id: '2', staff: 'Linh Nguyen', action: 'Started shift', time: '1:45 PM', role: 'Server' },
  { id: '3', staff: 'David Pham', action: 'Clocked out', time: '10:30 AM', role: 'Kitchen' },
  { id: '4', staff: 'Sarah Le', action: 'Break started', time: '1:30 PM', role: 'Host' },
];

export function WorkforceOverview() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Workforce Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time team status and performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-card border border-border bg-card p-4 shadow-card">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${stat.bg}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Departments */}
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Department Status</h2>
          <div className="space-y-4">
            {departments.map((dept) => (
              <div key={dept.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-20">
                    <p className="text-sm font-medium text-foreground">{dept.name}</p>
                    <p className="text-xs text-muted-foreground">{dept.onDuty}/{dept.headcount} on duty</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32">
                    <div className="h-2 rounded-full bg-border">
                      <div
                        className="h-2 rounded-full bg-success"
                        style={{ width: `${(dept.onDuty / dept.headcount) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-success">
                    <TrendingUp className="h-3 w-3" />
                    <span className="text-xs font-medium">{dept.efficiency}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{activity.staff}</p>
                  <p className="text-xs text-muted-foreground">{activity.role} • {activity.action}</p>
                </div>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
            <Calendar className="h-4 w-4" />
            View Full Schedule
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
            <Users className="h-4 w-4" />
            Manage Staff
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
            <TrendingUp className="h-4 w-4" />
            Performance Reports
          </button>
        </div>
      </div>
    </div>
  );
}
