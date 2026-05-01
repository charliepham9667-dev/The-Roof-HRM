import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Safe storage wrapper. iOS PWAs (and Safari private mode) can throw on
 * localStorage access when storage quota is exhausted or when the OS reclaims
 * data from a backgrounded standalone app. Falling back to an in-memory map
 * keeps the user signed in for the lifetime of the page rather than crashing
 * the auth flow back to the login screen.
 */
function createSafeStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;

  const memory = new Map<string, string>();
  const tryLocal = <T>(fn: () => T, fallback: () => T): T => {
    try {
      return fn();
    } catch (err) {
      console.warn('[supabase storage] localStorage unavailable, falling back to memory', err);
      return fallback();
    }
  };

  return {
    getItem: (key) =>
      tryLocal(
        () => window.localStorage.getItem(key),
        () => memory.get(key) ?? null,
      ),
    setItem: (key, value) =>
      tryLocal(
        () => window.localStorage.setItem(key, value),
        () => {
          memory.set(key, value);
        },
      ),
    removeItem: (key) =>
      tryLocal(
        () => window.localStorage.removeItem(key),
        () => {
          memory.delete(key);
        },
      ),
    clear: () =>
      tryLocal(
        () => window.localStorage.clear(),
        () => {
          memory.clear();
        },
      ),
    key: (index) =>
      tryLocal(
        () => window.localStorage.key(index),
        () => Array.from(memory.keys())[index] ?? null,
      ),
    get length() {
      return tryLocal(
        () => window.localStorage.length,
        () => memory.size,
      );
    },
  };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'theroof-auth-token',
    storage: createSafeStorage(),
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
