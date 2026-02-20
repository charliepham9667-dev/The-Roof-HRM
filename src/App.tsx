import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleGuard } from './components/auth/RoleGuard';
import { ThemeProvider } from '@/components/theme-provider';
import { useAuthStore } from './stores/authStore';

// Auth pages
import { Login } from './pages/auth/Login';
import { PendingApproval } from './pages/auth/PendingApproval';

// Owner pages
import { Dashboard } from './pages/owner/Dashboard';
import { Staffing } from './pages/owner/Staffing';
import { Alerts } from './pages/owner/Alerts';
import { WeeklyFocus } from './pages/owner/WeeklyFocus';
import { MyDashboard } from './pages/owner/MyDashboard';
import { WorkforceOverview } from './pages/owner/WorkforceOverview';
import { ManagerPerformance } from './pages/owner/ManagerPerformance';
import { TaskDelegation } from './pages/owner/TaskDelegation';
import { TeamDirectory } from './pages/owner/TeamDirectory';
import { Calendar } from './pages/owner/Calendar';
import { Resources } from './pages/owner/Resources';
import { OrgChart } from './pages/owner/OrgChart';
import { EmployeeDetail } from "@/pages/team/EmployeeDetail"

// Finance pages
import { PLPerformance } from './pages/finance/PLPerformance';
import { ReportBuilder } from './pages/finance/ReportBuilder';
import { CategoryDrilldown } from './pages/finance/CategoryDrilldown';
import { CashFlow } from './pages/finance/CashFlow';
import { CostControl } from './pages/finance/CostControl';
import { Forecast } from './pages/finance/Forecast';
import { FinancialSummary } from './pages/finance/FinancialSummary';

// Staff pages
import { StaffDashboard } from './pages/staff/StaffDashboard';
import { MyShifts } from './pages/staff/MyShifts';
import { Profile } from './pages/staff/Profile';
import { Tasks } from './pages/staff/Tasks';
import { Leave } from './pages/staff/Leave';
import { Payslips } from './pages/staff/Payslips';
import { CheckIn } from './pages/staff/CheckIn';

// Manager pages
import { ManagerDashboard, Reservations, LeaveApproval, Announcements } from './pages/manager';
import { ShiftSummary } from './pages/manager/ShiftSummary';
import { Promotions } from './pages/manager/Promotions';
import { Events } from './pages/manager/Events';
import { ScheduleBuilder } from './pages/manager/ScheduleBuilder';
import { Incidents } from './pages/manager/Incidents';
import { Onboarding } from './pages/manager/Onboarding';
import { ManagerMyTasks } from './pages/manager/MyTasks';
import { StaffMyTasks } from './pages/staff/MyTasks';
import { ManageChecklists } from './pages/manager/ManageChecklists';
import { FloorIssues } from './pages/manager/FloorIssues';
import { ManagerCalendar } from './pages/manager/Calendar';
import { StaffCalendar } from './pages/staff/Calendar';

// Venue & Wishlist pages
import { VenueManager } from './pages/owner/VenueManager';
import { Wishlist } from './pages/owner/Wishlist';

// Admin pages
import { SyncData } from './pages/admin/SyncData';

// Common pages
import { AnnouncementsFeed, AnnouncementDetail } from './pages/common/AnnouncementsFeed';
import { ResourcesHub } from './pages/common/ResourcesHub';
import { KnowledgeBase } from './pages/common/KnowledgeBase';
import DesignSystemPage from './pages/DesignSystem';

// Settings pages
import { PermissionsSettings } from './pages/settings/Permissions';
import { RolesSettings } from './pages/settings/Roles';
import { SOPSettings } from './pages/settings/SOPs';
import Settings from '@/pages/Settings';

// Marketing pages
import DJSchedule from '@/pages/marketing/DJSchedule';
import ContentCalendar from '@/pages/marketing/ContentCalendar';
import MarketingDashboard from '@/pages/marketing/MarketingDashboard';

/**
 * Smart dashboard redirect based on role
 * Owners → Executive Dashboard
 * Managers → Manager Dashboard
 * Staff → Staff Dashboard
 */
function DashboardRedirect() {
  const profile = useAuthStore((s) => s.profile);
  const viewAs = useAuthStore((s) => s.viewAs);
  
  const effectiveRole = viewAs?.role || profile?.role;
  
  if (effectiveRole === 'staff') {
    return <StaffDashboard />;
  }
  if (effectiveRole === 'manager') {
    return <ManagerDashboard />;
  }
  // Owners: land on Executive Dashboard
  return <Navigate to="/owner/dashboard" replace />;
}

/**
 * Main App Component
 */
export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
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
              <Calendar />
            </RoleGuard>
          } />
          <Route path="owner/resources" element={
            <RoleGuard allowedRoles={['owner']}>
              <Resources />
            </RoleGuard>
          } />
          <Route path="owner/announcements" element={
            <RoleGuard allowedRoles={['owner']}>
              <AnnouncementsFeed />
            </RoleGuard>
          } />
          <Route path="owner/schedule" element={
            <RoleGuard allowedRoles={['owner']}>
              <ScheduleBuilder />
            </RoleGuard>
          } />
          <Route path="owner/checklists" element={
            <RoleGuard allowedRoles={['owner']}>
              <ManageChecklists />
            </RoleGuard>
          } />
          <Route path="owner/venue-calendar" element={
            <RoleGuard allowedRoles={['owner']}>
              <ManagerCalendar />
            </RoleGuard>
          } />
          <Route path="owner/venue" element={
            <RoleGuard allowedRoles={['owner', 'manager', 'staff']}>
              <VenueManager />
            </RoleGuard>
          } />
          <Route path="owner/wishlist" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <Wishlist />
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

          {/* ============================================ */}
          {/* MANAGER ROUTES (Owner & Manager) */}
          {/* ============================================ */}
          <Route path="manager/venue" element={
            <RoleGuard allowedRoles={['owner', 'manager', 'staff']}>
              <VenueManager />
            </RoleGuard>
          } />
          <Route path="manager/operations" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <Wishlist />
            </RoleGuard>
          } />
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
          <Route path="manager/announcements" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <Announcements />
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
          <Route path="manager/checklists" element={
            <RoleGuard allowedRoles={['owner', 'manager']}>
              <ManageChecklists />
            </RoleGuard>
          } />
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
          <Route path="staff/checklists" element={<Tasks />} />
          <Route path="checklists" element={<Navigate to="/staff/checklists" replace />} />
          <Route path="staff/tasks" element={<StaffMyTasks />} />
          <Route path="tasks" element={<Navigate to="/staff/tasks" replace />} />
          <Route path="staff/leave" element={<Leave />} />
          <Route path="leave" element={<Navigate to="/staff/leave" replace />} />
          <Route path="staff/resources" element={<ResourcesHub />} />
          <Route path="staff/announcements" element={<AnnouncementsFeed />} />

          {/* ============================================ */}
          {/* COMMON ROUTES (All authenticated users) */}
          {/* ============================================ */}
          <Route path="announcements" element={<AnnouncementsFeed />} />
          <Route path="announcements/:id" element={<AnnouncementDetail />} />
          <Route path="chat" element={<Navigate to="/announcements?tab=chat" replace />} />
          <Route path="resources" element={<ResourcesHub />} />
          <Route path="calendar" element={<Navigate to="/manager/calendar" replace />} />
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
    </ThemeProvider>
  );
}