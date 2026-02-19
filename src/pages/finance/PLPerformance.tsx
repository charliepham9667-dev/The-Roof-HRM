import { useState, useMemo } from 'react';
import { 
  Loader2, 
  Calendar, 
  AlertCircle, 
  ChevronDown,
  Download,
  Filter
} from 'lucide-react';
import { usePLData, usePLComparison, usePLYears } from '../../hooks/usePLData';
import {
  RevenueMixChart,
  ExpenseBreakdownChart,
  ProfitMarginGauge,
  PLAlertsPanel,
  ProfitabilityTrendChart,
  LineItemPerformanceTable,
  FinancialKPICards,
  CFOExecutiveSummary
} from '../../components/finance';

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function PLPerformance() {
  const currentYear = new Date().getFullYear();
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'latest'>('latest');
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);

  // Fetch data
  const { data: yearsData } = usePLYears();
  const { data: plData, isLoading: actualLoading, error } = usePLData(selectedYear, 'actual');
  const { data: budgetData, isLoading: budgetLoading } = usePLData(selectedYear, 'budget');
  usePLComparison(selectedYear, selectedYear - 1);
  
  const isLoading = actualLoading || budgetLoading;

  const availableYears = yearsData && yearsData.length > 0 
    ? yearsData 
    : [currentYear, currentYear - 1];

  // Determine displayed month - use actual if available, otherwise budget
  const displayMonth = useMemo(() => {
    // Try actual data first
    if (selectedMonth === 'latest') {
      return plData?.latestMonth || budgetData?.latestMonth || null;
    }
    
    // Look for actual data for selected month
    const actualMonth = plData?.months?.find(m => m.month === selectedMonth);
    if (actualMonth) return actualMonth;
    
    // Fall back to budget data
    const budgetMonth = budgetData?.months?.find(m => m.month === selectedMonth);
    if (budgetMonth) return budgetMonth;
    
    // Default to latest available
    return plData?.latestMonth || budgetData?.latestMonth || null;
  }, [plData, budgetData, selectedMonth]);

  // Get previous month for comparison
  const previousMonth = useMemo(() => {
    if (!displayMonth || !plData?.months) return null;
    
    const prevMonthNum = displayMonth.month === 1 ? 12 : displayMonth.month - 1;
    return plData.months.find(m => m.month === prevMonthNum) || null;
  }, [displayMonth, plData]);

  // Get budget for current month
  const monthBudget = useMemo(() => {
    if (!displayMonth || !budgetData?.months) return null;
    return budgetData.months.find(m => m.month === displayMonth.month) || null;
  }, [displayMonth, budgetData]);

  // Available months in the data (combine actual and budget)
  const availableMonths = useMemo(() => {
    const actualMonths = plData?.months?.map(m => m.month) || [];
    const budgetMonths = budgetData?.months?.map(m => m.month) || [];
    // Combine and dedupe
    return [...new Set([...actualMonths, ...budgetMonths])].sort((a, b) => a - b);
  }, [plData?.months, budgetData?.months]);

  // Check if a month has actual data (vs only budget)
  const monthsWithActual = useMemo(() => {
    return plData?.months?.map(m => m.month) || [];
  }, [plData?.months]);

  // Check if we're displaying budget-only data (no actual data for this year)
  const isBudgetOnly = !plData?.hasData && budgetData?.hasData;

  // Close dropdowns on click outside
  const closeDropdowns = () => {
    setShowYearDropdown(false);
    setShowMonthDropdown(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-error">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p>Failed to load P&L data</p>
        <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" onClick={closeDropdowns}>
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">P&L Performance Overview</h1>
            <p className="text-sm text-muted-foreground mt-1">Real-time financial health and variance reporting</p>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 text-sm text-foreground border border-border rounded-lg hover:bg-muted transition-colors">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download PDF</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-muted-foreground text-sm mr-2">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters:</span>
          </div>
          
          {/* Year selector */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setShowYearDropdown(!showYearDropdown); setShowMonthDropdown(false); }}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors min-h-[40px]"
            >
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{selectedYear}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showYearDropdown && (
              <div className="absolute left-0 mt-2 w-28 rounded-lg border border-border bg-card shadow-xl z-20">
                {availableYears.map(year => (
                  <button
                    key={year}
                    onClick={() => { setSelectedYear(year); setSelectedMonth('latest'); setShowYearDropdown(false); }}
                    className={`w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors ${
                      year === selectedYear ? 'text-primary' : 'text-foreground'
                    } first:rounded-t-lg last:rounded-b-lg`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Month selector */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setShowMonthDropdown(!showMonthDropdown); setShowYearDropdown(false); }}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors min-h-[40px]"
            >
              <span>{selectedMonth === 'latest' ? 'Latest' : MONTH_SHORT[selectedMonth - 1]}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showMonthDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showMonthDropdown && (
              <div className="absolute left-0 mt-2 w-32 rounded-lg border border-border bg-card shadow-xl z-20 max-h-[300px] overflow-y-auto">
                <button
                  onClick={() => { setSelectedMonth('latest'); setShowMonthDropdown(false); }}
                  className={`w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors rounded-t-lg ${
                    selectedMonth === 'latest' ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  Latest
                </button>
                {MONTH_SHORT.map((name, index) => {
                  const monthNum = index + 1;
                  const isAvailable = availableMonths.includes(monthNum);
                  const hasActual = monthsWithActual.includes(monthNum);
                  return (
                    <button
                      key={monthNum}
                      onClick={() => { if (isAvailable) { setSelectedMonth(monthNum); setShowMonthDropdown(false); } }}
                      disabled={!isAvailable}
                      className={`w-full px-4 py-2 text-sm text-left transition-colors last:rounded-b-lg flex items-center justify-between ${
                        !isAvailable 
                          ? 'text-muted-foreground/50 cursor-not-allowed' 
                          : selectedMonth === monthNum 
                            ? 'text-primary hover:bg-muted' 
                            : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span>{name}</span>
                      {isAvailable && !hasActual && (
                        <span className="text-xs text-muted-foreground">Budget</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* No data state - check for either actual OR budget data */}
      {!plData?.hasData && !budgetData?.hasData ? (
        <div className="rounded-card border border-dashed border-border bg-card/50 p-8 md:p-12 text-center shadow-card">
          <Calendar className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-base md:text-lg">No P&L data available for {selectedYear}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Sync your P&L sheet from the Admin → Data Sync page
          </p>
        </div>
      ) : (
        <>
          {/* Budget-only indicator */}
          {isBudgetOnly && (
            <div className="rounded-lg bg-warning/10 border border-warning/30 p-4 mb-4 shadow-[0px_2px_12px_0px_rgba(0,0,0,0.15)]">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-black" />
                <p className="text-black font-medium">Showing Budget Data Only</p>
              </div>
              <p className="text-sm text-black/70 mt-1">
                No actual data recorded yet for {selectedYear}. Displaying budget projections.
              </p>
            </div>
          )}

          {/* Key Financial KPIs */}
          <FinancialKPICards 
            actualData={displayMonth}
            budgetData={monthBudget}
          />

          {/* Charts row: Revenue Mix, Expense Breakdown, Profit Margin, Alerts */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <RevenueMixChart data={displayMonth} />
            <ExpenseBreakdownChart data={displayMonth} />
            <ProfitMarginGauge data={displayMonth} previousData={previousMonth} />
            <PLAlertsPanel 
              currentData={displayMonth} 
              previousData={previousMonth}
              budgetData={monthBudget}
            />
          </div>

          {/* Profitability Trend - use actual if available, otherwise budget */}
          <ProfitabilityTrendChart 
            months={plData?.months?.length ? plData.months : budgetData?.months || []} 
            selectedMonth={selectedMonth}
          />

          {/* CFO Executive Summary */}
          <CFOExecutiveSummary 
            currentMonth={displayMonth}
            previousMonth={previousMonth}
            budgetMonth={monthBudget}
            allMonths={plData?.months?.length ? plData.months : budgetData?.months || []}
            year={selectedYear}
          />

          {/* Detailed P&L Financial Statement */}
          <LineItemPerformanceTable 
            actualData={displayMonth}
            budgetData={monthBudget}
          />
        </>
      )}
    </div>
  );
}
