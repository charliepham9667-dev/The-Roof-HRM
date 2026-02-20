import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole, ManagerType } from '@/types';
import type { User } from '@supabase/supabase-js';

interface ViewAsState {
  role: UserRole;
  managerType?: ManagerType | null;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  initialized: boolean;
  error: string | null;
  
  // View As (for role preview in dev mode)
  viewAs: ViewAsState | null;
  setViewAs: (viewAs: ViewAsState | null) => void;
  
  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  initialize: () => Promise<void>;
  clearError: () => void;
  
  // Role helpers (respect viewAs for UI preview)
  isOwner: () => boolean;
  isManager: () => boolean;
  isStaff: () => boolean;
  hasRole: (roles: UserRole[]) => boolean;
  
  // Get effective profile (considering viewAs)
  getEffectiveProfile: () => Profile | null;
}

// Flag to prevent multiple initializations
let isInitializing = false;
let authListenerSet = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: false,
  initialized: false,
  error: null,
  viewAs: null,

  setViewAs: (viewAs) => set({ viewAs }),
  
  clearError: () => set({ error: null }),

  // Get effective profile (with viewAs override for UI preview)
  getEffectiveProfile: () => {
    const { profile, viewAs } = get();
    if (!profile) return null;
    if (!viewAs) return profile;
    
    return {
      ...profile,
      role: viewAs.role,
      managerType: viewAs.managerType || null,
    };
  },

  // Role helpers (respect viewAs for UI preview)
  isOwner: () => {
    const { profile, viewAs } = get();
    const effectiveRole = viewAs?.role || profile?.role;
    return effectiveRole === 'owner';
  },
  
  isManager: () => {
    const { profile, viewAs } = get();
    const effectiveRole = viewAs?.role || profile?.role;
    return effectiveRole === 'manager';
  },
  
  isStaff: () => {
    const { profile, viewAs } = get();
    const effectiveRole = viewAs?.role || profile?.role;
    return effectiveRole === 'staff';
  },
  
  hasRole: (roles) => {
    const { profile, viewAs } = get();
    const effectiveRole = viewAs?.role || profile?.role;
    return effectiveRole ? roles.includes(effectiveRole) : false;
  },

  initialize: async () => {
    // Prevent multiple simultaneous initializations
    if (isInitializing || get().initialized) {
      return;
    }
    
    isInitializing = true;
    set({ isLoading: true, error: null });

    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        set({ error: sessionError.message });
      }
      
      if (session?.user) {
        set({ user: session.user });
        await get().fetchProfile();
      }
    } catch (error) {
      console.error('Initialize error:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to initialize' });
    } finally {
      set({ initialized: true, isLoading: false });
      isInitializing = false;
    }

    // Set up auth state listener (only once)
    if (!authListenerSet) {
      authListenerSet = true;
      
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
          set({ user: session.user, error: null });
          await get().fetchProfile();
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, profile: null, viewAs: null, error: null });
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          set({ user: session.user });
        }
      });
    }
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Fetch profile error:', error);
        
        // In DEV mode, create a fallback profile for testing
        if (import.meta.env.DEV) {
          console.warn('DEV MODE: Using fallback profile');
          const fallbackProfile = createFallbackProfile(user);
          set({ profile: fallbackProfile });
          return;
        }
        
        // In production, set error but don't crash
        set({ error: 'Failed to load profile. Please try again.' });
        return;
      }

      if (data) {
        const profile: Profile = {
          id: data.id,
          email: data.email,
          fullName: data.full_name,
          role: data.role as UserRole,
          managerType: data.manager_type,
          avatarUrl: data.avatar_url,
          phone: data.phone,
          hireDate: data.hire_date,
          isActive: data.is_active ?? true,
          status: (data.status as import('@/types').ProfileStatus) ?? 'active',
          employmentType: data.employment_type ?? 'full_time',
          annualLeaveDays: data.annual_leave_days ?? 12,
          leaveDaysUsed: data.leave_days_used ?? 0,
          targetHoursWeek: data.target_hours_week ?? 40,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        set({ profile, error: null });
      }
    } catch (error) {
      console.error('Fetch profile error:', error);
      
      // In DEV mode, create a fallback profile
      if (import.meta.env.DEV) {
        console.warn('DEV MODE: Using fallback profile after error');
        const { user: u } = get();
        if (u) {
          const fallbackProfile = createFallbackProfile(u);
          set({ profile: fallbackProfile });
        }
        return;
      }
      
      set({ error: 'Failed to load profile. Please try again.' });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        set({ isLoading: false, error: error.message });
        throw error;
      }

      if (data.user) {
        set({ user: data.user });
        await get().fetchProfile();
      }

      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signUp: async (email: string, password: string, fullName: string, role: string) => {
    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
          },
        },
      });

      if (error) {
        set({ isLoading: false, error: error.message });
        throw error;
      }

      if (data.user) {
        set({ user: data.user });
        // Wait for trigger to create profile
        await new Promise(resolve => setTimeout(resolve, 1000));
        await get().fetchProfile();
      }

      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        set({ isLoading: false, error: error.message });
        throw error;
      }
      set({ user: null, profile: null, viewAs: null, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
}));

/**
 * Creates a fallback profile for DEV mode when Supabase profile fetch fails
 */
function createFallbackProfile(user: User): Profile {
  const now = new Date().toISOString();
  return {
    id: user.id,
    email: user.email || 'dev@example.com',
    fullName: (user.user_metadata as Record<string, unknown>)?.full_name as string || 
              (user.user_metadata as Record<string, unknown>)?.name as string || 
              'Dev User',
    role: 'owner', // Default to owner in dev for full access
    managerType: null,
    avatarUrl: (user.user_metadata as Record<string, unknown>)?.avatar_url as string | undefined,
    phone: undefined,
    hireDate: undefined,
    isActive: true,
    status: 'active' as import('@/types').ProfileStatus,
    employmentType: 'full_time',
    annualLeaveDays: 12,
    leaveDaysUsed: 0,
    targetHoursWeek: 40,
    createdAt: now,
    updatedAt: undefined,
  };
}