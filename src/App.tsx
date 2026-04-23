import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleGuard } from './components/auth/RoleGuard';
import { ThemeProvider } from '@/components/theme-provider';
import { useAuthStore } from './stores/authStore';

// Auth pages
import { Login } from './pages/auth/Login';
import { PendingApproval } from './pages/auth/PendingApproval';

// Owner pages (lazy load heaviest)
const Dashboard = lazy(() => import('./pages/owner/Dashboard').then((m) => ({ default: m.Dashboard })));
import { CompanyProfile } from './pages/owner/CompanyProfile';
import { Staffing } from './pages/owner/Staffing';
import { Alerts } from './pages/owner/Alerts';
import { WeeklyFocus } from './pages/owner/WeeklyFocus';
import { MyDashboard } from './pages/owner/MyDashboard';
import { WorkforceOverview } from './pages/owner/WorkforceOverview';
import { ManagerPerformance } from './pages/owner/ManagerPerformance';
import { TaskDelegation } from './pages/owner/TaskDelegation';
import { TeamDirectory } from './pages/owner/TeamDirectory';
import { Resources } from './pages/owner/Resources';
import { OrgChart } from './pages/owner/OrgChart';
import { EmployeeDetail } from "@/pages/team/EmployeeDetail"
const OwnerCalendar = lazy(() => import('./pages/owner/Calendar').then((m) => ({ default: m.Calendar })));

// Finance pages
import { PLPerformance } from './pages/finance/PLPerformance';
import { ReportBuilder } from './pages/finance/ReportBuilder';
import { CategoryDrilldown } from './pages/finance/CategoryDrilldown';
import { CashFlow } from './pages/finance/CashFlow';
import { CostControl } from './pages/finance/CostControl';
import { Forecast } from './pages/finance/Forecast';
import { FinancialSummary } from './pages/finance/FinancialSummary';
import { SupplierDebt } from './pages/finance/SupplierDebt';

// Staff pages
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard').then((m) => ({ default: m.StaffDashboard })));
const MyShifts = lazy(() => import('./pages/staff/MyShifts').then((m) => ({ default: m.MyShifts })));
const Profile = lazy(() => import('./pages/staff/Profile').then((m) => ({ default: m.Profile })));
const Leave = lazy(() => import('./pages/staff/Leave').then((m) => ({ default: m.Leave })));
const Payslips = lazy(() => import('./pages/staff/Payslips').then((m) => ({ default: m.Payslips })));
const CheckIn = lazy(() => import('./pages/staff/CheckIn').then((m) => ({ default: m.CheckIn })));

// Manager pages (lazy load heaviest)
const ManagerDashboard = lazy(() => import('./pages/manager').then((m) => ({ default: m.ManagerDashboard })));
import { Reservations, LeaveApproval } from './pages/manager';
import { ShiftSummary } from './pages/manager/ShiftSummary';
import { Promotions } from './pages/manager/Promotions';
import { Events } from './pages/manager/Events';
const ScheduleBuilder = lazy(() => import('./pages/manager/ScheduleBuilder').then((m) => ({ default: m.ScheduleBuilder })));
import { Incidents } from './pages/manager/Incidents';
import { Onboarding } from './pages/manager/Onboarding';
import { ManagerMyTasks } from './pages/manager/MyTasks';
const StaffMyTasks = lazy(() => import('./pages/staff/MyTasks').then((m) => ({ default: m.StaffMyTasks })));
import { FloorIssues } from './pages/manager/FloorIssues';
import { ManagerCalendar } from './pages/manager/Calendar';
import { StaffCalendar } from './pages/staff/Calendar';

// Venue & Wishlist pages
const VenueManager = lazy(() => import('./pages/owner/VenueManager').then((m) => ({ default: m.VenueManager })));
const Wishlist = lazy(() => import('./pages/owner/Wishlist').then((m) => ({ default: m.Wishlist })));

// Admin pages
const SyncData = lazy(() => import('./pages/admin/SyncData').then((m) => ({ default: m.SyncData })));

// Common pages
const ResourcesHub = lazy(() => import('./pages/common/ResourcesHub').then((m) => ({ default: m.ResourcesHub })));
const KnowledgeBase = lazy(() => import('./pages/common/KnowledgeBase').then((m) => ({ default: m.KnowledgeBase })));
import DesignSystemPage from './pages/DesignSystem';

