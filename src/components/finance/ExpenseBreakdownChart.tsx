import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { PnlMonthly } from '../../types';
import { EXPENSE_COLORS } from '@/lib/chart-colors';

interface ExpenseBreakdownChartProps {
  data: PnlMonthly | null;
  className?: string;
}

const formatVND = (value: number) => {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B đ`;
  if (value >= 1000000) return `${Math.round(value / 1000000)}M đ`;
  if (value >= 1000) return `${Math.round(value / 1000)}K đ`;
  return `${value.toLocaleString()} đ`;
};

export function ExpenseBreakdownChart({ data, className = '' }: ExpenseBreakdownChartProps) {
  if (!data) {
    return (
      <div className={`rounded-card border border-border bg-card p-4 shadow-card ${className}`}>
        <h3 className="text-sm font-medium text-foreground mb-4">Expense Breakdown</h3>
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          No data available
        </div>
      </div>
    );
  }

  const laborCost = data.laborCost || 0;
  const cogsCost = data.cogs || 0;
  const fixedCost = (data.fixedCosts || 0) + (data.opex || 0);
  
  const totalCosts = laborCost + cogsCost + fixedCost;
  
  // If no specific breakdown, use totalExpenses
  const hasBreakdown = totalCosts > 0;
  const displayTotal = hasBreakdown ? totalCosts : data.totalExpenses;

  const chartData = hasBreakdown ? [
    { name: 'Labor', value: laborCost, color: EXPENSE_COLORS.labor },
    { name: 'COGS', value: cogsCost, color: EXPENSE_COLORS.cogs },
    { name: 'Fixed', value: fixedCost, color: EXPENSE_COLORS.fixed },
  ].filter(d => d.value > 0) : [
    { name: 'Total', value: data.totalExpenses, color: EXPENSE_COLORS.cogs },
  ];

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
      <h3 className="text-sm font-medium text-foreground mb-2">Expense Breakdown</h3>
      
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
          <span className="text-xs text-muted-foreground">COSTS</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <div 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-muted-foreground uppercase">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
