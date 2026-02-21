import { Outlet, useNavigate } from 'react-router-dom';
import { Eye, X } from 'lucide-react';
import { Header } from './Header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { RoleSidebar07 } from './RoleSidebar07';
import { useAuthStore } from '@/stores/authStore';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
};

const MANAGER_TYPE_LABELS: Record<string, string> = {
  floor: 'Floor Manager',
  bar: 'Bar Manager',
  marketing: 'Marketing Manager',
};

function ViewAsPreviewBanner() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const viewAs = useAuthStore((s) => s.viewAs);
  const setViewAs = useAuthStore((s) => s.setViewAs);

  // Only show when an owner is previewing a non-owner role
  if (!profile || profile.role !== 'owner' || !viewAs || viewAs.role === 'owner') {
    return null;
  }

  const roleLabel =
    viewAs.role === 'manager' && viewAs.managerType
      ? MANAGER_TYPE_LABELS[viewAs.managerType] ?? 'Manager'
      : ROLE_LABELS[viewAs.role] ?? viewAs.role;

  const handleExit = () => {
    setViewAs(null);
    navigate('/owner/dashboard', { replace: true });
  };

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-300/60 bg-amber-50 px-4 py-2 dark:border-amber-700/40 dark:bg-amber-950/40">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
        <Eye className="h-4 w-4 shrink-0" />
        <span>
          Previewing as: <span className="font-semibold">{roleLabel}</span>
          <span className="ml-2 font-normal text-amber-700/80 dark:text-amber-400/80">
            — This is a read-only preview
          </span>
        </span>
      </div>
      <button
        onClick={handleExit}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900"
      >
        <X className="h-3 w-3" />
        Exit Preview
      </button>
    </div>
  );
}

/**
 * DashboardLayout - Main application shell
 * 
 * Provides:
 * - Sidebar navigation (role-based)
 * - Header with user menu
 * - Main content area with Outlet
 * 
 * Note: Auth initialization is handled by ProtectedRoute,
 * so we don't need to call initialize() here.
 */
export function DashboardLayout() {
  return (
    <SidebarProvider defaultOpen>
      <RoleSidebar07 />
      <SidebarInset className="min-w-0">
        <Header />
        <ViewAsPreviewBanner />
        <main className="flex-1 min-w-0 overflow-y-auto bg-background px-4 py-4 md:px-6 md:py-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default DashboardLayout;