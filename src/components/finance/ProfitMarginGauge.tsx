import { TrendingUp, TrendingDown } from 'lucide-react';
import type { PnlMonthly } from '../../types';

interface ProfitMarginGaugeProps {
  data: PnlMonthly | null;
  previousData?: PnlMonthly | null;
  className?: string;
}

// Determine health status based on margin
function getHealthStatus(margin: number): { label: string; color: string; bgColor: string } {
  if (margin >= 25) return { label: 'HEALTHY', color: '#22C55E', bgColor: 'bg-success/10' };
  if (margin >= 15) return { label: 'WARNING', color: '#EAB308', bgColor: 'bg-warning/10' };
  return { label: 'CRITICAL', color: '#EF4444', bgColor: 'bg-error/10' };
}

export function ProfitMarginGauge({ data, previousData, className = '' }: ProfitMarginGaugeProps) {
  if (!data) {
    return (
      <div className={`rounded-card border border-border bg-card p-4 shadow-card ${className}`}>
        <h3 className="text-sm font-medium text-foreground mb-4">Net Profit Margin</h3>
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          No data available
        </div>
      </div>
    );
  }

  // Calculate net profit margin = EBIT / Gross Sales (or Net Sales if Gross not available)
  const sales = data.grossSales > 0 ? data.grossSales : data.netSales;
  const margin = sales > 0 ? (data.ebit / sales) * 100 : (data.ebitMargin || data.grossMargin || 0);
  
  const previousSales = previousData ? (previousData.grossSales > 0 ? previousData.grossSales : previousData.netSales) : 0;
  const previousMargin = previousSales > 0 && previousData ? 
    (previousData.ebit / previousSales) * 100 : 
    (previousData?.ebitMargin || previousData?.grossMargin || 0);
  const marginChange = previousMargin !== 0 ? margin - previousMargin : null;
  
  const status = getHealthStatus(margin);
  
  // SVG parameters — use viewBox so it scales to the container
  const vbSize = 160;
  const strokeWidth = 12;
  const radius = (vbSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cappedMargin = Math.min(Math.max(margin, 0), 100);
  const progressOffset = circumference - (cappedMargin / 100) * circumference;

  return (
    <div className={`rounded-card border border-border bg-card p-3 shadow-card overflow-hidden ${className}`}>
      <h3 className="text-sm font-medium text-foreground mb-2">Net Profit Margin</h3>
      
      <div className="flex flex-col items-center">
        {/* Responsive circular gauge */}
        <div className="relative w-full max-w-[140px]" style={{ aspectRatio: '1' }}>
          <svg
            viewBox={`0 0 ${vbSize} ${vbSize}`}
            className="w-full h-full transform -rotate-90"
          >
            <circle cx={vbSize / 2} cy={vbSize / 2} r={radius} fill="none" stroke="#374151" strokeWidth={strokeWidth} />
            <circle
              cx={vbSize / 2} cy={vbSize / 2} r={radius} fill="none"
              stroke={status.color} strokeWidth={strokeWidth} strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={progressOffset}
              style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
            />
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground leading-none">{margin.toFixed(0)}%</span>
            <span
              className={`mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${status.bgColor}`}
              style={{ color: status.color }}
            >
              {status.label}
            </span>
          </div>
        </div>

        {/* Change indicator */}
        {marginChange !== null && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${
            marginChange >= 0 ? 'text-success' : 'text-error'
          }`}>
            {marginChange >= 0 ? <TrendingUp className="h-3 w-3 shrink-0" /> : <TrendingDown className="h-3 w-3 shrink-0" />}
            <span className="tabular-nums">{marginChange >= 0 ? '+' : ''}{marginChange.toFixed(1)}%</span>
            <span className="text-muted-foreground uppercase tracking-wider">vs last month</span>
          </div>
        )}
      </div>
    </div>
  );
}
