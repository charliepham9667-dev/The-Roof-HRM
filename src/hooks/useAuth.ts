import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const {
    user,
    profile,
    isLoading,
    initialized,
    signIn,
    signUp,
    signOut,
    fetchProfile,
    initialize
  } = useAuthStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const role = profile?.role;

  const isOwner = role === 'owner';
  const isManager = role === 'manager';
  const isStaff = role === 'staff';

  return {
    user,
    profile,
    isLoading,
    initialized,
    signIn,
    signUp,
    signOut,
    fetchProfile,
    isOwner,
    isManager,
    isStaff
  };
}

