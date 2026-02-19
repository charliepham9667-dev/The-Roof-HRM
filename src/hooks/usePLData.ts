import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { PnlMonthly, PnlSummary, PnlComparison } from '../types';

// Re-export for consumers that import types from this hook module
export type { PnlMonthly };

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Transform database row to PnlMonthly type
function transformPnlRow(row: any): PnlMonthly {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    // Revenue totals
    grossSales: row.gross_sales || 0,
    discounts: row.discounts || 0,
    foc: row.foc || 0,
    netSales: row.net_sales || 0,
    serviceCharge: row.service_charge || 0,
    // Revenue breakdown by category
    revenueWine: row.revenue_wine || 0,
    revenueSpirits: row.revenue_spirits || 0,
    revenueCocktails: row.revenue_cocktails || 0,
    revenueShisha: row.revenue_shisha || 0,
    revenueBeer: row.revenue_beer || 0,
    revenueFood: row.revenue_food || 0,
    revenueBalloons: row.revenue_balloons || 0,
    revenueOther: row.revenue_other || 0,
    // COGS breakdown
    cogs: row.cogs || 0,
    cogsWine: row.cogs_wine || 0,
    cogsSpirits: row.cogs_spirits || 0,
    cogsCocktails: row.cogs_cocktails || 0,
    cogsShisha: row.cogs_shisha || 0,
    cogsBeer: row.cogs_beer || 0,
    cogsFood: row.cogs_food || 0,
    cogsBalloons: row.cogs_balloons || 0,
    cogsOther: row.cogs_other || 0,
    // Labor breakdown
    laborCost: row.labor_cost || 0,
    laborSalary: row.labor_salary || 0,
    laborCasual: row.labor_casual || 0,
    laborInsurance: row.labor_insurance || 0,
    labor13thMonth: row.labor_13th_month || 0,
    laborHoliday: row.labor_holiday || 0,
    laborSvc: row.labor_svc || 0,
    // Fixed costs breakdown
    fixedCosts: row.fixed_costs || 0,
    fixedRental: row.fixed_rental || 0,
    fixedUtilities: row.fixed_utilities || 0,
    fixedMaintenance: row.fixed_maintenance || 0,
    fixedAdmin: row.fixed_admin || 0,
    // OPEX breakdown
    opex: row.opex || 0,
    opexConsumables: row.opex_consumables || 0,
    opexMarketing: row.opex_marketing || 0,
    opexEvents: row.opex_events || 0,
    // Other
    reserveFund: row.reserve_fund || 0,
    totalExpenses: row.total_expenses || 0,
    grossProfit: row.gross_profit || 0,
    depreciation: row.depreciation || 0,
    otherIncome: row.other_income || 0,
    otherExpenses: row.other_expenses || 0,
    ebit: row.ebit || 0,
    // Percentages
    cogsPercentage: row.cogs_percentage || 0,
    laborPercentage: row.labor_percentage || 0,
    grossMargin: row.gross_margin || 0,
    ebitMargin: row.ebit_margin || 0,
    // Budget values
    budgetGrossSales: row.budget_gross_sales || 0,
    budgetNetSales: row.budget_net_sales || 0,
    budgetCogs: row.budget_cogs || 0,
    budgetLabor: row.budget_labor || 0,
    budgetFixed: row.budget_fixed || 0,
    budgetOpex: row.budget_opex || 0,
    // Metadata
    dataType: row.data_type || 'actual',
    syncedAt: row.synced_at,
  };
}

// Calculate YTD summary from monthly data
function calculateYTDSummary(months: PnlMonthly[]): PnlSummary {
  const totals = months.reduce((acc, m) => ({
    totalRevenue: acc.totalRevenue + m.netSales,
    totalCogs: acc.totalCogs + m.cogs,
    totalLabor: acc.totalLabor + m.laborCost,
    totalFixed: acc.totalFixed + m.fixedCosts,
    totalOpex: acc.totalOpex + m.opex,
    totalExpenses: acc.totalExpenses + m.totalExpenses,
    grossProfit: acc.grossProfit + m.grossProfit,
    ebit: acc.ebit + m.ebit,
  }), {
    totalRevenue: 0,
    totalCogs: 0,
    totalLabor: 0,
    totalFixed: 0,
    totalOpex: 0,
    totalExpenses: 0,
    grossProfit: 0,
    ebit: 0,
  });

  return {
    ...totals,
    cogsPercentage: totals.totalRevenue > 0 ? (totals.totalCogs / totals.totalRevenue) * 100 : 0,
    laborPercentage: totals.totalRevenue > 0 ? (totals.totalLabor / totals.totalRevenue) * 100 : 0,
    grossMargin: totals.totalRevenue > 0 ? (totals.grossProfit / totals.totalRevenue) * 100 : 0,
    ebitMargin: totals.totalRevenue > 0 ? (totals.ebit / totals.totalRevenue) * 100 : 0,
  };
}

/**
 * Fetch P&L data for a specific year
 * @param year - Year to fetch (default: current year)
 * @param dataType - 'actual' or 'budget' (default: 'actual')
 */
