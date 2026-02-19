import { useState } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { PnlMonthly } from '../../types';

interface ProfitabilityTrendChartProps {
  months: PnlMonthly[];
  selectedMonth?: number | 'latest';
  className?: string;
}

const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

type TimeRange = '12M' | '6M' | 'YTD';

const formatVND = (value: number) => {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B đ`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M đ`;
  if (value >= 1000) return `${Math.round(value / 1000)}K đ`;
  return `${value.toLocaleString()} đ`;
};

const formatShort = (value: number) => {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `${Math.round(value / 1000000)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return value.toString();
};

export function ProfitabilityTrendChart({ months, selectedMonth = 'latest', className = '' }: ProfitabilityTrendChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('12M');
  
  // Determine the target month based on filter selection
  const targetMonth = selectedMonth === 'latest' 
    ? (months.length > 0 ? Math.max(...months.map(m => m.month)) : new Date().getMonth() + 1)
    : selectedMonth;
  
  // Filter months based on time range and selected month
  const filteredMonths = months.filter(m => {
    // First, filter to only include months up to the selected month
    if (m.month > targetMonth) return false;
    
    // Then apply time range filter
    if (timeRange === 'YTD') return m.month <= targetMonth;
    if (timeRange === '6M') {
      const sixMonthsAgo = targetMonth - 6;
      if (sixMonthsAgo > 0) return m.month > sixMonthsAgo && m.month <= targetMonth;
      // Handle year wrap - show from start of year if within 6 months
      return m.month <= targetMonth;
    }
    return true; // 12M shows all months up to selected
  });

  // Prepare chart data - use EBIT (Net Income) instead of Gross Profit
  // Split positive/negative for dual-color fills, keep profit for single line
  const chartData = filteredMonths.map(m => ({
    month: MONTH_LABELS[m.month - 1],
    profit: m.ebit,  // Use EBIT for Net Income (for the line)
    profitPositive: m.ebit >= 0 ? m.ebit : 0,  // For green fill above 0
    profitNegative: m.ebit < 0 ? m.ebit : 0,   // For red fill below 0
    ebit: m.ebit,
    revenue: m.netSales,
  }));

  // Calculate totals and growth using EBIT
  const totalProfit = filteredMonths.reduce((sum, m) => sum + m.ebit, 0);
  
  // Calculate growth (compare first half to second half of period)
  let growth = 0;
  if (filteredMonths.length >= 2) {
    const midPoint = Math.floor(filteredMonths.length / 2);
    const firstHalf = filteredMonths.slice(0, midPoint).reduce((sum, m) => sum + m.ebit, 0) / midPoint;
    const secondHalf = filteredMonths.slice(midPoint).reduce((sum, m) => sum + m.ebit, 0) / (filteredMonths.length - midPoint);
    if (firstHalf > 0) {
      growth = ((secondHalf - firstHalf) / firstHalf) * 100;
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Get the actual profit value from payload (use profit field from original data)
      const dataPoint = payload[0]?.payload;
      const value = dataPoint?.profit ?? 0;
      return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-foreground text-sm font-medium">{label}</p>
          <p className={`text-sm ${value >= 0 ? 'text-success' : 'text-error'}`}>
            Net Income: {formatVND(value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`rounded-card border border-border bg-card p-4 shadow-card ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Profitability Trend ({timeRange === 'YTD' ? 'Year to Date' : timeRange === '6M' ? '6 Months' : '12 Months'})
          </h3>
          <div className="mt-2">
            <span className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-success' : 'text-error'}`}>
              {formatVND(totalProfit)}
            </span>
            <span className="text-sm text-muted-foreground ml-2">Net Income (EBIT)</span>
          </div>
          {growth !== 0 && (
            <div className={`flex items-center gap-1 mt-1 text-sm ${
              growth >= 0 ? 'text-success' : 'text-error'
            }`}>
              {growth >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>~{Math.abs(growth).toFixed(1)}% Growth over prior period</span>
            </div>
          )}
        </div>

        {/* Time range toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['12M', '6M', 'YTD'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                timeRange === range
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {/* Green gradient for profitable periods (above 0) */}
                <linearGradient id="profitPositiveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.05} />
                </linearGradient>
                {/* Red gradient for non-profitable periods (below 0) */}
                <linearGradient id="profitNegativeGradient" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B7280', fontSize: 11 }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B7280', fontSize: 11 }}
                tickFormatter={formatShort}
                width={50}
              />
              {/* Zero reference line to mark profitability threshold */}
              <ReferenceLine 
                y={0} 
                stroke="#6B7280" 
                strokeDasharray="4 4" 
                strokeOpacity={0.6}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Green fill for profitable values (above 0) */}
              <Area
                type="monotone"
                dataKey="profitPositive"
                stroke="none"
                fill="url(#profitPositiveGradient)"
                baseValue={0}
              />
              {/* Red fill for non-profitable values (below 0) */}
              <Area
                type="monotone"
                dataKey="profitNegative"
                stroke="none"
                fill="url(#profitNegativeGradient)"
                baseValue={0}
              />
              {/* Single continuous line on top */}
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#94A3B8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#fff', stroke: '#94A3B8', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          No data available for selected period
        </div>
      )}
    </div>
  );
}
