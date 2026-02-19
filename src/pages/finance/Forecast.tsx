import { TrendingUp, Calendar, Target, AlertCircle, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BAR_COLORS, CHART_COLORS } from '@/lib/chart-colors';

const forecastData = [
  { month: 'Jan', actual: 794, forecast: 780, target: 750 },
  { month: 'Feb', actual: null, forecast: 820, target: 780 },
  { month: 'Mar', actual: null, forecast: 850, target: 800 },
  { month: 'Apr', actual: null, forecast: 900, target: 850 },
  { month: 'May', actual: null, forecast: 950, target: 900 },
  { month: 'Jun', actual: null, forecast: 980, target: 920 },
];

const formatVND = (value: number) => {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B đ`;
  if (value >= 1000000) return `${Math.round(value / 1000000)}M đ`;
  return `${value.toLocaleString()} đ`;
};

const scenarios = [
  {
    id: 'optimistic',
    name: 'Optimistic',
    description: 'Strong weekend traffic, successful events',
    q1Revenue: 2464000000,
    growth: 18,
    probability: 25,
  },
  {
    id: 'baseline',
    name: 'Baseline',
    description: 'Current trends continue',
    q1Revenue: 2270000000,
    growth: 12,
    probability: 50,
  },
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'Slower growth, market headwinds',
    q1Revenue: 2100000000,
    growth: 6,
    probability: 25,
  },
];

const keyDrivers = [
  { name: 'Weekend Traffic', impact: '+15%', trend: 'up' },
  { name: 'Event Bookings', impact: '+8%', trend: 'up' },
  { name: 'Avg Spend', impact: '+5%', trend: 'up' },
  { name: 'Seasonal Dip (Feb)', impact: '-3%', trend: 'down' },
];

export function Forecast() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Revenue Forecast</h1>
        <p className="text-sm text-muted-foreground mt-1">Q1 2026 Projections</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-card border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Calendar className="h-4 w-4" />
            <span className="text-xs">Jan Actual</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatVND(794000000)}</p>
          <p className="text-xs text-success mt-1">+12% vs forecast</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Feb Forecast</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatVND(820000000)}</p>
          <p className="text-xs text-muted-foreground mt-1">+3.3% MoM</p>
        </div>
        <div className="rounded-card border border-success/30 bg-success/10 p-4 shadow-card">
          <div className="flex items-center gap-2 text-success mb-2">
            <Target className="h-4 w-4" />
            <span className="text-xs">Q1 Forecast</span>
          </div>
          <p className="text-xl font-bold text-success">{formatVND(2464000000)}</p>
          <p className="text-xs text-success mt-1">On track to exceed</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">YoY Growth</span>
          </div>
          <p className="text-xl font-bold text-foreground">+15%</p>
          <p className="text-xs text-muted-foreground mt-1">Projected annual</p>
        </div>
      </div>

      {/* Forecast Chart - Keep chart colors as hex for Recharts */}
      <div className="rounded-card border border-border bg-card p-6 shadow-card">
        <h2 className="text-lg font-semibold text-foreground mb-4">6-Month Revenue Projection</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="month" stroke={CHART_COLORS.axis} fontSize={12} />
              <YAxis stroke={CHART_COLORS.axis} fontSize={12} tickFormatter={(v) => `${v}M`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: CHART_COLORS.tooltip.bg,
                  border: `1px solid ${CHART_COLORS.tooltip.border}`,
                  borderRadius: '8px',
                }}
                labelStyle={{ color: CHART_COLORS.tooltip.text }}
                formatter={(value: number) => [`${value}M đ`, '']}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="actual"
                stroke={BAR_COLORS.current}
                strokeWidth={3}
                dot={{ fill: BAR_COLORS.current, r: 6 }}
                name="Actual"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke={BAR_COLORS.previous}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: BAR_COLORS.previous, r: 4 }}
                name="Forecast"
              />
              <Line
                type="monotone"
                dataKey="target"
                stroke={BAR_COLORS.target}
                strokeWidth={2}
                dot={false}
                name="Target"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scenarios */}
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Forecast Scenarios</h2>
          <div className="space-y-3">
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                className={`rounded-lg border p-4 ${
                  scenario.id === 'baseline' ? 'border-primary bg-primary/10' : 'border-border bg-background'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{scenario.name}</span>
                  <span className="text-xs text-muted-foreground">{scenario.probability}% probability</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{scenario.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-foreground">{formatVND(scenario.q1Revenue)}</span>
                  <span className="text-sm text-success">+{scenario.growth}% YoY</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Drivers */}
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Key Drivers</h2>
          <div className="space-y-3">
            {keyDrivers.map((driver) => (
              <div key={driver.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${driver.trend === 'up' ? 'bg-success/20' : 'bg-error/20'}`}>
                    {driver.trend === 'up' ? (
                      <TrendingUp className="h-4 w-4 text-success" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-error" />
                    )}
                  </div>
                  <span className="text-sm text-foreground">{driver.name}</span>
                </div>
                <span className={`text-sm font-medium ${driver.trend === 'up' ? 'text-success' : 'text-error'}`}>
                  {driver.impact}
                </span>
              </div>
            ))}
          </div>
          
          <div className="mt-4 rounded-lg bg-background p-4">
            <div className="flex items-center gap-2 text-primary text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Recommendation</span>
            </div>
            <p className="text-xs text-foreground mt-2">
              Focus on weekend event bookings to capitalize on strong traffic trends. Consider promotional campaigns for slower weekday evenings.
            </p>
            <button className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline">
              View Action Plan <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
