import { ChevronDown } from 'lucide-react';
import type { PnlMonthly } from '../../types';

interface LineItemPerformanceTableProps {
  actualData: PnlMonthly | null;
  budgetData?: PnlMonthly | null;
  className?: string;
}

const formatVND = (value: number) => {
  if (Math.abs(value) >= 1000000000) return `${(value / 1000000000).toFixed(2)}B đ`;
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M đ`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}K đ`;
  return `${value.toLocaleString()} đ`;
};

const formatVariance = (value: number) => {
  const formatted = formatVND(Math.abs(value));
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
};

const formatPercent = (value: number) => {
  const formatted = `${Math.abs(value).toFixed(1)}%`;
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
};

interface LineItem {
  name: string;
  actual: number;
  budget: number;
  isTotal?: boolean;
  isSection?: boolean;
  indent?: boolean;
}

export function LineItemPerformanceTable({ actualData, budgetData, className = '' }: LineItemPerformanceTableProps) {
  if (!actualData) {
    return (
      <div className={`rounded-card border border-border bg-card p-4 shadow-card ${className}`}>
        <h3 className="text-sm font-medium text-foreground mb-4">Detailed P&L Financial Statement</h3>
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          No data available
        </div>
      </div>
    );
  }

  // Get month name for display
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[actualData.month - 1];

  // Calculate totals if they're 0 in database (sum of individual items)
  const calcFixedCosts = actualData.fixedCosts || 
    (actualData.fixedRental + actualData.fixedMaintenance + actualData.fixedAdmin + (actualData.fixedUtilities || 0));
  const calcOpex = actualData.opex || 
    (actualData.opexConsumables + actualData.opexMarketing + actualData.opexEvents);
  const calcBudgetFixedCosts = budgetData?.fixedCosts || 
    ((budgetData?.fixedRental || 0) + (budgetData?.fixedMaintenance || 0) + (budgetData?.fixedAdmin || 0));
  const calcBudgetOpex = budgetData?.opex || 
    ((budgetData?.opexConsumables || 0) + (budgetData?.opexMarketing || 0) + (budgetData?.opexEvents || 0));

  // Build line items matching spreadsheet structure exactly
  const lineItems: LineItem[] = [
    // 1. GROSS SALES SECTION
    { name: '1. GROSS SALES', actual: 0, budget: 0, isSection: true },
    { name: 'Wine', actual: actualData.revenueWine, budget: budgetData?.revenueWine || 0, indent: true },
    { name: 'Spirits', actual: actualData.revenueSpirits, budget: budgetData?.revenueSpirits || 0, indent: true },
    { name: 'Cocktails', actual: actualData.revenueCocktails, budget: budgetData?.revenueCocktails || 0, indent: true },
    { name: 'Shisha', actual: actualData.revenueShisha, budget: budgetData?.revenueShisha || 0, indent: true },
    { name: 'Beer', actual: actualData.revenueBeer, budget: budgetData?.revenueBeer || 0, indent: true },
    { name: 'Food', actual: actualData.revenueFood, budget: budgetData?.revenueFood || 0, indent: true },
    { name: 'Balloons', actual: actualData.revenueBalloons, budget: budgetData?.revenueBalloons || 0, indent: true },
    { name: 'Other (Coke, Water, Mixer,..)', actual: actualData.revenueOther, budget: budgetData?.revenueOther || 0, indent: true },
    { name: 'GROSS SALES', actual: actualData.grossSales, budget: budgetData?.grossSales || budgetData?.budgetGrossSales || 0, isTotal: true },
    { name: 'Discounts/FOC', actual: -(actualData.discounts || 0) - (actualData.foc || 0), budget: -(budgetData?.discounts || 0), indent: true },
    { name: '1.1 NET SALES', actual: actualData.netSales, budget: budgetData?.netSales || budgetData?.budgetNetSales || 0, isTotal: true },
    { name: 'SVC (Service Charge)', actual: actualData.serviceCharge, budget: budgetData?.serviceCharge || 0, indent: true },
    
    // 2. COST OF GOODS SECTION
    { name: '2. COST OF GOODS (COGS)', actual: 0, budget: 0, isSection: true },
    { name: 'Wine', actual: actualData.cogsWine, budget: budgetData?.cogsWine || 0, indent: true },
    { name: 'Spirits', actual: actualData.cogsSpirits, budget: budgetData?.cogsSpirits || 0, indent: true },
    { name: 'Cocktails', actual: actualData.cogsCocktails, budget: budgetData?.cogsCocktails || 0, indent: true },
    { name: 'Shisha', actual: actualData.cogsShisha, budget: budgetData?.cogsShisha || 0, indent: true },
    { name: 'Beer', actual: actualData.cogsBeer, budget: budgetData?.cogsBeer || 0, indent: true },
    { name: 'Food', actual: actualData.cogsFood, budget: budgetData?.cogsFood || 0, indent: true },
    { name: 'Balloons', actual: actualData.cogsBalloons, budget: budgetData?.cogsBalloons || 0, indent: true },
    { name: 'Others', actual: actualData.cogsOther, budget: budgetData?.cogsOther || 0, indent: true },
    { name: 'TOTAL COGS', actual: actualData.cogs, budget: budgetData?.cogs || budgetData?.budgetCogs || 0, isTotal: true },
    
    // 3. DIRECT LABOR COST SECTION
    { name: '3. DIRECT LABOR COST', actual: 0, budget: 0, isSection: true },
    { name: 'Salary', actual: actualData.laborSalary, budget: budgetData?.laborSalary || 0, indent: true },
    { name: 'Casual / Extra Shift', actual: actualData.laborCasual, budget: budgetData?.laborCasual || 0, indent: true },
    { name: 'Social Insurance', actual: actualData.laborInsurance, budget: budgetData?.laborInsurance || 0, indent: true },
    { name: '13th Salary', actual: actualData.labor13thMonth, budget: budgetData?.labor13thMonth || 0, indent: true },
    { name: 'Public Holiday', actual: actualData.laborHoliday, budget: budgetData?.laborHoliday || 0, indent: true },
    { name: 'SVC (Labor)', actual: actualData.laborSvc, budget: budgetData?.laborSvc || 0, indent: true },
    { name: 'TOTAL DIRECT LABOR', actual: actualData.laborCost, budget: budgetData?.laborCost || budgetData?.budgetLabor || 0, isTotal: true },
    
    // 4. FIXED OPERATING COST SECTION
    { name: '4. FIXED OPERATING COST', actual: 0, budget: 0, isSection: true },
    { name: 'Rental & Utilities', actual: actualData.fixedRental, budget: budgetData?.fixedRental || 0, indent: true },
    { name: 'Property Maintenance & Security', actual: actualData.fixedMaintenance, budget: budgetData?.fixedMaintenance || 0, indent: true },
    { name: 'Administrative Costs', actual: actualData.fixedAdmin, budget: budgetData?.fixedAdmin || 0, indent: true },
    { name: 'TOTAL FIXED COSTS', actual: calcFixedCosts, budget: calcBudgetFixedCosts || budgetData?.budgetFixed || 0, isTotal: true },
    
    // 5. OPERATING EXPENSES (OPEX) SECTION
    { name: '5. OPERATING EXPENSES (OPEX)', actual: 0, budget: 0, isSection: true },
    { name: 'Consumable & Supplies', actual: actualData.opexConsumables, budget: budgetData?.opexConsumables || 0, indent: true },
    { name: 'Marketing & Advertisement', actual: actualData.opexMarketing, budget: budgetData?.opexMarketing || 0, indent: true },
    { name: 'Event & Entertainment', actual: actualData.opexEvents, budget: budgetData?.opexEvents || 0, indent: true },
    { name: 'TOTAL OPEX', actual: calcOpex, budget: calcBudgetOpex || budgetData?.budgetOpex || 0, isTotal: true },
    
    // 6. RESERVE FUND & OTHERS
    { name: '6. RESERVE FUND & OTHERS', actual: 0, budget: 0, isSection: true },
    { name: 'Reserve Fund', actual: actualData.reserveFund, budget: budgetData?.reserveFund || 0, indent: true },
    
    // SUMMARY TOTALS
    { name: 'TOTAL COMPANY EXPENSES', actual: actualData.totalExpenses, budget: budgetData?.totalExpenses || 0, isTotal: true },
    { name: 'GROSS OPERATING PROFIT', actual: actualData.grossProfit, budget: budgetData?.grossProfit || 0, isTotal: true },
    
    // NET INCOME / EBIT
    { name: 'EBIT', actual: actualData.ebit, budget: budgetData?.ebit || 0, isTotal: true },
  ];

  // Filter out zero values (except for totals and sections)
  const filteredItems = lineItems.filter(item => 
    item.isSection || item.isTotal || item.actual !== 0 || item.budget !== 0
  );

  return (
    <div className={`rounded-card border border-border bg-card p-4 shadow-card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Detailed P&L Financial Statement</h3>
          <p className="text-xs text-muted-foreground mt-0.5">MTD Actual vs Budget comparison</p>
        </div>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1">
          {monthName} {actualData.year}
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-primary uppercase py-3 pr-4">Account Description</th>
              <th className="text-right text-xs font-medium text-primary uppercase py-3 px-4">MTD Actual</th>
              <th className="text-right text-xs font-medium text-primary uppercase py-3 px-4">MTD Budget</th>
              <th className="text-right text-xs font-medium text-primary uppercase py-3 px-4">Variance (đ)</th>
              <th className="text-right text-xs font-medium text-primary uppercase py-3 pl-4">Variance (%)</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, index) => {
              // Determine if this is a cost/expense item (categories 2, 3, 4, 5, 6)
              // For costs: positive variance = under budget (good), negative = over budget (bad)
              // For revenue: positive variance = above target (good), negative = below target (bad)
              const isRevenueItem = item.name.includes('SALES') || item.name.includes('Sales') || 
                                   item.name.includes('SVC') || item.name.includes('Profit') || 
                                   item.name.includes('EBIT') || 
                                   (item.name === 'Wine' || item.name === 'Spirits' || item.name === 'Cocktails' || 
                                    item.name === 'Shisha' || item.name === 'Beer' || item.name === 'Food' || 
                                    item.name === 'Balloons' || item.name === 'Other (Coke, Water, Mixer,..)');
              const isExpenseItem = item.name.includes('COGS') || item.name.includes('LABOR') || 
                                   item.name.includes('Labor') || item.name.includes('FIXED') || 
                                   item.name.includes('Fixed') || item.name.includes('OPEX') || 
                                   item.name.includes('Opex') || item.name.includes('EXPENSES') ||
                                   item.name.includes('Expenses') || item.name.includes('RESERVE') ||
                                   item.name.includes('Salary') || item.name.includes('Insurance') ||
                                   item.name.includes('Holiday') || item.name.includes('Rental') ||
                                   item.name.includes('Maintenance') || item.name.includes('Administrative') ||
                                   item.name.includes('Consumable') || item.name.includes('Marketing') ||
                                   item.name.includes('Event') || item.name.includes('Reserve') ||
                                   item.name.includes('Casual') || item.name.includes('Others') ||
                                   item.name.includes('Cost') || item.name.includes('cost');
              
              // For COGS items specifically (they're expenses)
              const inCOGSSection = lineItems.findIndex(i => i.name === '2. COST OF GOODS (COGS)') < index && 
                                   lineItems.findIndex(i => i.name === '3. DIRECT LABOR COST') > index;
              
              // Determine if this is a cost item
              const isCostItem = (isExpenseItem || inCOGSSection) && !isRevenueItem;
              
              // Calculate variance:
              // For REVENUE: Actual - Budget (higher actual = positive = good)
              // For COSTS: Budget - Actual (lower actual = positive = good, higher actual = negative = bad)
              const variance = isCostItem ? (item.budget - item.actual) : (item.actual - item.budget);
              const variancePercent = item.budget !== 0 ? (variance / Math.abs(item.budget)) * 100 : 0;
              
              // For all items: positive variance = green (good), negative variance = red (bad)
              const varianceColor = variance === 0 ? 'text-muted-foreground' : 
                                   variance > 0 ? 'text-success' : 'text-error';

              if (item.isSection) {
                return (
                  <tr key={index} className="bg-muted/50">
                    <td colSpan={5} className="py-3 px-2">
                      <span className="text-sm font-semibold text-primary">{item.name}</span>
                    </td>
                  </tr>
                );
              }

              const isNetIncome = item.name === 'EBIT';
              const isMainTotal = item.name === 'TOTAL COMPANY EXPENSES' || item.name === 'GROSS OPERATING PROFIT';

              return (
                <tr 
                  key={index} 
                  className={`border-b border-border/30 last:border-0 ${
                    isNetIncome ? 'bg-primary/20' : isMainTotal ? 'bg-muted/50' : item.isTotal ? 'bg-muted/30' : ''
                  }`}
                >
                  <td className={`py-2.5 pr-4 ${item.indent ? 'pl-6' : ''}`}>
                    <span className={`text-sm ${item.isTotal ? 'font-semibold text-foreground' : 'text-foreground'} ${
                      isNetIncome ? 'text-primary font-bold text-base' : isMainTotal ? 'font-bold' : ''
                    }`}>
                      {item.name}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <span className={`text-sm tabular-nums ${item.isTotal ? 'font-semibold text-foreground' : 'text-foreground'} ${
                      isNetIncome ? 'text-primary font-bold text-base' : isMainTotal ? 'font-bold' : ''
                    }`}>
                      {formatVND(item.actual)}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {item.budget !== 0 ? formatVND(item.budget) : '—'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <span className={`text-sm tabular-nums ${varianceColor}`}>
                      {item.budget !== 0 ? formatVariance(variance) : '—'}
                    </span>
                  </td>
                  <td className="py-2.5 pl-4 text-right">
                    <span className={`text-sm tabular-nums font-medium ${varianceColor}`}>
                      {item.budget !== 0 ? formatPercent(variancePercent) : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Last synced: {actualData.syncedAt ? new Date(actualData.syncedAt).toLocaleString() : 'Unknown'}</span>
        <span>Fiscal Year: Jan 01 - Dec 31</span>
      </div>
    </div>
  );
}