// Settings pages
import { PermissionsSettings } from './pages/settings/Permissions';
import { RolesSettings } from './pages/settings/Roles';
import { SOPSettings } from './pages/settings/SOPs';
import Settings from '@/pages/Settings';

// Marketing pages
const DJSchedule = lazy(() => import('@/pages/marketing/DJSchedule'));
const ContentCalendar = lazy(() => import('@/pages/marketing/ContentCalendar'));
const MarketingDashboard = lazy(() => import('@/pages/marketing/MarketingDashboard'));
const MarketingPlans = lazy(() => import('@/pages/marketing/MarketingPlans'));
const AdsIntegrations = lazy(() => import('@/pages/marketing/AdsIntegrations'));

/**
 * Smart dashboard redirect based on role
 * Owners → /owner/dashboard
 * Managers → /manager/dashboard
 * Staff → /staff/dashboard
 */
function DashboardRedirect() {
  const profile = useAuthStore((s) => s.profile);
  const viewAs = useAuthStore((s) => s.viewAs);
  const initialized = useAuthStore((s) => s.initialized);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const retryProfile = useAuthStore((s) => s.retryProfile);

  // Profile fetch failed — show error with retry instead of infinite loading
  if (initialized && !isLoading && !profile && error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => retryProfile()}
            disabled={isLoading}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {isLoading ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      </div>
    );
  }

  // Still initialising auth or fetching profile — show a spinner
  if (!initialized || isLoading || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-xs text-muted-foreground">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  const effectiveRole = viewAs?.role || profile.role;

  if (effectiveRole === 'staff') {
    return <Navigate to="/staff/dashboard" replace />;
  }
  if (effectiveRole === 'manager') {
    return <Navigate to="/manager/dashboard" replace />;
  }
  return <Navigate to="/owner/dashboard" replace />;
}

function CalendarRedirect() {
  const profile = useAuthStore((s) => s.profile);
  const viewAs = useAuthStore((s) => s.viewAs);

  const effectiveRole = viewAs?.role || profile?.role;
  if (effectiveRole === 'staff') return <Navigate to="/staff/calendar" replace />;
  if (effectiveRole === 'manager') return <Navigate to="/manager/calendar" replace />;
  return <Navigate to="/owner/calendar" replace />;
}

/**
 * Main App Component
 */
