import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, Loader2, BellOff, BellRing } from 'lucide-react';
import { 
  useNotifications, 
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead 
} from '../../hooks/useNotifications';
import { usePushSubscription } from '../../hooks/usePushSubscription';
import type { Notification, NotificationType } from '../../types';

const typeConfig: Record<NotificationType, { label: string; color: string }> = {
  shift_reminder: { label: 'Shift', color: 'text-blue-400' },
  reservation_reminder: { label: 'Reservation', color: 'text-emerald-400' },
  reservation_new: { label: 'New Reservation', color: 'text-emerald-500' },
  leave_status: { label: 'Leave', color: 'text-purple-400' },
  task_assigned: { label: 'Task', color: 'text-yellow-400' },
  task_due: { label: 'Task Due', color: 'text-red-400' },
  announcement: { label: 'Announcement', color: 'text-orange-400' },
  compliance_alert: { label: 'Compliance', color: 'text-red-400' },
  clock_reminder: { label: 'Clock', color: 'text-cyan-400' },
  meeting_reminder: { label: 'Meeting', color: 'text-pink-400' },
  general: { label: 'General', color: 'text-muted-foreground' },
  content_approval: { label: 'Approval', color: 'text-violet-400' },
};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: count = 0 } = useUnreadNotificationCount();
  const { data: notifications, isLoading } = useNotifications(10);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const { isSupported, isSubscribed, isLoading: pushLoading, error: pushError, subscribe, unsubscribe } = usePushSubscription();

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }
    setIsOpen(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-card border border-border bg-card shadow-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-medium text-foreground">Notifications</h3>
              {count > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markAllRead.isPending}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {markAllRead.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : notifications && notifications.length > 0 ? (
                <div className="divide-y divide-border">
                  {notifications.map((notification) => {
                    const config = typeConfig[notification.notificationType];
                    return (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                          !notification.isRead ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {!notification.isRead && (
                            <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                          <div className={`flex-1 min-w-0 ${notification.isRead ? 'ml-5' : ''}`}>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${config.color}`}>{config.label}</span>
                              <span className="text-xs text-muted-foreground">{formatTime(notification.createdAt)}</span>
                            </div>
                            <p className={`text-sm mt-0.5 ${notification.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                              {notification.title}
                            </p>
                            {notification.body && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {notification.body}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No notifications
                </div>
              )}
            </div>

            {/* Push notification opt-in/out */}
            {isSupported && (
              <div className="px-4 py-2.5 border-t border-border bg-muted/30">
                {pushError && (
                  <p className="text-[11px] text-destructive mb-1.5">{pushError}</p>
                )}
                <button
                  onClick={isSubscribed ? unsubscribe : subscribe}
                  disabled={pushLoading}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {pushLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isSubscribed ? (
                    <BellOff className="h-3.5 w-3.5" />
                  ) : (
                    <BellRing className="h-3.5 w-3.5 text-primary" />
                  )}
                  {isSubscribed ? 'Disable phone notifications' : 'Enable phone notifications'}
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border">
              <Link
                to="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-xs text-primary hover:underline"
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
