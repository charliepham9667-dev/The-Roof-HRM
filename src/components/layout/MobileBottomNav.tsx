import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Calendar, Clock, MessageSquare, CheckSquare } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useStaffList } from '@/hooks/useShifts'
import { useDMListMetadata } from '@/hooks/useChatReadReceipts'
import { cn } from '@/lib/utils'

export function MobileBottomNav() {
  const profile = useAuthStore((s) => s.profile)
  const viewAs = useAuthStore((s) => s.viewAs)
  const { data: staffList = [] } = useStaffList()
  const peerIds = staffList
    .filter((s) => s.id !== profile?.id)
    .map((s) => s.id)
  const { data: dmMetadata = {} } = useDMListMetadata(profile?.id, peerIds)
  const chatUnread = Object.values(dmMetadata).reduce((sum, m) => sum + (m.unread || 0), 0)

  const effectiveRole = viewAs?.role || profile?.role

  const getDashboardUrl = () => {
    if (effectiveRole === 'staff') return '/staff/dashboard'
    if (effectiveRole === 'manager') return '/manager/dashboard'
    return '/owner/dashboard'
  }

  const getScheduleUrl = () => {
    if (effectiveRole === 'staff') return '/staff/my-shifts'
    if (effectiveRole === 'manager') return '/manager/schedule'
    return '/owner/schedule'
  }

  const getCheckInUrl = () => {
    if (effectiveRole === 'manager') return '/manager/check-in'
    return '/staff/check-in'
  }

  const getTasksUrl = () => {
    if (effectiveRole === 'staff') return '/staff/tasks'
    if (effectiveRole === 'manager') return '/manager/tasks'
    return '/owner/tasks'
  }

  const navItems = [
    { to: getDashboardUrl(), icon: LayoutDashboard, label: 'Dashboard' },
    { to: getScheduleUrl(), icon: Calendar, label: 'Schedule' },
    { to: getCheckInUrl(), icon: Clock, label: 'Check-in', primary: true },
    { to: '/announcements?tab=chat', icon: MessageSquare, label: 'Chat', badge: chatUnread },
    { to: getTasksUrl(), icon: CheckSquare, label: 'Tasks' },
  ]

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 flex md:hidden',
        'border-t border-border bg-card shadow-[0_-2px_10px_rgba(0,0,0,0.05)]',
        'pb-[env(safe-area-inset-bottom)]'
      )}
    >
      <div className="flex flex-1 items-center justify-around">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={false}
            className={({ isActive }) =>
              cn(
                'relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-2 py-2 text-[10px] transition-colors',
                isActive
                  ? item.primary
                    ? 'text-primary font-semibold'
                    : 'text-primary'
                  : 'text-muted-foreground',
                item.primary && isActive && 'bg-primary/10'
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span>{item.label}</span>
            {item.badge != null && item.badge > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