export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        }
      >
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/pending-approval" element={<PendingApproval />} />
        
        {/* Protected routes - wrapped in ProtectedRoute + DashboardLayout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* Smart Dashboard - shows role-appropriate view */}
          <Route index element={<DashboardRedirect />} />

          {/* ============================================ */}
          {/* OWNER ROUTES */}
          {/* ============================================ */}
          <Route path="owner/dashboard" element={
            <RoleGuard allowedRoles={['owner']}>
              <Dashboard />
            </RoleGuard>
          } />
          <Route path="owner/my-dashboard" element={
            <RoleGuard allowedRoles={['owner']}>
              <MyDashboard />
            </RoleGuard>
          } />
          <Route path="owner/alerts" element={
            <RoleGuard allowedRoles={['owner']}>
              <Alerts />
            </RoleGuard>
          } />
          <Route path="owner/tasks" element={
            <RoleGuard allowedRoles={['owner']}>
              <TaskDelegation />
            </RoleGuard>
          } />
          <Route path="owner/team-directory" element={
            <RoleGuard allowedRoles={['owner']}>
              <TeamDirectory />
            </RoleGuard>
          } />
          <Route path="team/:userId" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <EmployeeDetail />
            </RoleGuard>
          } />
          <Route path="owner/org-chart" element={
            <RoleGuard allowedRoles={['owner']}>
              <OrgChart />
            </RoleGuard>
          } />
          <Route path="owner/workforce" element={
            <RoleGuard allowedRoles={['owner']}>
              <WorkforceOverview />
            </RoleGuard>
          } />
          <Route path="owner/calendar" element={
            <RoleGuard allowedRoles={['owner']}>
              <OwnerCalendar />
            </RoleGuard>
          } />
          <Route path="owner/resources" element={
            <RoleGuard allowedRoles={['owner']}>
              <Resources />
            </RoleGuard>
          } />
          <Route path="owner/schedule" element={
            <RoleGuard allowedRoles={['owner']}>
              <ScheduleBuilder />
            </RoleGuard>
          } />
          <Route path="owner/announcements" element={<Navigate to="/owner/resources" replace />} />
          <Route path="owner/checklists" element={<Navigate to="/owner/tasks" replace />} />
          <Route path="venue" element={
            <RoleGuard allowedRoles={['owner', 'manager', 'staff']}>
              <VenueManager />
            </RoleGuard>
          } />
          <Route path="owner/venue" element={<Navigate to="/venue" replace />} />
          <Route path="operations" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <Wishlist />
            </RoleGuard>
          } />
          <Route path="owner/wishlist" element={<Navigate to="/operations" replace />} />
          <Route path="owner/company" element={
            <RoleGuard allowedRoles={['owner']}>
              <CompanyProfile />
            </RoleGuard>
          } />
          <Route path="weekly-focus" element={
            <RoleGuard allowedRoles={['owner']}>
              <WeeklyFocus />
            </RoleGuard>
          } />

          {/* ============================================ */}
          {/* FINANCE ROUTES (Owner only) */}
          {/* ============================================ */}
          <Route path="finance/summary" element={
            <RoleGuard allowedRoles={['owner']}>
              <FinancialSummary />
            </RoleGuard>
          } />
          <Route path="finance/pl" element={
            <RoleGuard allowedRoles={['owner']}>
              <PLPerformance />
            </RoleGuard>
          } />
          <Route path="finance/reports" element={
            <RoleGuard allowedRoles={['owner']}>
              <ReportBuilder />
            </RoleGuard>
          } />
          <Route path="finance/category" element={
            <RoleGuard allowedRoles={['owner']}>
              <CategoryDrilldown />
            </RoleGuard>
          } />
          <Route path="finance/cashflow" element={
            <RoleGuard allowedRoles={['owner']}>
              <CashFlow />
            </RoleGuard>
          } />
          <Route path="finance/costs" element={
            <RoleGuard allowedRoles={['owner']}>
              <CostControl />
            </RoleGuard>
          } />
          <Route path="finance/forecast" element={
            <RoleGuard allowedRoles={['owner']}>
              <Forecast />
            </RoleGuard>
          } />
          <Route path="finance/debt" element={
            <RoleGuard allowedRoles={['owner']}>
              <SupplierDebt />
            </RoleGuard>
          } />

          {/* ============================================ */}
          {/* MANAGER ROUTES (Owner & Manager) */}
          {/* ============================================ */}
          <Route path="manager/venue" element={<Navigate to="/venue" replace />} />
          <Route path="manager/operations" element={<Navigate to="/operations" replace />} />
          <Route path="manager/dashboard" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <ManagerDashboard />
            </RoleGuard>
          } />
          <Route path="manager/reservations" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <Reservations />
            </RoleGuard>
          } />
          <Route path="manager/leave" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <LeaveApproval />
            </RoleGuard>
          } />
          <Route path="manager/shift-summary" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <ShiftSummary />
            </RoleGuard>
          } />
          <Route path="manager/promotions" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <Promotions />
            </RoleGuard>
          } />
          <Route path="manager/events" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <Events />
            </RoleGuard>
          } />
          <Route path="manager/schedule" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <ScheduleBuilder />
            </RoleGuard>
          } />
          <Route path="manager/incidents" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <Incidents />
            </RoleGuard>
          } />
          <Route path="manager/onboarding" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <Onboarding />
            </RoleGuard>
          } />
          <Route path="manager/tasks" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <ManagerMyTasks />
            </RoleGuard>
          } />
          <Route path="manager/announcements" element={<Navigate to="/manager/resources" replace />} />
          <Route path="manager/checklists" element={<Navigate to="/manager/tasks" replace />} />
          <Route path="manager/floor-issues" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <FloorIssues />
            </RoleGuard>
          } />
          <Route path="manager/calendar" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <ManagerCalendar />
            </RoleGuard>
          } />
          <Route path="manager/resources" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <ResourcesHub />
            </RoleGuard>
          } />
          <Route path="manager/check-in" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <CheckIn />
            </RoleGuard>
          } />
          <Route path="manager/my-shifts" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <MyShifts />
            </RoleGuard>
          } />

          {/* ============================================ */}
          {/* OPS ROUTES (Owner & Manager) */}
          {/* ============================================ */}
          <Route path="ops/workforce" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <WorkforceOverview />
            </RoleGuard>
          } />
          <Route path="ops/staffing" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <Staffing />
            </RoleGuard>
          } />
          <Route path="ops/managers" element={
            <RoleGuard allowedRoles={['owner']}>
              <ManagerPerformance />
            </RoleGuard>
          } />
          <Route path="alerts" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <Alerts />
            </RoleGuard>
          } />

          {/* ============================================ */}
          {/* STAFF ROUTES (All authenticated users) */}
          {/* ============================================ */}
          <Route path="staff/dashboard" element={<StaffDashboard />} />
          <Route path="staff/payslips" element={<Payslips />} />
          <Route path="staff/check-in" element={<CheckIn />} />
          <Route path="check-in" element={<Navigate to="/staff/check-in" replace />} />
          <Route path="staff/my-shifts" element={<MyShifts />} />
          <Route path="my-shifts" element={<Navigate to="/staff/my-shifts" replace />} />
          <Route path="staff/calendar" element={<StaffCalendar />} />
          <Route path="staff/profile" element={<Profile />} />
          <Route path="profile" element={<Navigate to="/staff/profile" replace />} />
          <Route path="staff/tasks" element={<StaffMyTasks />} />
          <Route path="tasks" element={<Navigate to="/staff/tasks" replace />} />
          <Route path="staff/checklists" element={<Navigate to="/staff/tasks" replace />} />
          <Route path="staff/announcements" element={<Navigate to="/staff/resources" replace />} />
          <Route path="staff/leave" element={<Leave />} />
          <Route path="leave" element={<Navigate to="/staff/leave" replace />} />
          <Route path="staff/resources" element={<ResourcesHub />} />

          {/* ============================================ */}
          {/* COMMON ROUTES (All authenticated users) */}
          {/* ============================================ */}
          <Route path="announcements" element={<Navigate to="/resources" replace />} />
          <Route path="announcements/:id" element={<Navigate to="/resources" replace />} />
          <Route path="chat" element={<Navigate to="/resources" replace />} />
          <Route path="checklists" element={<Navigate to="/tasks" replace />} />
          <Route path="resources" element={<ResourcesHub />} />
          <Route path="calendar" element={<CalendarRedirect />} />
          <Route path="kb" element={<KnowledgeBase />} />
          <Route path="design-system" element={<DesignSystemPage />} />

          {/* ============================================ */}
          {/* MARKETING ROUTES (Owner only) */}
          {/* ============================================ */}
          <Route path="marketing/dashboard" element={
            <RoleGuard allowedRoles={['owner', 'manager']} allowedManagerTypes={['marketing']}>
              <MarketingDashboard />
            </RoleGuard>
          } />
          <Route path="marketing/dj-schedule" element={
            <RoleGuard allowedRoles={['owner']}>
              <DJSchedule />
            </RoleGuard>
          } />
          <Route path="marketing/content-calendar" element={
            <RoleGuard allowedRoles={['owner', 'manager']} allowedManagerTypes={['marketing']}>
              <ContentCalendar />
            </RoleGuard>
          } />
          <Route path="marketing/plans" element={
            <RoleGuard allowedRoles={['owner', 'manager']} allowedManagerTypes={['marketing']}>
              <MarketingPlans />
            </RoleGuard>
          } />
          <Route path="marketing/integrations" element={
            <RoleGuard allowedRoles={['owner', 'manager']} allowedManagerTypes={['marketing']}>
              <AdsIntegrations />
            </RoleGuard>
          } />
          <Route path="marketing/schedule" element={
            <RoleGuard allowedRoles={['owner', 'manager']} allowedManagerTypes={['marketing']}>
              <ScheduleBuilder />
            </RoleGuard>
          } />
          <Route path="marketing/tasks" element={
            <RoleGuard allowedRoles={['owner', 'manager']} allowedManagerTypes={['marketing']}>
              <ManagerMyTasks />
            </RoleGuard>
          } />

          {/* ============================================ */}
          {/* ADMIN ROUTES (Owner only) */}
          {/* ============================================ */}
          <Route path="admin/sync" element={
            <RoleGuard allowedRoles={['owner']}>
              <SyncData />
            </RoleGuard>
          } />
          <Route path="settings" element={
            <RoleGuard allowedRoles={['owner']}>
              <Settings />
            </RoleGuard>
          } />
          <Route path="settings/permissions" element={
            <RoleGuard allowedRoles={['owner']}>
              <PermissionsSettings />
            </RoleGuard>
          } />
          <Route path="settings/roles" element={
            <RoleGuard allowedRoles={['owner']}>
              <RolesSettings />
            </RoleGuard>
          } />
          <Route path="settings/sops" element={
            <RoleGuard allowedRoles={['owner']}>
              <SOPSettings />
            </RoleGuard>
          } />
        </Route>
      </Routes>
      </Suspense>
    </ThemeProvider>
  );
}