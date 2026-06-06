import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { PnlMonthly } from '../../types';

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

function trendColor(v: number) {
  if (v > 0) return 'text-success';
  if (v < 0) return 'text-error';
  return 'text-muted-foreground';
}

function TrendPill({ trend, subtitle }: { trend: number; subtitle: string }) {
  const Icon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const cls = trendColor(trend);
  const sign = trend > 0 ? '+' : '';
  return (
    <div className={`flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="tabular-nums whitespace-nowrap">{sign}{trend.toFixed(1)}%</span>
      <span className="text-muted-foreground font-normal">{subtitle}</span>
    </div>
  );
}

export function FinancialKPICards({ actualData, budgetData, className = '' }: FinancialKPICardsProps) {
  if (!actualData) {
    return (
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-card border border-border bg-card p-3 shadow-card animate-pulse">
            <div className="h-3 bg-muted rounded w-16 mb-2" />
            <div className="h-6 bg-muted rounded w-20" />
          </div>
        ))}
      </div>
    );
  }

  const totalRevenue = actualData.grossSales || actualData.netSales;
  const budgetRevenue = budgetData?.grossSales || budgetData?.budgetGrossSales || budgetData?.netSales || budgetData?.budgetNetSales || 0;
  const revenueVariance = budgetRevenue > 0 ? ((totalRevenue - budgetRevenue) / budgetRevenue) * 100 : 0;

  const grossMargin = totalRevenue > 0 ? ((totalRevenue - actualData.cogs) / totalRevenue) * 100 : 0;
  const budgetGrossMargin = budgetRevenue > 0 && budgetData?.cogs
    ? ((budgetRevenue - (budgetData.cogs || budgetData.budgetCogs || 0)) / budgetRevenue) * 100 : 0;
  const grossMarginVariance = budgetGrossMargin > 0 ? grossMargin - budgetGrossMargin : 0;

  const ebitPercent = totalRevenue > 0 ? (actualData.ebit / totalRevenue) * 100 : 0;
  const budgetEbitPercent = budgetRevenue > 0 && budgetData?.ebit ? (budgetData.ebit / budgetRevenue) * 100 : 0;
  const ebitVariance = budgetEbitPercent !== 0 ? ebitPercent - budgetEbitPercent : 0;

  const netIncome = actualData.ebit;
  const budgetNetIncome = budgetData?.ebit || 0;
  const netIncomeVariance = budgetNetIncome !== 0 ? ((netIncome - budgetNetIncome) / Math.abs(budgetNetIncome)) * 100 : 0;

  const tiles = [
    { label: 'Total Revenue', value: formatVND(totalRevenue), trend: parseFloat(revenueVariance.toFixed(1)), subtitle: 'vs Budget' },
    { label: 'Gross Margin', value: `${grossMargin.toFixed(1)}%`, trend: parseFloat(grossMarginVariance.toFixed(1)), subtitle: 'vs Goal' },
    { label: 'EBIT %', value: `${ebitPercent.toFixed(1)}%`, trend: parseFloat(ebitVariance.toFixed(1)), subtitle: 'vs Target' },
    { label: 'Net Income', value: formatVND(netIncome), trend: parseFloat(netIncomeVariance.toFixed(1)), subtitle: 'vs Budget' },
  ];

  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
      {tiles.map((t) => (
        <div key={t.label} className="rounded-card border border-border bg-card px-3 py-2.5 shadow-card sm:p-4">
          <div className="text-[11px] font-medium text-muted-foreground mb-1 truncate">{t.label}</div>
          <div className="text-lg font-bold text-foreground tabular-nums whitespace-nowrap sm:text-2xl">{t.value}</div>
          <TrendPill trend={t.trend} subtitle={t.subtitle} />
        </div>
      ))}
    </div>
  );
}
