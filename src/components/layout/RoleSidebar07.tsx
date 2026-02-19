import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  // Navigation icons
  LayoutDashboard,
  CheckSquare,
  ClipboardList,
  Clock,
  Calendar,
  Megaphone,
  FolderOpen,
  BarChart3,
  MapPin,
  ShoppingCart,
  // Finance icons
  DollarSign,
  TrendingUp,
  // Team icons
  Users,
  UserCog,
  // Settings icons
  Settings,
  LogOut,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import type { UserRole } from '@/types';

// Extends UserRole with virtual nav keys for manager sub-types
type NavRole = UserRole | 'marketing_manager';

/**
 * Navigation item type
 */
interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  badge?: string | number;
  roles: NavRole[];
}

/**
 * Navigation group type
 */
interface NavGroup {
  label: string;
  roles: NavRole[];
  items: NavItem[];
}

/**
 * Define all navigation based on PRD feature structure
 * Each item specifies which roles can access it
 */
const navigationGroups: NavGroup[] = [
  // =========================================================
  // OWNER NAV (matches requested sidebar structure)
  // =========================================================
  {
    label: 'Core',
    roles: ['owner'],
    items: [
      {
        title: 'Executive Dashboard',
        url: '/owner/dashboard',
        icon: LayoutDashboard,
        roles: ['owner'],
      },
      {
        title: 'Venue Manager',
        url: '/owner/venue',
        icon: MapPin,
        roles: ['owner'],
      },
      {
        title: 'Operations',
        url: '/owner/wishlist',
        icon: ShoppingCart,
        roles: ['owner'],
      },
    ],
  },
  {
    label: 'Finance',
    roles: ['owner'],
    items: [
      {
        title: 'Summary',
        url: '/finance/summary',
        icon: DollarSign,
        roles: ['owner'],
      },
      {
        title: 'P&L Support',
        url: '/finance/pl',
        icon: TrendingUp,
        roles: ['owner'],
      },
    ],
  },
  {
    label: 'Team',
    roles: ['owner'],
    items: [
      {
        title: 'Team Overview',
        url: '/owner/team-directory',
        icon: Users,
        roles: ['owner'],
      },
      {
        title: 'Schedule',
        url: '/owner/schedule',
        icon: Calendar,
        roles: ['owner'],
      },
    ],
  },
  {
    label: 'Marketing',
    roles: ['owner'],
    items: [
      {
        title: 'Dashboard',
        url: '/marketing/dashboard',
        icon: BarChart3,
        roles: ['owner'],
      },
      {
        title: 'Calendar',
        url: '/marketing/content-calendar',
        icon: Calendar,
        roles: ['owner'],
      },
      {
        title: 'Venue Calendar',
        url: '/owner/venue-calendar',
        icon: Calendar,
        roles: ['owner'],
      },
    ],
  },
  {
    label: 'Common Hub',
    roles: ['owner'],
    items: [
      {
        title: 'Manage Checklists',
        url: '/owner/checklists',
        icon: ClipboardList,
        roles: ['owner'],
      },
      {
        title: 'Resources',
        url: '/owner/resources',
        icon: FolderOpen,
        roles: ['owner'],
      },
      {
        title: 'Announcements & Chat',
        url: '/owner/announcements',
        icon: Megaphone,
        roles: ['owner'],
      },
    ],
  },

  // =========================================================
  // MANAGER NAV
  // =========================================================
  {
    label: 'Core',
    roles: ['manager'],
    items: [
      {
        title: 'Dashboard',
        url: '/manager/dashboard',
        icon: LayoutDashboard,
        roles: ['manager'],
      },
      {
        title: 'My Tasks',
        url: '/manager/tasks',
        icon: CheckSquare,
        roles: ['manager'],
      },
      {
        title: 'Floor Issues',
        url: '/manager/floor-issues',
        icon: AlertTriangle,
        roles: ['manager'],
      },
      {
        title: 'Operations',
        url: '/manager/operations',
        icon: ShoppingCart,
        roles: ['manager'],
      },
      {
        title: 'Venue Manager',
        url: '/manager/venue',
        icon: MapPin,
        roles: ['manager'],
      },
    ],
  },
  {
    label: 'Team',
    roles: ['manager'],
    items: [
      {
        title: 'Schedule',
        url: '/manager/schedule',
        icon: Calendar,
        roles: ['manager'],
      },
      {
        title: 'Calendar',
        url: '/manager/calendar',
        icon: Calendar,
        roles: ['manager'],
      },
    ],
  },
  {
    label: 'Common Hub',
    roles: ['manager'],
    items: [
      {
        title: 'Manage Checklists',
        url: '/manager/checklists',
        icon: ClipboardList,
        roles: ['manager'],
      },
      {
        title: 'Resources',
        url: '/manager/resources',
        icon: FolderOpen,
        roles: ['manager'],
      },
      {
        title: 'Announcements & Chat',
        url: '/manager/announcements',
        icon: Megaphone,
        roles: ['manager'],
      },
    ],
  },

  // =========================================================
  // MARKETING MANAGER NAV
  // =========================================================
  {
    label: 'Core',
    roles: ['marketing_manager'],
    items: [
      {
        title: 'Dashboard',
        url: '/marketing/dashboard',
        icon: LayoutDashboard,
        roles: ['marketing_manager'],
      },
      {
        title: 'My Tasks',
        url: '/marketing/tasks',
        icon: CheckSquare,
        roles: ['marketing_manager'],
      },
    ],
  },
  {
    label: 'Team',
    roles: ['marketing_manager'],
    items: [
      {
        title: 'Schedule',
        url: '/marketing/schedule',
        icon: Calendar,
        roles: ['marketing_manager'],
      },
    ],
  },
  {
    label: 'Marketing',
    roles: ['marketing_manager'],
    items: [
      {
        title: 'Overview',
        url: '/marketing/dashboard',
        icon: BarChart3,
        roles: ['marketing_manager'],
      },
      {
        title: 'Calendar',
        url: '/marketing/content-calendar',
        icon: Calendar,
        roles: ['marketing_manager'],
      },
    ],
  },
  {
    label: 'Common Hub',
    roles: ['marketing_manager'],
    items: [
      {
        title: 'Resources',
        url: '/manager/resources',
        icon: FolderOpen,
        roles: ['marketing_manager'],
      },
      {
        title: 'Announcements & Chat',
        url: '/manager/announcements',
        icon: Megaphone,
        roles: ['marketing_manager'],
      },
    ],
  },

  // =========================================================
  // STAFF NAV
  // =========================================================
  {
    label: 'Core',
    roles: ['staff'],
    items: [
      {
        title: 'Dashboard',
        url: '/staff/dashboard',
        icon: LayoutDashboard,
        roles: ['staff'],
      },
      {
        title: 'My Tasks',
        url: '/staff/tasks',
        icon: CheckSquare,
        roles: ['staff'],
      },
      {
        title: 'Daily Checklist',
        url: '/staff/checklists',
        icon: ClipboardList,
        roles: ['staff'],
      },
      {
        title: 'Check In/Out',
        url: '/staff/check-in',
        icon: Clock,
        roles: ['staff'],
      },
    ],
  },
  {
    label: 'Schedule',
    roles: ['staff'],
    items: [
      {
        title: 'My Shifts',
        url: '/staff/my-shifts',
        icon: Calendar,
        roles: ['staff'],
      },
      {
        title: 'Calendar',
        url: '/staff/calendar',
        icon: Calendar,
        roles: ['staff'],
      },
    ],
  },
  {
    label: 'Common Hub',
    roles: ['staff'],
    items: [
      {
        title: 'Resources',
        url: '/staff/resources',
        icon: FolderOpen,
        roles: ['staff'],
      },
      {
        title: 'Announcements & Chat',
        url: '/staff/announcements',
        icon: Megaphone,
        roles: ['staff'],
      },
    ],
  },
];

