import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Calendar,
  Clock,
  MessageSquare,
  CheckSquare,
  DollarSign,
  BarChart3,
  ShoppingCart,
  MoreHorizontal,
  X,
  MapPin,
  AlertTriangle,
  ClipboardList,
  FolderOpen,
  Megaphone,
  Building2,
  Users,
  TrendingUp,
  LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useStaffList } from '@/hooks/useShifts'
import { useDMListMetadata } from '@/hooks/useChatReadReceipts'
import { cn } from '@/lib/utils'
import type { UserRole, ManagerType } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type NavRole = UserRole | 'floor_manager' | 'bar_manager' | 'marketing_manager'

interface TabDef {
  to: string
  icon: LucideIcon
  label: string
  primary?: boolean
  isBadgedChat?: boolean
}

interface DrawerSection {
  label: string
  items: { title: string; url: string; icon: LucideIcon }[]
}

// ─── Resolve nav role from profile ────────────────────────────────────────────

function resolveNavRole(role: UserRole, managerType?: ManagerType | null): NavRole {
  if (role === 'manager') {
    if (managerType === 'floor') return 'floor_manager'
    if (managerType === 'bar') return 'bar_manager'
    if (managerType === 'marketing') return 'marketing_manager'
    return 'manager'
  }
  return role
}

// ─── Tab configs per role ─────────────────────────────────────────────────────

