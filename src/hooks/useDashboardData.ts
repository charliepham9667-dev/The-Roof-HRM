import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// =============================================
// Types for Dashboard Data
// =============================================

export interface DailyMetric {
  id: string;
  date: string;
  revenue: number;
  pax: number;
  avgSpend: number;
  laborCost: number;
  staffOnDuty: number;
  hoursScheduled: number;
  hoursWorked: number;
  projectedRevenue: number;
}

export interface Review {
  id: string;
  source: 'google' | 'tripadvisor' | 'facebook' | 'internal';
  authorName: string | null;
  rating: number;
  comment: string | null;
  sentimentScore: number | null;
  publishedAt: string;
}

export interface ComplianceItem {
  id: string;
  title: string;
  description: string | null;
  type: 'license' | 'permit' | 'certification' | 'audit' | 'training';
  status: 'action_required' | 'needs_attention' | 'passed' | 'pending';
  dueDate: string | null;
  completedAt: string | null;
}

export interface Shift {
  id: string;
  staffId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'no_show' | 'cancelled';
  clockIn: string | null;
  clockOut: string | null;
}

export interface Target {
  id: string;
  metric: 'revenue' | 'pax' | 'labor_cost_percentage' | 'avg_spend';
  targetValue: number;
  period: 'daily' | 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string | null;
}

// =============================================
// Revenue Velocity
// =============================================

export interface RevenueVelocityData {
  monthlyTarget: number;
  mtdRevenue: number;
  goalAchievedPercent: number;
  currentDay: number;
  daysInMonth: number;
  surplus: number; // positive = surplus, negative = deficit
  projectedMonthEnd: number;
  dailyTargetPace: number; // required daily to hit base target
  // Stretch goal (1.5x target, only shown if > 100% achieved)
  showStretchGoal: boolean;
  stretchGoal: number;
  gapToStretch: number;
  requiredPaceForStretch: number;
  // For insight text
  yesterdayRevenue: number;
  avgDailyRevenue: number;
}

