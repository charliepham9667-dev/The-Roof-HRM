import { useState, useEffect } from 'react';
import { BellRing, X, Loader2 } from 'lucide-react';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { useAuthStore } from '@/stores/authStore';
import { useIsMobile } from '@/hooks/use-mobile';

const DISMISS_KEY = 'push-prompt-dismissed';
const DISMISS_DAYS = 7;

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
    return ageDays < DISMISS_DAYS;
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * Mobile-only banner prompting users to enable phone push notifications.
 * Shown when push is supported, user hasn't subscribed yet, and not recently dismissed.
 */
export function PushPromptBanner() {
  const isMobile = useIsMobile();
  const profile = useAuthStore((s) => s.profile);
  const { isSupported, isSubscribed, isLoading, subscribe, error } = usePushSubscription();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(wasDismissedRecently());
  }, []);

  const show =
    isMobile &&
    !!profile?.id &&
    isSupported &&
    !isSubscribed &&
    !dismissed;

  if (!show) return null;

  const handleDismiss = () => {
    dismiss();
    setDismissed(true);
  };

  const handleEnable = async () => {
    await subscribe();
    // If successful, banner will hide (isSubscribed becomes true)
  };

  return (
    <div className="md:hidden flex shrink-0 flex-col border-b border-primary/20 bg-primary/5 px-4 py-2.5 gap-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <BellRing className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm font-medium text-foreground">
            Get alerts for new reservations and reminders on your phone
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleEnable}
            disabled={isLoading}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Enable
          </button>
          <button
            onClick={handleDismiss}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {error && (
        <p className="text-[10px] text-destructive">{error}</p>
      )}
    </div>
  );
}
