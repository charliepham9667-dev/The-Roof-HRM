import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { PnlMonthly } from '../../types';
import { REVENUE_COLORS } from '@/lib/chart-colors';

interface RevenueMixChartProps {
  data: PnlMonthly | null;
  className?: string;
}

const formatVND = (value: number) => {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B đ`;
  if (value >= 1000000) return `${Math.round(value / 1000000)}M đ`;
  if (value >= 1000) return `${Math.round(value / 1000)}K đ`;
  return `${value.toLocaleString()} đ`;
};

type ActiveSlice = { name: string; value: number; pct: string; color: string } | null

export function RevenueMixChart({ data, className = '' }: RevenueMixChartProps) {
  const [active, setActive] = useState<ActiveSlice>(null)

  if (!data) {
    return (
      <div className={`rounded-card border border-border bg-card p-4 shadow-card ${className}`}>
        <h3 className="text-sm font-medium text-foreground mb-4">Revenue Mix</h3>
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          No data available
        </div>
      </div>
    );
  }

  const revenueBreakdown = [
    { name: 'Shisha',    value: data.revenueShisha    || 0, color: REVENUE_COLORS.shisha },
    { name: 'Cocktails', value: data.revenueCocktails || 0, color: REVENUE_COLORS.cocktails },
    { name: 'Spirits',   value: data.revenueSpirits   || 0, color: REVENUE_COLORS.spirits },
    { name: 'Food',      value: data.revenueFood      || 0, color: REVENUE_COLORS.food },
    { name: 'Beer',      value: data.revenueBeer      || 0, color: REVENUE_COLORS.beer },
    { name: 'Balloons',  value: data.revenueBalloons  || 0, color: REVENUE_COLORS.balloons },
    { name: 'Other',     value: data.revenueOther     || 0, color: REVENUE_COLORS.other },
    { name: 'Wine',      value: data.revenueWine      || 0, color: REVENUE_COLORS.wine },
  ];

  const totalRevenue = revenueBreakdown.reduce((s, i) => s + i.value, 0)
  const hasBreakdown = totalRevenue > 0
  const displayTotal = hasBreakdown ? totalRevenue : data.grossSales

  const chartData = hasBreakdown
    ? revenueBreakdown.filter(d => d.value > 0).sort((a, b) => b.value - a.value)
    : [{ name: 'Total', value: data.grossSales, color: REVENUE_COLORS.spirits }]

  function handleEnter(_: any, index: number) {
    const item = chartData[index]
    const pct = displayTotal > 0 ? ((item.value / displayTotal) * 100).toFixed(1) : '0'
    setActive({ name: item.name, value: item.value, pct, color: item.color })
  }

  return (
    <div className={`rounded-card border border-border bg-card p-4 shadow-card ${className}`}>
      <h3 className="text-sm font-medium text-foreground mb-2">Revenue Mix</h3>

      {/* Hover info — fixed height so chart doesn't shift */}
      <div className="h-8 flex items-center justify-center mb-1">
        {active ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-1 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: active.color }} />
            <span className="text-[12px] font-semibold text-foreground">{active.name}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{formatVND(active.value)}</span>
            <span className="text-[11px] font-medium text-foreground">{active.pct}%</span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">Hover a slice to inspect</span>
        )}
      </div>

      <div className="relative h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
              onMouseEnter={handleEnter}
              onMouseLeave={() => setActive(null)}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  opacity={active && active.name !== entry.name ? 0.45 : 1}
                  style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {active ? (
            <>
              <span className="whitespace-nowrap text-sm font-bold tabular-nums text-foreground">{active.pct}%</span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[70px] text-center">{active.name}</span>
            </>
          ) : (
            <>
              <span className="whitespace-nowrap text-base font-bold tabular-nums text-foreground sm:text-xl">{formatVND(displayTotal)}</span>
              <span className="text-xs text-muted-foreground">TOTAL</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
