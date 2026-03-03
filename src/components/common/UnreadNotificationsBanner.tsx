import { Bell, ChevronRight } from 'lucide-react';
import { useUnreadNotificationCount, useNotifications } from '../../hooks/useNotifications';
import { useAuthStore } from '../../stores/authStore';
import { useIsMobile } from '@/hooks/use-mobile';
import type { NotificationType } from '../../types';

const OPEN_PANEL_EVENT = 'open-notifications-panel';

const TYPE_LABELS: Record<NotificationType, string> = {
  shift_reminder: 'Shift',
  reservation_reminder: 'Reservation',
  reservation_new: 'Reservation',
  leave_status: 'Leave',
  task_assigned: 'Task',
  task_due: 'Task due',
  announcement: 'Announcement',
  compliance_alert: 'Compliance',
  clock_reminder: 'Clock',
  meeting_reminder: 'Meeting',
  general: 'Notification',
  content_approval: 'Approval',
};

export function UnreadNotificationsBanner() {
  const profile = useAuthStore((s) => s.profile);
  const isMobile = useIsMobile();
  const { data: count = 0 } = useUnreadNotificationCount();
  const { data: notifications = [] } = useNotifications(5);

  if (!profile?.id || count === 0 || !isMobile) return null;

  const latest = notifications.find((n) => !n.isRead) ?? notifications[0];
  const label = latest ? TYPE_LABELS[latest.notificationType] ?? 'Notification' : 'Notification';

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent(OPEN_PANEL_EVENT));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full shrink-0 items-center gap-3 border-b border-primary/20 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10 active:bg-primary/15"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20">
        <Bell className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {count} unread notification{count !== 1 ? 's' : ''}
        </p>
        {latest && (
          <p className="truncate text-xs text-muted-foreground">
            {label}: {latest.title}
          </p>
        )}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}
