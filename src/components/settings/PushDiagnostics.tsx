import { useState } from 'react';
import { Bell, BellOff, Check, X, Loader2, Send } from 'lucide-react';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

/**
 * Push notification diagnostics for Settings.
 * Shows: isSupported, isSubscribed, VAPID present, last test result.
 */
export function PushDiagnostics() {
  const profile = useAuthStore((s) => s.profile);
  const {
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    hasVapidKey,
    hasPushApis,
    vapidKeyError,
  } = usePushSubscription();
  const [testState, setTestState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');

  const handleTest = async () => {
    if (!profile?.id || !isSubscribed) return;
    setTestState('sending');
    try {
      const { error: pushErr } = await supabase.functions.invoke('send-push', {
        body: {
          user_ids: [profile.id],
          title: 'Test Notification',
          body: 'Push diagnostics test from Settings.',
          url: '/',
        },
      });
      setTestState(pushErr ? 'error' : 'ok');
    } catch {
      setTestState('error');
    } finally {
      setTimeout(() => setTestState('idle'), 5000);
    }
  };

  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-card">
      <h3 className="mb-3 flex items-center gap-2 font-medium text-foreground">
        <Bell className="h-5 w-5 text-primary" />
        Push notification diagnostics
      </h3>

      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">VAPID key configured</dt>
          <dd className="flex items-center gap-1.5">
            {vapidKeyError ? (
              <><X className="h-4 w-4 shrink-0 text-destructive" /> Invalid</>
            ) : hasVapidKey ? (
              <><Check className="h-4 w-4 text-green-600" /> Yes</>
            ) : (
              <><X className="h-4 w-4 text-destructive" /> No — set VITE_VAPID_PUBLIC_KEY</>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">Push APIs available</dt>
          <dd className="flex items-center gap-1.5">
            {hasPushApis ? (
              <><Check className="h-4 w-4 text-green-600" /> Yes</>
            ) : (
              <><X className="h-4 w-4 text-destructive" /> No — use PWA from home screen on iOS</>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">Subscribed</dt>
          <dd className="flex items-center gap-1.5">
            {isSubscribed ? (
              <><Check className="h-4 w-4 text-green-600" /> Yes</>
            ) : (
              <><X className="h-4 w-4 text-muted-foreground" /> No</>
            )}
          </dd>
        </div>
      </dl>

      {(error || vapidKeyError) && (
        <p className="mt-2 text-xs text-destructive">{error || vapidKeyError}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {isSupported && (
          <>
            <button
              onClick={isSubscribed ? unsubscribe : subscribe}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isSubscribed ? (
                <BellOff className="h-3.5 w-3.5" />
              ) : (
                <Bell className="h-3.5 w-3.5" />
              )}
              {isSubscribed ? 'Disable' : 'Enable'} phone notifications
            </button>
            {isSubscribed && (
              <button
                onClick={handleTest}
                disabled={testState === 'sending'}
                className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {testState === 'sending' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {testState === 'sending' && 'Sending…'}
                {testState === 'ok' && '✓ Sent'}
                {testState === 'error' && '✗ Failed'}
                {testState === 'idle' && 'Send test'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
