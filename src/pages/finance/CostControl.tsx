import { useState } from 'react';
import { Calculator, TrendingDown, TrendingUp, AlertTriangle, CheckCircle, Target } from 'lucide-react';

interface CostCategory {
  id: string;
  name: string;
  actual: number;
  budget: number;
  percentage: number;
  status: 'under' | 'on-track' | 'over';
}

const costCategories: CostCategory[] = [
  { id: '1', name: 'Food Cost', actual: 238000000, budget: 250000000, percentage: 30, status: 'under' },
  { id: '2', name: 'Beverage Cost', actual: 120000000, budget: 115000000, percentage: 15, status: 'over' },
  { id: '3', name: 'Labor Cost', actual: 186000000, budget: 180000000, percentage: 23, status: 'over' },
  { id: '4', name: 'Rent & Utilities', actual: 95000000, budget: 95000000, percentage: 12, status: 'on-track' },
  { id: '5', name: 'Marketing', actual: 42000000, budget: 50000000, percentage: 5, status: 'under' },
  { id: '6', name: 'Operating Supplies', actual: 35000000, budget: 40000000, percentage: 4, status: 'under' },
  { id: '7', name: 'Maintenance', actual: 28000000, budget: 25000000, percentage: 3, status: 'over' },
  { id: '8', name: 'Other', actual: 50000000, budget: 55000000, percentage: 6, status: 'under' },
];

const formatVND = (value: number) => {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B đ`;
  if (value >= 1000000) return `${Math.round(value / 1000000)}M đ`;
  return `${value.toLocaleString()} đ`;
};

const statusConfig = {
  under: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/20', label: 'Under Budget' },
  'on-track': { icon: Target, color: 'text-info', bg: 'bg-info/20', label: 'On Track' },
  over: { icon: AlertTriangle, color: 'text-error', bg: 'bg-error/20', label: 'Over Budget' },
};

const costSavingTips = [
  { id: '1', tip: 'Negotiate bulk pricing with Heineken for 5% discount', savings: '6M đ/month' },
  { id: '2', tip: 'Optimize staff scheduling during slow hours', savings: '8M đ/month' },
  { id: '3', tip: 'Switch to LED lighting throughout venue', savings: '2M đ/month' },
  { id: '4', tip: 'Review portion sizes for appetizers', savings: '4M đ/month' },
];

export function CostControl() {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  
  const totalActual = costCategories.reduce((sum, c) => sum + c.actual, 0);
  const totalBudget = costCategories.reduce((sum, c) => sum + c.budget, 0);
  const variance = totalBudget - totalActual;
  const overBudgetCount = costCategories.filter(c => c.status === 'over').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Cost Control</h1>
          <p className="text-sm text-muted-foreground mt-1">Budget tracking and optimization</p>
        </div>
        <div className="flex gap-2">
          {['week', 'month', 'quarter'].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                selectedPeriod === period
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-card border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Calculator className="h-4 w-4" />
            <span className="text-xs">Total Costs</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatVND(totalActual)}</p>
          <p className="text-xs text-muted-foreground mt-1">Budget: {formatVND(totalBudget)}</p>
        </div>
        <div className={`rounded-card border p-4 shadow-card ${variance >= 0 ? 'border-success/30 bg-success/10' : 'border-error/30 bg-error/10'}`}>
          <div className={`flex items-center gap-2 mb-2 ${variance >= 0 ? 'text-success' : 'text-error'}`}>
            {variance >= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            <span className="text-xs">Variance</span>
          </div>
          <p className={`text-xl font-bold ${variance >= 0 ? 'text-success' : 'text-error'}`}>
            {variance >= 0 ? '+' : ''}{formatVND(variance)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{variance >= 0 ? 'Under budget' : 'Over budget'}</p>
        </div>
        <div className="rounded-card border border-error/30 bg-error/10 p-4 shadow-card">
          <div className="flex items-center gap-2 text-error mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs">Over Budget</span>
          </div>
          <p className="text-xl font-bold text-error">{overBudgetCount}</p>
          <p className="text-xs text-muted-foreground mt-1">categories need attention</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Target className="h-4 w-4" />
            <span className="text-xs">Cost Ratio</span>
          </div>
          <p className="text-xl font-bold text-foreground">{((totalActual / 794000000) * 100).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-1">of revenue</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cost Breakdown */}
        <div className="lg:col-span-2 rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Cost Breakdown</h2>
          <div className="space-y-4">
            {costCategories.map((category) => {
              const config = statusConfig[category.status];
              const percentUsed = (category.actual / category.budget) * 100;
              
              return (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground">{category.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{formatVND(category.actual)}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-foreground">{formatVND(category.budget)}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-border">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        category.status === 'over' ? 'bg-error' : 
                        category.status === 'on-track' ? 'bg-info' : 'bg-success'
                      }`}
                      style={{ width: `${Math.min(percentUsed, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cost Saving Tips */}
        <div className="rounded-card border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground mb-4">Cost Saving Opportunities</h2>
          <div className="space-y-3">
            {costSavingTips.map((tip) => (
              <div key={tip.id} className="rounded-lg bg-background p-4">
                <p className="text-sm text-muted-foreground mb-2">{tip.tip}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-success">Potential savings: {tip.savings}</span>
                  <button className="text-xs text-primary hover:underline">Apply</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