export function useRevenueVelocity() {
  return useQuery({
    queryKey: ['revenue-velocity'],
    queryFn: async (): Promise<RevenueVelocityData> => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      // Revenue is only recognized end-of-day, so we count *completed* days only.
      // Example: Feb 5 → count through Feb 4 (Day 4 of 28).
      const calendarDay = now.getDate();
      const completedDay = Math.max(0, calendarDay - 1);
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

      // Get monthly target
      const periodStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const todayISO = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(calendarDay).padStart(2, '0')}`;
      const { data: targetData } = await supabase
        .from('targets')
        .select('target_value')
        .eq('metric', 'revenue')
        .eq('period', 'monthly')
        .eq('period_start', periodStart)
        .single();

      const monthlyTarget = targetData?.target_value || 750000000; // Default 750M

      // Get MTD revenue
      const { data: metricsData } = await supabase
        .from('daily_metrics')
        .select('date, revenue')
        .gte('date', periodStart)
        // Exclude today (EOD accounting): only include dates strictly before today.
        .lt('date', todayISO)
        .order('date', { ascending: false });

      const mtdRevenue = (metricsData || []).reduce((sum, row) => sum + (row.revenue || 0), 0);
      const daysWithData = (metricsData || []).filter(r => r.revenue > 0).length;
      
      // Yesterday's revenue (most recent day)
      const yesterdayRevenue = metricsData && metricsData.length > 0 ? metricsData[0].revenue : 0;
      
      // Average daily revenue
      const avgDailyRevenue = daysWithData > 0 ? mtdRevenue / daysWithData : 0;

      // Calculations
      const goalAchievedPercent = monthlyTarget > 0 ? (mtdRevenue / monthlyTarget) * 100 : 0;
      const surplus = mtdRevenue - monthlyTarget; // Simple: actual - target
      const projectedMonthEnd = daysWithData > 0 ? (mtdRevenue / daysWithData) * daysInMonth : 0;
      const dailyTargetPace = monthlyTarget / daysInMonth;

      // Stretch goal (1.5x, only if > 100% achieved)
      const showStretchGoal = goalAchievedPercent >= 100;
      const stretchGoal = monthlyTarget * 1.5;
      const gapToStretch = stretchGoal - mtdRevenue;
      const remainingDays = daysInMonth - completedDay;
      const requiredPaceForStretch = remainingDays > 0 ? gapToStretch / remainingDays : 0;

      return {
        monthlyTarget,
        mtdRevenue,
        goalAchievedPercent,
        currentDay: completedDay,
        daysInMonth,
        surplus,
        projectedMonthEnd,
        dailyTargetPace,
        showStretchGoal,
        stretchGoal,
        gapToStretch,
        requiredPaceForStretch,
        yesterdayRevenue,
        avgDailyRevenue,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

// =============================================
// Sync Status
// =============================================

export interface SyncStatus {
  lastSyncAt: string | null;
  status: 'completed' | 'failed' | 'running' | 'pending' | null;
  hoursAgo: number;
  isStale: boolean; // true if > 24 hours since last sync
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ['sync-status'],
    queryFn: async (): Promise<SyncStatus> => {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('completed_at, status')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data?.completed_at) {
        return {
          lastSyncAt: null,
          status: null,
          hoursAgo: -1,
          isStale: true,
        };
      }

      const completedAt = new Date(data.completed_at);
      const now = new Date();
      const hoursAgo = Math.round((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60));

      return {
        lastSyncAt: data.completed_at,
        status: data.status,
        hoursAgo,
        isStale: hoursAgo > 24,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// =============================================
// Target Management
// =============================================

export function useTargets() {
  return useQuery({
    queryKey: ['targets'],
    queryFn: async (): Promise<Target[]> => {
      const { data, error } = await supabase
        .from('targets')
        .select('*')
        .eq('metric', 'revenue')
        .eq('period', 'monthly')
        .order('period_start', { ascending: false });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        metric: row.metric,
        targetValue: row.target_value,
        period: row.period,
        periodStart: row.period_start,
        periodEnd: row.period_end,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateTarget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { month: number; year: number; targetValue: number }) => {
      const periodStart = `${data.year}-${String(data.month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(data.year, data.month + 1, 0).getDate();
      const periodEnd = `${data.year}-${String(data.month + 1).padStart(2, '0')}-${lastDay}`;

      const { data: result, error } = await supabase
        .from('targets')
        .insert({
          metric: 'revenue',
          target_value: data.targetValue,
          period: 'monthly',
          period_start: periodStart,
          period_end: periodEnd,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-summary'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-performance'] });
    },
  });
}

export function useUpdateTarget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { id: string; targetValue: number }) => {
      const { data: result, error } = await supabase
        .from('targets')
        .update({ target_value: data.targetValue })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-summary'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-performance'] });
    },
  });
}

export function useDeleteTarget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('targets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-summary'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-performance'] });
    },
  });
}

// =============================================
// KPI Summary (computed from daily_metrics)
// =============================================

export interface KPISummary {
  revenue: { value: number; trend: number; trendLabel: string };
  pax: { value: number; trend: number; trendLabel: string };
  avgSpend: { value: number; trend: number; trendLabel: string };
  yoyGrowth: { value: number; trendLabel: string };
  targetMet: { percentage: number; isOnTrack: boolean };
}

