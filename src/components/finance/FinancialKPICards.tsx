import type { PnlMonthly } from '../../types';
import { StatCard } from '@/components/ui/stat-card';

interface FinancialKPICardsProps {
  actualData: PnlMonthly | null;
  budgetData?: PnlMonthly | null;
  className?: string;
}

const formatVND = (value: number) => {
  const absValue = Math.abs(value);
  if (absValue >= 1000000000) return `${(value / 1000000000).toFixed(1)}B đ`;
  if (absValue >= 1000000) return `${(value / 1000000).toFixed(0)}M đ`;
  if (absValue >= 1000) return `${(value / 1000).toFixed(0)}K đ`;
  return `${value.toLocaleString()} đ`;
};

export function FinancialKPICards({ actualData, budgetData, className = '' }: FinancialKPICardsProps) {
  if (!actualData) {
    return (
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-card border border-border bg-card p-4 shadow-card animate-pulse">
            <div className="h-4 bg-muted rounded w-20 mb-2" />
            <div className="h-8 bg-muted rounded w-28" />
          </div>
        ))}
      </div>
    );
  }

  // Calculate KPIs
  const totalRevenue = actualData.grossSales || actualData.netSales;
  const budgetRevenue = budgetData?.grossSales || budgetData?.budgetGrossSales || budgetData?.netSales || budgetData?.budgetNetSales || 0;
  const revenueVariance = budgetRevenue > 0 ? ((totalRevenue - budgetRevenue) / budgetRevenue) * 100 : 0;

  // Gross Margin = (Revenue - COGS) / Revenue × 100
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - actualData.cogs) / totalRevenue) * 100 : 0;
  const budgetGrossMargin = budgetRevenue > 0 && budgetData?.cogs 
    ? ((budgetRevenue - (budgetData.cogs || budgetData.budgetCogs || 0)) / budgetRevenue) * 100 
    : 0;
  const grossMarginVariance = budgetGrossMargin > 0 ? grossMargin - budgetGrossMargin : 0;

  // EBIT % = EBIT / Revenue × 100
  const ebitPercent = totalRevenue > 0 ? (actualData.ebit / totalRevenue) * 100 : 0;
  const budgetEbitPercent = budgetRevenue > 0 && budgetData?.ebit 
    ? (budgetData.ebit / budgetRevenue) * 100 
    : 0;
  const ebitVariance = budgetEbitPercent !== 0 ? ebitPercent - budgetEbitPercent : 0;

  // Net Income (EBIT)
  const netIncome = actualData.ebit;
  const budgetNetIncome = budgetData?.ebit || 0;
  const netIncomeVariance = budgetNetIncome !== 0 ? ((netIncome - budgetNetIncome) / Math.abs(budgetNetIncome)) * 100 : 0;

  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      <StatCard
        label="Total Revenue"
        value={formatVND(totalRevenue)}
        trend={parseFloat(revenueVariance.toFixed(1))}
        subtitle="vs Budget"
      />
      
      <StatCard
        label="Gross Margin"
        value={`${grossMargin.toFixed(1)}%`}
        trend={parseFloat(grossMarginVariance.toFixed(1))}
        subtitle="vs Goal"
      />
      
      <StatCard
        label="EBIT %"
        value={`${ebitPercent.toFixed(1)}%`}
        trend={parseFloat(ebitVariance.toFixed(1))}
        subtitle="vs Target"
      />
      
      <StatCard
        label="Net Income"
        value={formatVND(netIncome)}
        trend={parseFloat(netIncomeVariance.toFixed(1))}
        subtitle="vs Budget"
      />
    </div>
  );
}
