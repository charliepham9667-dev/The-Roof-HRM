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
  
  // SVG parameters for the circular gauge
  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate stroke dash for the progress
  // Map 0-100% margin to 0-100% of the circle, capped at 100
  const cappedMargin = Math.min(Math.max(margin, 0), 100);
  const progressOffset = circumference - (cappedMargin / 100) * circumference;

  return (
    <div className={`rounded-card border border-border bg-card p-4 shadow-card ${className}`}>
      <h3 className="text-sm font-medium text-foreground mb-2">Net Profit Margin</h3>
      
      <div className="flex flex-col items-center">
        {/* Circular gauge */}
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#374151"
              strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={status.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={progressOffset}
              style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
            />
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-foreground">{margin.toFixed(0)}%</span>
            <span 
              className={`text-xs font-semibold px-2 py-0.5 rounded ${status.bgColor}`}
              style={{ color: status.color }}
            >
              {status.label}
            </span>
          </div>
        </div>

        {/* Change indicator */}
        {marginChange !== null && (
          <div className={`flex items-center gap-1 mt-3 text-sm ${
            marginChange >= 0 ? 'text-success' : 'text-error'
          }`}>
            {marginChange >= 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>{marginChange >= 0 ? '+' : ''}{marginChange.toFixed(1)}%</span>
            <span className="text-muted-foreground text-xs">VS LAST MONTH</span>
          </div>
        )}
      </div>
    </div>
  );
}
