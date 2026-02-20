import { useState, useRef, useEffect } from 'react';
import { Settings, Search, LogOut, ChevronRight, Home, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { NotificationBell } from '../common/NotificationBell';
import { SidebarTrigger } from '@/components/ui';
import { ModeToggle } from '@/components/mode-toggle';
import { useNavigate, useLocation } from 'react-router-dom';

// Map pathname → [section, page] breadcrumb labels
const BREADCRUMB_MAP: Record<string, [string, string]> = {
  // Owner
  'owner/dashboard':      ['Owner',     'Executive Dashboard'],
  'owner/my-dashboard':   ['Owner',     'My Dashboard'],
  'owner/alerts':         ['Owner',     'Alerts'],
  'owner/tasks':          ['Owner',     'Task Delegation'],
  'owner/team-directory': ['Team',      'Team Overview'],
  'owner/org-chart':      ['Team',      'Org Chart'],
  'owner/workforce':      ['Team',      'Workforce Overview'],
  'owner/calendar':       ['Owner',     'Calendar'],
  'owner/venue-calendar': ['Venue',     'Venue Calendar'],
  'owner/venue':          ['Venue',     'Venue Manager'],
  'owner/wishlist':       ['Operations','Operations'],
  'owner/resources':      ['Common',    'Resources'],
  'owner/announcements':  ['Common',    'Announcements'],
  'owner/schedule':       ['Team',      'Schedule'],
  'owner/checklists':     ['Owner',     'Checklists'],
  'weekly-focus':         ['Owner',     'Weekly Focus'],
  // Finance
  'finance/summary':      ['Finance',   'Financial Summary'],
  'finance/pl':           ['Finance',   'P&L Performance'],
  'finance/reports':      ['Finance',   'Report Builder'],
  'finance/category':     ['Finance',   'Category Drilldown'],
  'finance/cashflow':     ['Finance',   'Cash Flow'],
  'finance/costs':        ['Finance',   'Cost Control'],
  'finance/forecast':     ['Finance',   'Forecast'],
  // Manager
  'manager/dashboard':    ['Manager',   'Dashboard'],
  'manager/venue':        ['Venue',     'Venue Manager'],
  'manager/operations':   ['Operations','Operations'],
  'manager/reservations': ['Manager',   'Reservations'],
  'manager/leave':        ['Team',      'Leave Approval'],
  'manager/announcements':['Common',    'Announcements'],
  'manager/shift-summary':['Team',      'Shift Summary'],
  'manager/promotions':   ['Manager',   'Promotions'],
  'manager/events':       ['Manager',   'Events'],
  'manager/schedule':     ['Team',      'Schedule'],
  'manager/floor-issues': ['Manager',   'Floor Issues'],
  'manager/onboarding':   ['Team',      'Onboarding'],
  'manager/tasks':        ['Manager',   'My Tasks'],
  'manager/checklists':   ['Manager',   'Checklists'],
  'manager/calendar':     ['Venue',     'Venue Briefing'],
  'manager/incidents':    ['Manager',   'Incidents'],
  'manager/resources':    ['Common',    'Resources'],
  // Staff
  'staff/dashboard':      ['Staff',     'My Dashboard'],
  'staff/shifts':         ['Schedule',  'My Shifts'],
  'staff/profile':        ['Staff',     'My Profile'],
  'staff/tasks':          ['Staff',     'My Tasks'],
  'staff/leave':          ['Staff',     'Leave'],
  'staff/payslips':       ['Staff',     'Payslips'],
  'staff/check-in':       ['Staff',     'Check In / Out'],
  'staff/calendar':       ['Schedule',  'Venue Briefing'],
  // Marketing
  'marketing/dashboard':      ['Marketing', 'Dashboard'],
  'marketing/calendar':       ['Marketing', 'Content Calendar'],
  'marketing/content-calendar':['Marketing','Content Calendar'],
  'marketing/dj-schedule':    ['Marketing', 'DJ Schedule'],
  'marketing/schedule':       ['Marketing', 'Schedule'],
  'marketing/tasks':          ['Marketing', 'My Tasks'],
  // Common / Settings
  'announcements':        ['Common',    'Announcements'],
  'resources':            ['Common',    'Resources'],
  'settings':             ['Settings',  'Settings'],
  'settings/permissions': ['Settings',  'Permissions'],
  'settings/roles':       ['Settings',  'Roles'],
  'settings/sops':        ['Settings',  'SOPs'],
  'admin/sync':           ['Admin',     'Sync Data'],
}

function getBreadcrumb(pathname: string): [string, string] {
  // Strip leading slash, then try longest-prefix match
  const stripped = pathname.replace(/^\//, '')
  // Try exact match first
  if (BREADCRUMB_MAP[stripped]) return BREADCRUMB_MAP[stripped]
  // Try prefix match (e.g. "team/123" → "team/:userId")
  if (stripped.startsWith('team/')) return ['Team', 'Employee Detail']
  if (stripped.startsWith('announcements/')) return ['Common', 'Announcement']
  // Fallback: capitalise the last path segment
  const parts = stripped.split('/')
  const last = parts[parts.length - 1]
  const section = parts.length > 1 ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Home'
  const page = last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return [section, page]
}

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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const actualRole = profile?.role;

  // Collapse mobile search on route change
  useEffect(() => { setMobileSearchOpen(false) }, [location.pathname])

  // Derive context role: explicit viewAs > path prefix (for owners) > actual role
  const pathPrefix = location.pathname.startsWith('/manager') ? 'manager'
    : location.pathname.startsWith('/staff') ? 'staff'
    : location.pathname.startsWith('/owner') ? 'owner'
    : null;
  const effectiveRole =
    viewAs?.role ?? (actualRole === 'owner' && pathPrefix ? pathPrefix : actualRole);

  const [sectionLabel, pageLabel] = getBreadcrumb(location.pathname)

  return (
    <div>
      <header className="flex h-14 md:h-16 items-center justify-between border-b border-[#dad4c8] bg-card/97 px-4 md:px-6 rounded-t-card shadow-none">
        {/* Left side: Menu button (mobile) + Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Sidebar trigger - visible on mobile only */}
          <SidebarTrigger className="lg:hidden shrink-0" onClick={onMenuClick} />
          
          {/* Breadcrumb - hidden on mobile, visible on md+ */}
          <div className="hidden md:flex items-center gap-2 text-sm">
            <Home className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Home</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="hidden lg:inline text-muted-foreground">{sectionLabel}</span>
            <ChevronRight className="hidden lg:inline h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">{pageLabel}</span>
          </div>
          
          {/* Mobile title - visible on mobile only (hidden when search open) */}
          {!mobileSearchOpen && (
            <span className="md:hidden text-foreground font-medium truncate">The Roof</span>
          )}
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
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          {/* Mobile search toggle */}
          <button
            className="md:hidden rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={() => {
              setMobileSearchOpen((v) => !v)
              setTimeout(() => mobileInputRef.current?.focus(), 50)
            }}
            aria-label="Search"
          >
            {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>

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

      {/* Mobile search bar — slides in below header */}
      {mobileSearchOpen && (
        <div className="md:hidden border-b border-[#dad4c8] bg-card px-4 py-2.5 animate-in slide-in-from-top-2 duration-150">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={mobileInputRef}
              type="text"
              placeholder="Search employees, shifts, tasks..."
              className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => e.key === 'Escape' && setMobileSearchOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