export function useKPISummary() {
  return useQuery({
    queryKey: ['kpi-summary'],
    queryFn: async (): Promise<KPISummary> => {
      // Get current year
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      // First, find the latest date with data in current year
      const { data: latestData } = await supabase
        .from('daily_metrics')
        .select('date')
        .gte('date', `${currentYear}-01-01`)
        .order('date', { ascending: false })
        .limit(1)
        .single();
      
      // Use latest data date, or fall back to today
      // Parse date string directly to avoid timezone issues (date is YYYY-MM-DD format)
      const endDay = latestData?.date 
        ? parseInt(latestData.date.split('-')[2], 10)
        : now.getDate();
      
      // Current period: Month start to latest data date (2026)
      const periodStart2026 = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const periodEnd2026 = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      
      // Same period last year (2025) - use same day range for fair comparison
      const periodStart2025 = `${currentYear - 1}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const periodEnd2025 = `${currentYear - 1}-${String(currentMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

      // Get current period data (2026)
      const { data: currentPeriodData, error: currentError } = await supabase
        .from('daily_metrics')
        .select('revenue, pax, avg_spend')
        .gte('date', periodStart2026)
        .lte('date', periodEnd2026);

      if (currentError) {
        console.error('KPI fetch error:', currentError);
        throw currentError;
      }

      // Get same period last year data (2025) - matching date range
      const { data: lastYearPeriodData } = await supabase
        .from('daily_metrics')
        .select('revenue, pax, avg_spend')
        .gte('date', periodStart2025)
        .lte('date', periodEnd2025);

      // Get monthly target — match by current month's period_start for accuracy
      const { data: targetData } = await supabase
        .from('targets')
        .select('*')
        .eq('metric', 'revenue')
        .eq('period', 'monthly')
        .eq('period_start', periodStart2026)
        .maybeSingle();

      type PeriodAgg = { revenue: number; pax: number; totalSpend: number; avgSpend: number }

      // Sum current period metrics
      const currentPeriod: PeriodAgg = (currentPeriodData || []).reduce(
        (acc: PeriodAgg, row: any) => ({
          revenue: acc.revenue + (row.revenue || 0),
          pax: acc.pax + (row.pax || 0),
          totalSpend: acc.totalSpend + ((row.avg_spend || 0) * (row.pax || 0)),
          avgSpend: 0,
        }),
        { revenue: 0, pax: 0, totalSpend: 0, avgSpend: 0 }
      );
      currentPeriod.avgSpend = currentPeriod.pax > 0 ? currentPeriod.totalSpend / currentPeriod.pax : 0;

      // Sum last year period metrics
      const lastYearPeriod: PeriodAgg = (lastYearPeriodData || []).reduce(
        (acc: PeriodAgg, row: any) => ({
          revenue: acc.revenue + (row.revenue || 0),
          pax: acc.pax + (row.pax || 0),
          totalSpend: acc.totalSpend + ((row.avg_spend || 0) * (row.pax || 0)),
          avgSpend: 0,
        }),
        { revenue: 0, pax: 0, totalSpend: 0, avgSpend: 0 }
      );
      lastYearPeriod.avgSpend = lastYearPeriod.pax > 0 ? lastYearPeriod.totalSpend / lastYearPeriod.pax : 0;

      const target = targetData?.target_value || 975000000;

      // Calculate YoY trends (same period comparison)
      const revenueTrend = lastYearPeriod.revenue > 0
        ? ((currentPeriod.revenue - lastYearPeriod.revenue) / lastYearPeriod.revenue) * 100
        : 0;
      const paxTrend = lastYearPeriod.pax > 0
        ? ((currentPeriod.pax - lastYearPeriod.pax) / lastYearPeriod.pax) * 100
        : 0;
      const avgSpendTrend = lastYearPeriod.avgSpend > 0
        ? ((currentPeriod.avgSpend - lastYearPeriod.avgSpend) / lastYearPeriod.avgSpend) * 100
        : 0;

      const targetPercentage = Math.round((currentPeriod.revenue / target) * 100);

      return {
        revenue: {
          value: currentPeriod.revenue,
          trend: revenueTrend,
          trendLabel: `${revenueTrend >= 0 ? '+' : ''}${revenueTrend.toFixed(1)}% YoY`,
        },
        pax: {
          value: currentPeriod.pax,
          trend: paxTrend,
          trendLabel: `${paxTrend >= 0 ? '+' : ''}${paxTrend.toFixed(1)}% YoY`,
        },
        avgSpend: {
          value: Math.round(currentPeriod.avgSpend),
          trend: avgSpendTrend,
          trendLabel: `${avgSpendTrend >= 0 ? '+' : ''}${avgSpendTrend.toFixed(1)}% YoY`,
        },
        yoyGrowth: {
          value: revenueTrend,
          trendLabel: `${paxTrend >= 0 ? '+' : ''}${paxTrend.toFixed(1)}% Pax YoY`,
        },
        targetMet: {
          percentage: Math.min(targetPercentage, 100),
          isOnTrack: targetPercentage >= 100,
        },
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// =============================================
// Weekly Sales Trend
// =============================================

export interface WeeklySalesData {
  /** ISO date string (YYYY-MM-DD for day view, YYYY-MM-01 for month view) */
  date: string;
  /** Display helper (optional; UI may format from `date`) */
  day?: string;
  projected: number;
  actual: number;
  lastYear: number;
}

type WeeklySalesRange = "7d" | "30d" | "30m"

function formatLocalISODate(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addMonths(date: Date, months: number) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export function useWeeklySales(range: WeeklySalesRange = "30d") {
  return useQuery({
    queryKey: ['weekly-sales', range],
    queryFn: async (): Promise<WeeklySalesData[]> => {
      const now = new Date();

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      if (range === "30m") {
        // Aggregate the last 30 months by month.
        const start = addMonths(now, -30)
        const startISO = formatLocalISODate(start)

        const { data, error } = await supabase
          .from('daily_metrics')
          .select('date, revenue')
          .gte('date', startISO)
          .order('date', { ascending: true })

        if (error) throw error

        const monthTotals = new Map<string, number>()
        ;(data || []).forEach((row: any) => {
          const monthKey = String(row.date).slice(0, 7) // YYYY-MM
          monthTotals.set(monthKey, (monthTotals.get(monthKey) || 0) + (row.revenue || 0))
        })

        // Build a dense month list (30 months) ending at current month.
        const endMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const months: string[] = []
        for (let i = 29; i >= 0; i--) {
          const m = addMonths(endMonth, -i)
          const monthKey = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`
          months.push(monthKey)
        }

        return months.map((monthKey) => {
          const [y, m] = monthKey.split("-").map(Number)
          const date = `${monthKey}-01`
          const actual = monthTotals.get(monthKey) || 0

          // YoY comparison for the same month last year.
          const lastYearKey = `${y - 1}-${String(m).padStart(2, "0")}`
          const lastYear = monthTotals.get(lastYearKey) || 0

          return {
            date,
            day: monthKey,
            actual,
            lastYear,
            projected: 0,
          }
        })
      }

      const days = range === "7d" ? 7 : 30
      const start = new Date(now)
      start.setDate(start.getDate() - days)
      const startISO = formatLocalISODate(start)

      // Get the last N days (chronological).
      const { data: currentYearData, error } = await supabase
        .from('daily_metrics')
        .select('date, revenue')
        .gte('date', startISO)
        .order('date', { ascending: true });

      if (error) throw error;

      const recentDays = currentYearData || [];

      // For each date, use the same weekday from last year (364 days).
      const lastYearDates = recentDays.map(row => {
        const d = new Date(String(row.date) + 'T12:00:00');
        const ly = new Date(d);
        ly.setDate(ly.getDate() - 364);
        return formatLocalISODate(ly);
      });
      
      const { data: lastYearData } = await supabase
        .from('daily_metrics')
        .select('date, revenue')
        .in('date', lastYearDates);
      
      // Create a map of last year's data by date
      const lastYearMap = new Map<string, number>();
      (lastYearData || []).forEach(row => {
        lastYearMap.set(row.date, row.revenue);
      });

      return recentDays.map((row, index) => {
        const lastYearDate = lastYearDates[index];
        const lastYearRevenue = lastYearMap.get(lastYearDate) || 0;
        
        return {
          date: row.date,
          day: dayNames[new Date(row.date + 'T00:00:00').getDay()],
          actual: row.revenue || 0,
          lastYear: lastYearRevenue || 0,
          projected: 0, // Not synced from sheet
        };
      });
    },
    staleTime: 1000 * 60 * 5,
    // Keep previous range data visible while refetching to avoid full-card spinners.
    placeholderData: (prev) => prev,
  });
}

// =============================================
// Reviews
// =============================================

export interface ReviewsSummary {
  averageRating: number;
  totalReviews: number;
  sentimentScore: number;
  recentReviews: Review[];
}

export function useReviews() {
  return useQuery({
    queryKey: ['reviews'],
    queryFn: async (): Promise<ReviewsSummary> => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const reviews = (data || []).map((row) => ({
        id: row.id,
        source: row.source as Review['source'],
        authorName: row.author_name,
        rating: row.rating,
        comment: row.comment,
        sentimentScore: row.sentiment_score,
        publishedAt: row.published_at,
      }));

      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

      const avgSentiment = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.sentimentScore || 0), 0) / reviews.length
        : 0;

      return {
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews: reviews.length,
        sentimentScore: Math.round(avgSentiment * 100),
        recentReviews: reviews.slice(0, 5),
      };
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// =============================================
// Google Reviews Integration
// =============================================

export interface MonthlyReviewSummary {
  monthLabel: string; // e.g. "January"
  year: number;
  count: number;
  isCurrent: boolean;
}

export interface GoogleReviewsData {
  isConnected: boolean;
  rating: number;
  reviewCount: number;
  recentReviews: Review[];
  dailyChange: number | null; // new reviews added today vs yesterday
  monthlySummaries: MonthlyReviewSummary[]; // last 2 months
}

export function useGoogleReviews() {
  return useQuery({
    queryKey: ['google-reviews'],
    queryFn: async (): Promise<GoogleReviewsData> => {
      // Fetch last 400 days so we always have a baseline before the previous month starts
      const since = new Date();
      since.setDate(since.getDate() - 400);
      const sinceIso = since.toISOString().slice(0, 10);

      const { data: metricsData } = await supabase
        .from('daily_metrics')
        .select('date, google_rating, google_review_count')
        .not('google_review_count', 'is', null)
        .gte('date', sinceIso)
        .order('date', { ascending: true });

      if (!metricsData || metricsData.length === 0) {
        return {
          isConnected: true,
          rating: 0,
          reviewCount: 0,
          recentReviews: [],
          dailyChange: null,
          monthlySummaries: [],
        };
      }

      const latest = metricsData[metricsData.length - 1];
      const secondLatest = metricsData.length >= 2 ? metricsData[metricsData.length - 2] : null;
      const rating = latest?.google_rating || 0;
      const reviewCount = latest?.google_review_count || 0;

      // Day-over-day change: latest cumulative minus the previous row's cumulative
      const dailyChange = secondLatest != null
        ? (latest.google_review_count || 0) - (secondLatest.google_review_count || 0)
        : null;

      // Monthly summaries: google_review_count is the TOTAL count snapshot at end of each day.
      // New reviews in a month = last snapshot in that month - last snapshot before that month started.
      // Build a sorted list of (date, count) pairs.
      const sorted = metricsData
        .filter(r => r.google_review_count != null)
        .sort((a, b) => a.date.localeCompare(b.date));

      // For a given month key "YYYY-MM", find the last count ON OR BEFORE the last day of that month.
      // And the last count BEFORE the first day of that month (i.e., end of prior month).
      function lastCountBeforeDate(beforeIso: string): number {
        // Find the last row with date < beforeIso
        let result = 0;
        for (const row of sorted) {
          if (row.date < beforeIso) result = row.google_review_count || 0;
          else break;
        }
        return result;
      }

      function lastCountInMonth(yearNum: number, monthNum: number): number {
        const prefix = `${yearNum}-${String(monthNum).padStart(2, '0')}`;
        let result: number | null = null;
        for (const row of sorted) {
          if (row.date.startsWith(prefix)) result = row.google_review_count || 0;
        }
        return result ?? 0;
      }

      // Determine current and previous month based on the latest data row
      const nowIso = latest.date;
      const nowYear = parseInt(nowIso.slice(0, 4));
      const nowMonth = parseInt(nowIso.slice(5, 7));
      const prevYear = nowMonth === 1 ? nowYear - 1 : nowYear;
      const prevMonth = nowMonth === 1 ? 12 : nowMonth - 1;

      const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
      const currMonthStart = `${nowYear}-${String(nowMonth).padStart(2, '0')}-01`;

      // New reviews in a month = last snapshot in that month - last snapshot before that month.
      // If no row exists before the month (e.g. data starts on Jan 1 with no Dec rows),
      // fall back to the FIRST row of that month as the base (Jan 1 = 1012, Jan 31 = 1187 → 175 new).
      function firstCountInMonth(yearNum: number, monthNum: number): number | null {
        const prefix = `${yearNum}-${String(monthNum).padStart(2, '0')}`;
        for (const row of sorted) {
          if (row.date.startsWith(prefix)) return row.google_review_count || 0;
        }
        return null;
      }

      const prevMonthEnd = lastCountInMonth(prevYear, prevMonth);
      const prevMonthBase = lastCountBeforeDate(prevMonthStart);
      const prevMonthBaseAdj = prevMonthBase > 0
        ? prevMonthBase
        : (firstCountInMonth(prevYear, prevMonth) ?? 0);
      const prevMonthNewReviews = prevMonthEnd - prevMonthBaseAdj;

      const currMonthEnd = lastCountInMonth(nowYear, nowMonth);
      const currMonthBase = lastCountBeforeDate(currMonthStart);
      const currMonthBaseAdj = currMonthBase > 0
        ? currMonthBase
        : (firstCountInMonth(nowYear, nowMonth) ?? 0);
      const currMonthNewReviews = currMonthEnd - currMonthBaseAdj;

      const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

      const monthlySummaries: MonthlyReviewSummary[] = [
        {
          monthLabel: monthNames[prevMonth - 1],
          year: prevYear,
          count: Math.max(0, prevMonthNewReviews),
          isCurrent: false,
        },
        {
          monthLabel: monthNames[nowMonth - 1],
          year: nowYear,
          count: Math.max(0, currMonthNewReviews),
          isCurrent: true,
        },
      ];

      return {
        isConnected: true,
        rating: Math.round(rating * 10) / 10,
        reviewCount,
        recentReviews: [],
        dailyChange,
        monthlySummaries,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useGoogleAuth() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  const authorize = () => {
    // Redirect to Google auth endpoint
    window.location.href = `${supabaseUrl}/functions/v1/google-auth`;
  };

  const syncReviews = async () => {
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-google-reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  };

  return { authorize, syncReviews };
}

// =============================================
// Compliance
// =============================================

export function useCompliance() {
  return useQuery({
    queryKey: ['compliance'],
    queryFn: async (): Promise<ComplianceItem[]> => {
      const { data, error } = await supabase
        .from('compliance_items')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;

      return (data || []).map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        type: row.type as ComplianceItem['type'],
        status: row.status as ComplianceItem['status'],
        dueDate: row.due_date,
        completedAt: row.completed_at,
      }));
    },
    staleTime: 1000 * 60 * 10,
  });
}

// =============================================
// Monthly Performance
// =============================================

export interface MonthlyPerformanceData {
  /** YYYY-MM month key */
  monthKey: string;
  month: string;
  monthIndex: number;
  year: number;
  actualRevenue: number;
  targetRevenue: number;
  achievementPercent: number;
}

type MonthlyPerformanceRange = "tm" | "3m" | "6m" | "12m"

export function useMonthlyPerformance(range: MonthlyPerformanceRange = "6m") {
  return useQuery({
    queryKey: ['monthly-performance', range],
    queryFn: async (): Promise<MonthlyPerformanceData[]> => {
      const now = new Date();
      const monthsCount = range === "tm" ? 1 : range === "3m" ? 3 : range === "12m" ? 12 : 6

      // Build a month window that can cross year boundaries.
      const endMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const startMonthStart = addMonths(endMonthStart, -(monthsCount - 1))
      const startISO = formatLocalISODate(startMonthStart)
      const endISO = formatLocalISODate(now)

      // Actuals: sum daily revenue from Sales26-synced `daily_metrics` (falls back gracefully).
      const { data: metricsData, error } = await supabase
        .from('daily_metrics')
        .select('date, revenue')
        .gte('date', startISO)
        .lte('date', endISO)
        .order('date', { ascending: true })

      if (error) throw error

      const actualByMonthKey = new Map<string, number>()
      ;(metricsData || []).forEach((row: any) => {
        const monthKey = String(row.date).slice(0, 7) // YYYY-MM
        actualByMonthKey.set(monthKey, (actualByMonthKey.get(monthKey) || 0) + (row.revenue || 0))
      })

      // Targets: monthly revenue targets from Sales26 row 6, written into `targets` table.
      const { data: targetsData } = await supabase
        .from('targets')
        .select('target_value, period_start')
        .eq('metric', 'revenue')
        .eq('period', 'monthly')
        .gte('period_start', startISO)
        .lte('period_start', formatLocalISODate(endMonthStart))

      const targetByMonthKey = new Map<string, number>()
      ;(targetsData || []).forEach((t: any) => {
        const key = String(t.period_start).slice(0, 7)
        targetByMonthKey.set(key, Number(t.target_value) || 0)
      })

      // Fallback targets: pull from P&L budget (so last-6-months in Jan still has targets for Oct-Dec, etc.)
      const startYear = startMonthStart.getFullYear()
      const endYear = endMonthStart.getFullYear()
      const { data: pnlBudgetRows } = await supabase
        .from('pnl_monthly')
        .select('year, month, gross_sales, data_type')
        .eq('data_type', 'budget')
        .in('year', startYear === endYear ? [startYear] : [startYear, endYear])

      const pnlBudgetByMonthKey = new Map<string, number>()
      ;(pnlBudgetRows || []).forEach((row: any) => {
        const y = Number(row.year)
        const m = Number(row.month)
        if (!y || !m) return
        const key = `${y}-${String(m).padStart(2, "0")}`
        pnlBudgetByMonthKey.set(key, Number(row.gross_sales) || 0)
      })

      const result: MonthlyPerformanceData[] = []
      for (let i = 0; i < monthsCount; i++) {
        const d = addMonths(startMonthStart, i)
        const y = d.getFullYear()
        const m = d.getMonth() + 1
        const monthKey = `${y}-${String(m).padStart(2, "0")}`
        const actual = actualByMonthKey.get(monthKey) || 0
        const target = targetByMonthKey.get(monthKey) ?? pnlBudgetByMonthKey.get(monthKey) ?? 0

        result.push({
          monthKey,
          month: d.toLocaleDateString("en-US", { month: "short" }),
          monthIndex: m - 1,
          year: y,
          actualRevenue: actual,
          targetRevenue: target,
          achievementPercent: target > 0 ? Math.round((actual / target) * 100) : 0,
        })
      }

      return result
    },
    staleTime: 1000 * 60 * 5,
    // Keep previous range data visible while refetching to avoid full-card spinners.
    placeholderData: (prev) => prev,
  });
}

// =============================================
// Real-time Staffing
// =============================================

export interface StaffingSummary {
  activeStaff: number;
  totalRequired: number;
  coveragePercentage: number;
  guestStaffRatio: number;
  coverageGaps: { role: string; count: number }[];
}

export function useStaffing() {
  return useQuery({
    queryKey: ['staffing'],
    queryFn: async (): Promise<StaffingSummary> => {
      const today = new Date().toISOString().split('T')[0];

      // Get today's shifts
      const { data: shifts, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('shift_date', today);

      if (error) throw error;

      // Get today's metrics for guest count
      const { data: metrics } = await supabase
        .from('daily_metrics')
        .select('pax, staff_on_duty')
        .eq('date', today)
        .single();

      const activeShifts = (shifts || []).filter(
        (s) => s.status === 'in_progress' || s.status === 'scheduled'
      );
      const totalRequired = (shifts || []).filter(
        (s) => s.status !== 'cancelled'
      ).length;

      const activeStaff = activeShifts.filter((s) => s.status === 'in_progress').length;
      const pax = metrics?.pax || 0;

      // Find coverage gaps (scheduled but not started)
      const gaps: { role: string; count: number }[] = [];
      const scheduledNotStarted = activeShifts.filter((s) => s.status === 'scheduled');
      const roleGroups = scheduledNotStarted.reduce((acc, shift) => {
        acc[shift.role] = (acc[shift.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(roleGroups).forEach(([role, count]) => {
        gaps.push({ role, count: count as number });
      });

      return {
        activeStaff: metrics?.staff_on_duty || activeStaff || 4,
        totalRequired: totalRequired || 4,
        coveragePercentage: totalRequired > 0 ? Math.round((activeStaff / totalRequired) * 100) : 100,
        guestStaffRatio: activeStaff > 0 ? Math.round((pax / activeStaff) * 10) / 10 : 0,
        coverageGaps: gaps,
      };
    },
    staleTime: 1000 * 60, // 1 minute for real-time feel
  });
}
