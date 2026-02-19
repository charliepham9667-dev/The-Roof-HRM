import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
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

export function RevenueMixChart({ data, className = '' }: RevenueMixChartProps) {
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

  // Calculate revenue by individual category
  const revenueBreakdown = [
    { name: 'Shisha', value: data.revenueShisha || 0, color: REVENUE_COLORS.shisha },
    { name: 'Cocktails', value: data.revenueCocktails || 0, color: REVENUE_COLORS.cocktails },
    { name: 'Spirits', value: data.revenueSpirits || 0, color: REVENUE_COLORS.spirits },
    { name: 'Food', value: data.revenueFood || 0, color: REVENUE_COLORS.food },
    { name: 'Beer', value: data.revenueBeer || 0, color: REVENUE_COLORS.beer },
    { name: 'Balloons', value: data.revenueBalloons || 0, color: REVENUE_COLORS.balloons },
    { name: 'Other', value: data.revenueOther || 0, color: REVENUE_COLORS.other },
    { name: 'Wine', value: data.revenueWine || 0, color: REVENUE_COLORS.wine },
  ];
  
  const totalRevenue = revenueBreakdown.reduce((sum, item) => sum + item.value, 0);
  
  // If no breakdown data, fall back to gross sales
  const hasBreakdown = totalRevenue > 0;
  const displayTotal = hasBreakdown ? totalRevenue : data.grossSales;

  // Sort by value descending and filter out zeros
  const chartData = hasBreakdown 
    ? revenueBreakdown.filter(d => d.value > 0).sort((a, b) => b.value - a.value)
    : [{ name: 'Total', value: data.grossSales, color: REVENUE_COLORS.spirits }];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percentage = displayTotal > 0 ? ((item.value / displayTotal) * 100).toFixed(1) : '0';
      return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-foreground text-sm font-medium">{item.name}</p>
          <p className="text-muted-foreground text-sm">{formatVND(item.value)}</p>
          <p className="text-muted-foreground text-xs">{percentage}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`rounded-card border border-border bg-card p-4 shadow-card ${className}`}>
      <h3 className="text-sm font-medium text-foreground mb-2">Revenue Mix</h3>
      
      <div className="relative h-[180px]">
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
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-foreground">{formatVND(displayTotal)}</span>
          <span className="text-xs text-muted-foreground">TOTAL</span>
        </div>
      </div>

      {/* Legend - compact grid for 8 categories */}
      <div className="grid grid-cols-4 gap-x-2 gap-y-1 mt-2">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[10px] text-muted-foreground truncate">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
