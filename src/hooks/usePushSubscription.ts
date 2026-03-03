import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

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

export function usePushSubscription() {
  const profile = useAuthStore((s) => s.profile);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasVapidKey = !!VAPID_PUBLIC_KEY;
  const hasPushApis =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
  const isSupported = hasVapidKey && hasPushApis;

  // Check current subscription state on mount
  useEffect(() => {
    if (!isSupported || !profile?.id) return;

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(!!sub))
      .catch(() => setIsSubscribed(false));
  }, [isSupported, profile?.id]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !profile?.id || !VAPID_PUBLIC_KEY) return;
    setIsLoading(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission denied. Please enable it in your browser settings.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
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
  }, [isSupported, profile?.id]);

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
    error,
    subscribe,
    unsubscribe,
    hasVapidKey,
    hasPushApis,
  };
}
