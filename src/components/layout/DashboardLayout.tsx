import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { RoleSidebar07 } from './RoleSidebar07';

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
      <SidebarInset>
        <Header />
        <main className="flex-1 overflow-y-auto bg-background rounded-t-none rounded-b-card shadow-card px-4 py-4 md:px-6 md:py-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default DashboardLayout;