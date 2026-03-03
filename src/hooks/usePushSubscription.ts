import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** P-256 uncompressed public key must be 65 bytes (0x04 + 32-byte X + 32-byte Y) */
const VAPID_KEY_LENGTH = 65;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Validates VAPID public key format. Must be base64url-encoded 65-byte P-256 key.
 * Common mistake: using hex output from web-push (invalid) instead of the base64url public key.
 */
function validateVapidKey(key: string): string | null {
  if (!key || typeof key !== 'string') return 'VAPID key is missing.';
  const trimmed = key.trim();
  if (!trimmed) return 'VAPID key is empty.';
  // Hex strings (e.g. from some key generators) cause "invalid P-256" — must be base64url
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === 64) {
    return 'VAPID key appears to be hex format. Use base64url from: npx web-push generate-vapid-keys';
  }
  try {
    const bytes = urlBase64ToUint8Array(trimmed);
    if (bytes.length !== VAPID_KEY_LENGTH) {
      return `VAPID key must decode to 65 bytes (got ${bytes.length}). Regenerate with: npx web-push generate-vapid-keys`;
    }
    if (bytes[0] !== 0x04) {
      return 'VAPID key must be uncompressed P-256 (starts with 0x04). Regenerate with: npx web-push generate-vapid-keys';
    }
    return null;
  } catch {
    return 'VAPID key is not valid base64url. Regenerate with: npx web-push generate-vapid-keys';
  }
}

export function usePushSubscription() {
  const profile = useAuthStore((s) => s.profile);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasVapidKey = !!VAPID_PUBLIC_KEY;
  const vapidKeyError = VAPID_PUBLIC_KEY ? validateVapidKey(VAPID_PUBLIC_KEY) : null;
  const hasPushApis =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
  const isSupported = hasVapidKey && !vapidKeyError && hasPushApis;

  // Check current subscription state on mount
  useEffect(() => {
    if (!isSupported || !profile?.id) return;

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(!!sub))
      .catch(() => setIsSubscribed(false));
  }, [isSupported, profile?.id]);

  const subscribe = useCallback(async () => {
    if (!hasVapidKey || !profile?.id || !VAPID_PUBLIC_KEY) return;
    const keyErr = validateVapidKey(VAPID_PUBLIC_KEY);
    if (keyErr) {
      setError(keyErr);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission denied. Go to device Settings → Notifications → enable for this app.');
        return;
      }

      // Service worker must be ready (can hang on iOS if not opened from Home Screen)
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Service worker timed out. Add app to Home Screen and open from there, then try again.')), 15000)
        ),
      ]);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subJson = sub.toJSON();
      const { error: dbErr } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: profile.id,
          endpoint: sub.endpoint,
          p256dh: subJson.keys?.p256dh ?? '',
          auth: subJson.keys?.auth ?? '',
        },
        { onConflict: 'endpoint' }
      );

      if (dbErr) throw dbErr;
      setIsSubscribed(true);
    } catch (err: any) {
      console.error('[usePushSubscription] subscribe error:', err);
      setError(err?.message ?? 'Failed to enable push notifications.');
    } finally {
      setIsLoading(false);
    }
  }, [hasVapidKey, profile?.id]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !profile?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err: any) {
      console.error('[usePushSubscription] unsubscribe error:', err);
      setError(err?.message ?? 'Failed to disable push notifications.');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, profile?.id]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    error: error ?? vapidKeyError,
    subscribe,
    unsubscribe,
    hasVapidKey,
    hasPushApis,
    vapidKeyError,
  };
}