/**
 * Filter navigation items based on nav role key
 */
function filterNavForRole(groups: NavGroup[], role: NavRole): NavGroup[] {
  return groups
    .filter(group => group.roles.includes(role))
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.roles.includes(role)),
    }))
    .filter(group => group.items.length > 0);
}

/**
 * Infer the view context role from the current URL path.
 * Used so that owners navigating to /manager/* or /staff/* see the
 * appropriate sidebar without having to manually switch "View as".
 * Returns a NavRole so /marketing/* paths can resolve to marketing_manager.
 */
function getRoleFromPath(pathname: string): NavRole | null {
  if (pathname.startsWith('/manager/') || pathname === '/manager') return 'manager';
  if (pathname.startsWith('/staff/') || pathname === '/staff') return 'staff';
  if (pathname.startsWith('/owner/') || pathname === '/owner') return 'owner';
  return null;
}

/**
 * RoleSidebar - Main navigation sidebar
 * Dynamically shows items based on user role
 */
export function RoleSidebar07() {
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const viewAs = useAuthStore((s) => s.viewAs);
  const signOut = useAuthStore((s) => s.signOut);

  const actualRole = profile?.role || 'staff';

  // Derive effective role: explicit viewAs > path-based context (for owners) > actual role
  const pathRole = getRoleFromPath(location.pathname);
  const effectiveRole: UserRole =
    viewAs?.role ??
    (actualRole === 'owner' && pathRole
      ? (pathRole as UserRole)
      : actualRole);

  // Resolve the nav role, incorporating managerType and path context
  const managerType = (viewAs as any)?.managerType ?? (profile as any)?.managerType;
  const navRole: NavRole = (() => {
    // Owner previewing via path — use the path-derived nav role directly
    if (actualRole === 'owner' && !viewAs?.role && pathRole) return pathRole;
    // Marketing manager (by actual role + managerType, or viewAs)
    if (effectiveRole === 'manager' && managerType === 'marketing') return 'marketing_manager';
    return effectiveRole;
  })();

  // Filter navigation for this role
  const filteredNav = filterNavForRole(navigationGroups, navRole);

  // Check if a path is active
  const isActive = (url: string) => {
    if (url === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(url);
  };

  // Get user initials for avatar fallback
  const getInitials = (name: string | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <Sidebar variant="inset" collapsible="icon">
      {/* Header - Brand */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/" className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold">The Roof</span>
                  <span className="text-xs text-muted-foreground">Workspace</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Main Navigation */}
      <SidebarContent>
        {filteredNav.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <a href={item.url} className="flex items-center justify-between">
                        <div className="flex items-center gap-[5px]">
                          <item.icon className="h-4 w-4" />
                          <span className="font-serif text-xs font-medium">{item.title}</span>
                        </div>
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto h-5 min-w-5 justify-center">
                            {item.badge}
                          </Badge>
                        )}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer - User Menu */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatarUrl} alt={profile?.fullName} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(profile?.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {profile?.fullName || 'User'}
                    </span>
                    <span className="truncate text-[9px] text-muted-foreground">
                      {profile?.email}
                    </span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56"
                align="end"
                side="top"
                sideOffset={8}
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{profile?.fullName}</p>
                    <p className="text-xs text-muted-foreground">{profile?.email}</p>
                    <Badge variant="outline" className="mt-1 w-fit capitalize">
                      {viewAs?.role || profile?.role}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <UserCog className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default RoleSidebar07;