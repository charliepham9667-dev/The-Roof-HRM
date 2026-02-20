import { Settings, Search, LogOut, ChevronRight, Home } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { NotificationBell } from '../common/NotificationBell';
import { SidebarTrigger } from '@/components/ui';
import { ModeToggle } from '@/components/mode-toggle';
import { useNavigate, useLocation } from 'react-router-dom';

interface HeaderProps {
  /** Deprecated: sidebar trigger is now handled by shadcn SidebarTrigger */
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const signOut = useAuthStore((s) => s.signOut);
  const viewAs = useAuthStore((s) => s.viewAs);
  const profile = useAuthStore((s) => s.profile);
  const navigate = useNavigate();
  const location = useLocation();

  const actualRole = profile?.role;

  // Derive context role: explicit viewAs > path prefix (for owners) > actual role
  const pathPrefix = location.pathname.startsWith('/manager') ? 'manager'
    : location.pathname.startsWith('/staff') ? 'staff'
    : location.pathname.startsWith('/owner') ? 'owner'
    : null;
  const effectiveRole =
    viewAs?.role ?? (actualRole === 'owner' && pathPrefix ? pathPrefix : actualRole);

  const dashboardLabel =
    effectiveRole === 'manager' ? 'Manager Dashboard' :
    effectiveRole === 'staff'   ? 'Staff Dashboard'   :
    'Owner Dashboard';

  return (
    <header className="flex h-14 md:h-16 items-center justify-between border-b border-[#dad4c8] bg-card/97 px-4 md:px-6 rounded-t-card shadow-none">
      {/* Left side: Menu button (mobile) + Breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Sidebar trigger - visible on mobile only */}
        <SidebarTrigger className="lg:hidden" onClick={onMenuClick} />
        
        {/* Breadcrumb - hidden on mobile, visible on md+ */}
        <div className="hidden md:flex items-center gap-2 text-sm">
          <Home className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Home</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          {/* Hide middle breadcrumb on tablet, show on lg+ */}
          <span className="hidden lg:inline text-muted-foreground">{dashboardLabel}</span>
          <ChevronRight className="hidden lg:inline h-4 w-4 text-muted-foreground" />
          <span className="text-foreground">Command Center</span>
        </div>
        
        {/* Mobile title - visible on mobile only */}
        <span className="md:hidden text-foreground font-medium">The Roof</span>
      </div>

      {/* Search - hidden on mobile, visible on md+ */}
      <div className="hidden md:block flex-1 max-w-md mx-4 lg:mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search employees, shifts, tasks..."
            className="w-full rounded-lg border border-input bg-card py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Theme toggle */}
        <ModeToggle />

        {/* Notifications */}
        <NotificationBell />

        {/* Settings - hidden on mobile */}
        <button
          onClick={() => navigate('/settings')}
          className="hidden sm:block rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Settings className="h-5 w-5" />
        </button>

        {/* Logout */}
        <button
          onClick={signOut}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