export function usePLData(year?: number, dataType: 'actual' | 'budget' = 'actual') {
  const targetYear = year || new Date().getFullYear();

  return useQuery({
    queryKey: ['pnl-data', targetYear, dataType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pnl_monthly')
        .select('*')
        .eq('year', targetYear)
        .eq('data_type', dataType)
        .order('month', { ascending: true });

      if (error) throw error;

      const months = (data || []).map(transformPnlRow);
      const ytd = calculateYTDSummary(months);

      return {
        year: targetYear,
        months,
        ytd,
        hasData: months.length > 0,
        latestMonth: months.length > 0 ? months[months.length - 1] : null,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch P&L data for a specific month
 */
export function usePLMonthData(year: number, month: number) {
  return useQuery({
    queryKey: ['pnl-month', year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pnl_monthly')
        .select('*')
        .eq('year', year)
        .eq('month', month);

      if (error) throw error;

      const actual = data?.find(d => d.data_type === 'actual');
      const budget = data?.find(d => d.data_type === 'budget');

      return {
        actual: actual ? transformPnlRow(actual) : null,
        budget: budget ? transformPnlRow(budget) : null,
        monthName: MONTH_NAMES[month - 1],
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Compare P&L data between two years (YoY comparison)
 */
export function usePLComparison(currentYear: number, previousYear: number) {
  return useQuery({
    queryKey: ['pnl-comparison', currentYear, previousYear],
    queryFn: async () => {
      // Fetch both years
      const [currentData, previousData] = await Promise.all([
        supabase
          .from('pnl_monthly')
          .select('*')
          .eq('year', currentYear)
          .eq('data_type', 'actual')
          .order('month'),
        supabase
          .from('pnl_monthly')
          .select('*')
          .eq('year', previousYear)
          .eq('data_type', 'actual')
          .order('month'),
      ]);

      if (currentData.error) throw currentData.error;
      if (previousData.error) throw previousData.error;

      const currentMonths = (currentData.data || []).map(transformPnlRow);
      const previousMonths = (previousData.data || []).map(transformPnlRow);

      // Create comparison for each month
      const comparison: PnlComparison[] = [];
      
      for (let month = 1; month <= 12; month++) {
        const current = currentMonths.find(m => m.month === month) || null;
        const previous = previousMonths.find(m => m.month === month) || null;

        let variance = null;
        if (current && previous && previous.netSales > 0) {
          variance = {
            netSales: current.netSales - previous.netSales,
            netSalesPercent: ((current.netSales - previous.netSales) / previous.netSales) * 100,
            grossProfit: current.grossProfit - previous.grossProfit,
            grossProfitPercent: previous.grossProfit > 0 
              ? ((current.grossProfit - previous.grossProfit) / previous.grossProfit) * 100 
              : 0,
            ebit: current.ebit - previous.ebit,
            ebitPercent: previous.ebit > 0 
              ? ((current.ebit - previous.ebit) / previous.ebit) * 100 
              : 0,
          };
        }

        comparison.push({
          month,
          monthName: MONTH_NAMES[month - 1],
          currentYear: current,
          previousYear: previous,
          variance,
        });
      }

      // Calculate YTD summaries
      const currentYTD = calculateYTDSummary(currentMonths);
      const previousYTD = calculateYTDSummary(previousMonths);

      return {
        currentYear,
        previousYear,
        comparison,
        currentYTD,
        previousYTD,
        ytdVariance: previousYTD.totalRevenue > 0 ? {
          revenue: currentYTD.totalRevenue - previousYTD.totalRevenue,
          revenuePercent: ((currentYTD.totalRevenue - previousYTD.totalRevenue) / previousYTD.totalRevenue) * 100,
          grossProfit: currentYTD.grossProfit - previousYTD.grossProfit,
          grossProfitPercent: previousYTD.grossProfit > 0 
            ? ((currentYTD.grossProfit - previousYTD.grossProfit) / previousYTD.grossProfit) * 100 
            : 0,
          ebit: currentYTD.ebit - previousYTD.ebit,
          ebitPercent: previousYTD.ebit > 0 
            ? ((currentYTD.ebit - previousYTD.ebit) / previousYTD.ebit) * 100 
            : 0,
        } : null,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Get available years with P&L data (includes years with either actual or budget data)
 */
export function usePLYears() {
  return useQuery({
    queryKey: ['pnl-years'],
    queryFn: async () => {
      // Get all years that have any P&L data (actual or budget)
      const { data, error } = await supabase
        .from('pnl_monthly')
        .select('year, data_type');

      if (error) throw error;

      // Create a map of years with their available data types
      const yearMap = new Map<number, { hasActual: boolean; hasBudget: boolean }>();
      (data || []).forEach(d => {
        const existing = yearMap.get(d.year) || { hasActual: false, hasBudget: false };
        if (d.data_type === 'actual') existing.hasActual = true;
        if (d.data_type === 'budget') existing.hasBudget = true;
        yearMap.set(d.year, existing);
      });

      const years = [...yearMap.keys()].sort((a, b) => b - a);
      return years;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Sync P&L data from Google Sheets
 * @param csvUrl - Optional CSV URL to bypass Google Sheets API cache
 * @param yearOverride - Optional year to force all data to (handles inconsistent headers)
 */
export function usePLSync() {
  const syncPnl = async (sheetId: string, sheetName: string, csvUrl?: string, yearOverride?: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bright-service`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          sheetId,
          sheetName,
          syncType: 'pnl',
          csvUrl, // Use CSV URL if provided (bypasses Google API cache)
          yearOverride, // Force all data to this year (handles inconsistent headers)
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Sync failed');
    }

    return response.json();
  };

  return { syncPnl };
}
