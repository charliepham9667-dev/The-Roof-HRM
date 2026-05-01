import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Settings, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useKPISummary, useSyncStatus, MonthParam } from '../../hooks/useDashboardData';
import { WeeklySalesTrend } from './WeeklySalesTrend';
import { MonthlyPerformance } from './MonthlyPerformance';
import { TargetManager } from './TargetManager';
import { RevenueVelocity } from './RevenueVelocity';
import { ExecutiveSummary } from './ExecutiveSummary';
import { CashPositionPanel } from '@/components/finance/CashPositionPanel';
import { SupplierDebtPanel } from '@/components/finance/SupplierDebtPanel';
import { MonthlyPLTable } from '@/components/finance/MonthlyPLTable';
import { BAR_COLORS } from '@/lib/chart-colors';
import {
  Button,
  DashboardCard,
  DashboardCardContent,
  DashboardCardHeader,
  DashboardCardTitle,
  Separator,
  StatusBadge,
} from '@/components/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/ui/stat-card';

// Format large numbers for display
function formatVND(value: number): string {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B đ`;
  if (value >= 1000000) return `${Math.round(value / 1000000)}M đ`;
  if (value >= 1000) return `${Math.round(value / 1000)}K đ`;
  return `${value} đ`;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function MonthPicker({ selected, onChange }: { selected: MonthParam; onChange: (m: MonthParam) => void }) {
  const now = new Date();
  const isCurrentMonth = selected.year === now.getFullYear() && selected.month === now.getMonth();

  const prev = () => {
    if (selected.month === 0) onChange({ year: selected.year - 1, month: 11 });
    else onChange({ year: selected.year, month: selected.month - 1 });
  };
  const next = () => {
    if (isCurrentMonth) return;
    if (selected.month === 11) onChange({ year: selected.year + 1, month: 0 });
    else onChange({ year: selected.year, month: selected.month + 1 });
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-0.5 shadow-sm">
      <button onClick={prev} className="p-1 rounded hover:bg-muted transition-colors" aria-label="Previous month">
        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
      </button>
      <span className="text-sm font-medium text-foreground min-w-[130px] text-center select-none">
        {MONTH_NAMES[selected.month]} {selected.year}
        {isCurrentMonth && <span className="ml-1 text-xs text-primary font-normal">(current)</span>}
      </span>
      <button
        onClick={next}
        disabled={isCurrentMonth}
        className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}

export function OwnerOverview() {
  const [showTargetManager, setShowTargetManager] = useState(false);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<MonthParam>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  // ?tab=cash|debt deep-link support so the dashboard "Log Debt" quick action
  // and any old /finance/debt bookmarks can land on the right tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const cashTab = requestedTab === 'debt' ? 'debt' : 'cash';
  const handleCashTabChange = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'debt') params.set('tab', 'debt');
    else params.delete('tab');
    setSearchParams(params, { replace: true });
  };
  
  const { data: kpi, isLoading, error } = useKPISummary(selectedMonth);
  const { data: syncStatus } = useSyncStatus();

  const getGreetingMessage = () => {
    const isCurrentMonth = selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth();
    if (isCurrentMonth) {
      return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }
    return `Viewing ${MONTH_NAMES[selectedMonth.month]} ${selectedMonth.year}`;
  };

  const getSyncBadge = (): { variant: 'warning' | 'error' | 'success'; label: string } | null => {
    // Still loading — show nothing
    if (!syncStatus) return null;

    // No sync log records at all — suppress the badge (sync_logs table not in use)
    if (!syncStatus.lastSyncAt && syncStatus.status === null) return null;

    if (syncStatus.status === 'failed') {
      return { variant: 'error' as const, label: 'Sync Error' };
    }

    if (syncStatus.status === 'running' || syncStatus.status === 'pending') {
      return { variant: 'warning' as const, label: 'Syncing…' };
    }

    if (syncStatus.isStale) {
      return { variant: 'warning' as const, label: `Stale (${syncStatus.hoursAgo}h)` };
    }

    return { variant: 'success' as const, label: 'Data Synced' };
  };

  const syncBadge = getSyncBadge();
  const isCurrentMonth = selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth();
  const kpiTimeframeSubtext = isCurrentMonth
    ? "Month-to-date vs same period last year"
    : `${MONTH_NAMES[selectedMonth.month]} ${selectedMonth.year} vs same period last year`;
  const revenueSubtext = kpi?.targetMet.isOnTrack
    ? "On track to hit target"
    : "Needs to increase revenue to hit target";

  return (
    <div className="flex-1 space-y-4">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-foreground">Finance Summary</h1>
          <p className="mt-1 text-sm text-muted-foreground">{getGreetingMessage()}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthPicker selected={selectedMonth} onChange={setSelectedMonth} />
          {syncBadge && (
            <StatusBadge variant={syncBadge.variant} showIcon>
              {syncBadge.label}
            </StatusBadge>
          )}
        </div>
      </div>

      {/* KPI row (dashboard-01) */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="col-span-full rounded-lg border border-border bg-card p-6 text-center text-sm text-error">
            Failed to load KPIs. Check Supabase connection.
          </div>
        ) : (
          <>
            <StatCard
              mode="kpi"
              label="Total Revenue"
              value={formatVND(kpi?.revenue.value || 0)}
              trend={kpi?.revenue.trend ?? undefined}
              subtext={revenueSubtext}
            />
            <StatCard
              mode="kpi"
              label="Pax"
              value={(kpi?.pax.value || 0).toLocaleString()}
              trend={kpi?.pax.trend ?? undefined}
              subtext={kpiTimeframeSubtext}
            />
            <StatCard
              mode="kpi"
              label="Avg Spend"
              value={formatVND(kpi?.avgSpend.value || 0)}
              trend={kpi?.avgSpend.trend ?? undefined}
              subtext={kpiTimeframeSubtext}
            />
            <TargetMetCard
              percentage={kpi?.targetMet.percentage || 0}
              isOnTrack={kpi?.targetMet.isOnTrack || false}
              onEdit={() => setShowTargetManager(true)}
            />
          </>
        )}
      </div>

      {/* Charts row (shadcn dashboard layout) */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-4">
        <DashboardCard className="lg:col-span-4 h-auto md:h-[430px] !overflow-visible">
          <DashboardCardContent className="pt-6">
            <WeeklySalesTrend noContainer />
          </DashboardCardContent>
        </DashboardCard>
      </div>

      {/* Executive Summary + Monthly Performance row */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <DashboardCard className="w-full lg:flex-[7]">
          <DashboardCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DashboardCardTitle className="text-sm font-medium">Executive Summary</DashboardCardTitle>
          </DashboardCardHeader>
          <DashboardCardContent>
            <ExecutiveSummaryPanel noContainer selectedMonth={selectedMonth} />
          </DashboardCardContent>
        </DashboardCard>

        <DashboardCard className="w-full lg:flex-[3] flex flex-col shadow-[0px_2px_3px_0px_rgba(0,0,0,0.15)] min-h-[300px]">
          <DashboardCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DashboardCardTitle className="text-sm font-medium">Monthly Performance</DashboardCardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </DashboardCardHeader>
          <DashboardCardContent className="flex-1">
            <MonthlyPerformance noContainer />
          </DashboardCardContent>
        </DashboardCard>
      </div>

      {/* Cash Position + Debt Tracker tabs — daily-ish snapshot from accountant */}
      <Tabs value={cashTab} onValueChange={handleCashTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="cash">Cash Position</TabsTrigger>
          <TabsTrigger value="debt">Debt Tracker</TabsTrigger>
        </TabsList>
        <TabsContent value="cash" className="mt-3">
          <CashPositionPanel />
        </TabsContent>
        <TabsContent value="debt" className="mt-3">
          <SupplierDebtPanel />
        </TabsContent>
      </Tabs>

      {/* Full-year monthly P&L table — Jan…Dec + YTD across key lines */}
      <MonthlyPLTable />

      {/* Target Manager Modal */}
      <TargetManager isOpen={showTargetManager} onClose={() => setShowTargetManager(false)} />
    </div>
  );
}

// Target Met card with circular progress indicator
function TargetMetCard({ percentage, isOnTrack, onEdit }: { percentage: number; isOnTrack: boolean; onEdit: () => void }) {
  const clamped = Math.max(0, Math.min(percentage, 100));
  const remaining = 100 - clamped;
  const fillColor = isOnTrack ? BAR_COLORS.current : BAR_COLORS.previous;

  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-card" style={{ margin: 0 }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground mb-1">Target Met</p>
        <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8 -mt-1 -mr-1" title="Manage targets">
          <Settings className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <div className="mt-2 space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-2xl font-bold text-foreground">{isOnTrack ? "On Track" : "Behind"}</p>
          <p className="text-sm font-mono font-medium tabular-nums text-muted-foreground">{clamped}%</p>
        </div>

        {/* Horizontal stacked bar (completed vs remaining) */}
        <div
          className="h-3 w-full overflow-hidden rounded-full border border-border/60 bg-background"
          role="img"
          aria-label={`${clamped}% target met`}
          title={`${clamped}% target met`}
        >
          <div className="flex h-full w-full">
            <div
              style={{ width: `${clamped}%`, backgroundColor: fillColor }}
              className="h-full"
            />
            <div
              style={{ width: `${remaining}%`, backgroundColor: BAR_COLORS.target }}
              className="h-full opacity-30"
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">Target progress</p>
      </div>
    </div>
  );
}

function ExecutiveSummaryPanel({ noContainer, selectedMonth }: { noContainer?: boolean; selectedMonth?: MonthParam }) {
  return (
    <div className={noContainer ? 'space-y-4' : undefined}>
      <RevenueVelocity noContainer={noContainer} selectedMonth={selectedMonth} />
      <Separator />
      <ExecutiveSummary noContainer={noContainer} selectedMonth={selectedMonth} />
    </div>
  );
}