const TAB_CONFIG: Record<NavRole, TabDef[]> = {
  owner: [
    { to: '/owner/dashboard',           icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/finance/summary',           icon: DollarSign,      label: 'Finance' },
    { to: '/marketing/dashboard',       icon: BarChart3,       label: 'Marketing' },
    { to: '/owner/schedule',            icon: Calendar,        label: 'Schedule' },
    { to: '__more__',                   icon: MoreHorizontal,  label: 'More' },
  ],
  floor_manager: [
    { to: '/manager/dashboard',         icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/manager/operations',        icon: ShoppingCart,    label: 'Operations' },
    { to: '/manager/calendar',          icon: Calendar,        label: 'Briefing' },
    { to: '/manager/schedule',          icon: Calendar,        label: 'Schedule' },
    { to: '__more__',                   icon: MoreHorizontal,  label: 'More' },
  ],
  bar_manager: [
    { to: '/manager/dashboard',         icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/manager/operations',        icon: ShoppingCart,    label: 'Operations' },
    { to: '/manager/calendar',          icon: Calendar,        label: 'Briefing' },
    { to: '/manager/schedule',          icon: Calendar,        label: 'Schedule' },
    { to: '__more__',                   icon: MoreHorizontal,  label: 'More' },
  ],
  // Generic manager fallback (no managerType)
  manager: [
    { to: '/manager/dashboard',         icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/manager/operations',        icon: ShoppingCart,    label: 'Operations' },
    { to: '/manager/schedule',          icon: Calendar,        label: 'Schedule' },
    { to: '/manager/announcements',     icon: MessageSquare,   label: 'Chat',     isBadgedChat: true },
    { to: '__more__',                   icon: MoreHorizontal,  label: 'More' },
  ],
  marketing_manager: [
    { to: '/manager/dashboard',         icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/marketing/dashboard',       icon: BarChart3,       label: 'Marketing' },
    { to: '/marketing/content-calendar',icon: Calendar,        label: 'Calendar' },
    { to: '/marketing/schedule',        icon: Calendar,        label: 'Schedule' },
    { to: '__more__',                   icon: MoreHorizontal,  label: 'More' },
  ],
  staff: [
    { to: '/staff/dashboard',           icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/staff/my-shifts',           icon: Calendar,        label: 'Schedule' },
    { to: '/staff/check-in',            icon: Clock,           label: 'Check In', primary: true },
    { to: '/staff/announcements',       icon: MessageSquare,   label: 'Chat',     isBadgedChat: true },
    { to: '/staff/tasks',               icon: CheckSquare,     label: 'Tasks' },
  ],
}

// ─── More drawer configs per role ─────────────────────────────────────────────

const DRAWER_CONFIG: Partial<Record<NavRole, DrawerSection[]>> = {
  owner: [
    {
      label: 'Core',
      items: [
        { title: 'Venue Manager',        url: '/owner/venue',            icon: MapPin },
        { title: 'Operations',           url: '/owner/wishlist',         icon: ShoppingCart },
        { title: 'Finance P&L',          url: '/finance/pl',             icon: TrendingUp },
      ],
    },
    {
      label: 'Team',
      items: [
        { title: 'Team Overview',        url: '/owner/team-directory',   icon: Users },
        { title: 'Schedule',             url: '/owner/schedule',         icon: Calendar },
      ],
    },
    {
      label: 'Marketing',
      items: [
        { title: 'Content Calendar',     url: '/marketing/content-calendar', icon: Calendar },
      ],
    },
    {
      label: 'Common Hub',
      items: [
        { title: 'Manage Checklists',    url: '/owner/checklists',       icon: ClipboardList },
        { title: 'Resources',            url: '/owner/resources',        icon: FolderOpen },
        { title: 'Announcements & Chat', url: '/owner/announcements',    icon: Megaphone },
      ],
    },
    {
      label: 'Company',
      items: [
        { title: 'Company Profile',      url: '/owner/company',          icon: Building2 },
      ],
    },
  ],
  floor_manager: [
    {
      label: 'Management',
      items: [
        { title: 'Venue Manager',        url: '/manager/venue',          icon: MapPin },
        { title: 'Floor Issues',         url: '/manager/floor-issues',   icon: AlertTriangle },
      ],
    },
    {
      label: 'Team',
      items: [
        { title: 'Team Overview',        url: '/owner/team-directory',   icon: Users },
        { title: 'My Shifts',            url: '/manager/my-shifts',      icon: Clock },
      ],
    },
    {
      label: 'Common Hub',
      items: [
        { title: 'Manage Checklists',    url: '/manager/checklists',     icon: ClipboardList },
        { title: 'Resources',            url: '/manager/resources',      icon: FolderOpen },
        { title: 'Announcements & Chat', url: '/manager/announcements',  icon: Megaphone },
      ],
    },
    {
      label: 'HR',
      items: [
        { title: 'Check In/Out',         url: '/manager/check-in',       icon: Clock },
        { title: 'My Tasks',             url: '/manager/tasks',          icon: CheckSquare },
      ],
    },
  ],
  bar_manager: [
    {
      label: 'Management',
      items: [
        { title: 'Venue Manager',        url: '/manager/venue',          icon: MapPin },
        { title: 'Floor Issues',         url: '/manager/floor-issues',   icon: AlertTriangle },
      ],
    },
    {
      label: 'Team',
      items: [
        { title: 'Team Overview',        url: '/owner/team-directory',   icon: Users },
        { title: 'My Shifts',            url: '/manager/my-shifts',      icon: Clock },
      ],
    },
    {
      label: 'Common Hub',
      items: [
        { title: 'Manage Checklists',    url: '/manager/checklists',     icon: ClipboardList },
        { title: 'Resources',            url: '/manager/resources',      icon: FolderOpen },
        { title: 'Announcements & Chat', url: '/manager/announcements',  icon: Megaphone },
      ],
    },
    {
      label: 'HR',
      items: [
        { title: 'Check In/Out',         url: '/manager/check-in',       icon: Clock },
        { title: 'My Tasks',             url: '/manager/tasks',          icon: CheckSquare },
      ],
    },
  ],
  manager: [
    {
      label: 'Management',
      items: [
        { title: 'Venue Manager',        url: '/manager/venue',          icon: MapPin },
        { title: 'Floor Issues',         url: '/manager/floor-issues',   icon: AlertTriangle },
      ],
    },
    {
      label: 'Team',
      items: [
        { title: 'My Shifts',            url: '/manager/my-shifts',      icon: Clock },
        { title: 'Venue Briefing',       url: '/manager/calendar',       icon: Calendar },
      ],
    },
    {
      label: 'Common Hub',
      items: [
        { title: 'Manage Checklists',    url: '/manager/checklists',     icon: ClipboardList },
        { title: 'Resources',            url: '/manager/resources',      icon: FolderOpen },
      ],
    },
    {
      label: 'HR',
      items: [
        { title: 'Check In/Out',         url: '/manager/check-in',       icon: Clock },
        { title: 'My Tasks',             url: '/manager/tasks',          icon: CheckSquare },
      ],
    },
  ],
  marketing_manager: [
    {
      label: 'HR',
      items: [
        { title: 'Check In/Out',         url: '/manager/check-in',       icon: Clock },
        { title: 'My Shifts',            url: '/manager/my-shifts',      icon: Calendar },
        { title: 'My Tasks',             url: '/marketing/tasks',        icon: CheckSquare },
      ],
    },
    {
      label: 'Common Hub',
      items: [
        { title: 'Resources',            url: '/manager/resources',      icon: FolderOpen },
        { title: 'Announcements & Chat', url: '/manager/announcements',  icon: Megaphone },
      ],
    },
  ],
}

// ─── More Drawer ──────────────────────────────────────────────────────────────

function MoreDrawer({
  navRole,
  onClose,
  chatUnread,
}: {
  navRole: NavRole
  onClose: () => void
  chatUnread: number
}) {
  const navigate = useNavigate()
  const sections = DRAWER_CONFIG[navRole] ?? []

  // Lock body scroll while drawer is open; always restore on unmount
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  function go(url: string) {
    onClose()
    navigate(url)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex flex-col rounded-t-2xl bg-card shadow-2xl"
        style={{ maxHeight: '85dvh' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 shrink-0">
          <span className="text-sm font-semibold text-foreground tracking-wide">More</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable sections */}
        <div className="overflow-y-auto pb-[env(safe-area-inset-bottom)] divide-y divide-border">
          {sections.map((section) => (
            <div key={section.label} className="px-4 py-3">
              <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isChatItem = item.url.includes('announcements')
                  return (
                    <button
                      key={item.url}
                      type="button"
                      onClick={() => go(item.url)}
                      className="relative flex w-full items-center gap-3 rounded-xl px-3 min-h-[52px] text-left hover:bg-secondary/70 active:bg-secondary transition-colors"
                    >
                      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <span className="text-[14px] font-medium text-foreground">{item.title}</span>
                      {isChatItem && chatUnread > 0 && (
                        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                          {chatUnread > 99 ? '99+' : chatUnread}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const profile = useAuthStore((s) => s.profile)
  const viewAs = useAuthStore((s) => s.viewAs)
  const location = useLocation()

  // Close More drawer on route change
  useEffect(() => { setMoreOpen(false) }, [location.pathname])

  // Unread chat badge
  const { data: staffList = [] } = useStaffList()
  const peerIds = staffList
    .filter((s) => s.id !== profile?.id)
    .map((s) => s.id)
  const { data: dmMetadata = {} } = useDMListMetadata(profile?.id, peerIds)
  const chatUnread = Object.values(dmMetadata).reduce(
    (sum, m) => sum + (m.unread || 0),
    0,
  )

  // Resolve effective role
  const effectiveRole = viewAs?.role || profile?.role
  const effectiveManagerType = viewAs?.managerType || profile?.managerType
  if (!effectiveRole) return null

  const navRole = resolveNavRole(effectiveRole, effectiveManagerType)
  const tabs = TAB_CONFIG[navRole] ?? TAB_CONFIG.staff

  return (
    <>
      {moreOpen && (
        <MoreDrawer
          navRole={navRole}
          onClose={() => setMoreOpen(false)}
          chatUnread={chatUnread}
        />
      )}

      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40 flex md:hidden',
          'border-t border-border bg-card shadow-[0_-2px_10px_rgba(0,0,0,0.05)]',
          'pb-[env(safe-area-inset-bottom)]',
        )}
        aria-label="Mobile navigation"
      >
        <div className="flex flex-1 items-stretch justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isMore = tab.to === '__more__'

            if (isMore) {
              return (
                <button
                  key="more"
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  className={cn(
                    'relative flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[52px] px-1 py-2 text-[10px] transition-colors',
                    moreOpen ? 'text-primary' : 'text-muted-foreground',
                  )}
                  aria-label="More menu"
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>More</span>
                </button>
              )
            }

            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={false}
                className={({ isActive }) =>
                  cn(
                    'relative flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[52px] px-1 py-2 text-[10px] transition-colors',
                    isActive
                      ? tab.primary
                        ? 'text-primary font-semibold bg-primary/8'
                        : 'text-primary font-medium'
                      : 'text-muted-foreground',
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{tab.label}</span>
                {tab.isBadgedChat && chatUnread > 0 && (
                  <span className="absolute right-[calc(50%-14px)] top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none">
                    {chatUnread > 99 ? '99+' : chatUnread}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </>
  )
}
