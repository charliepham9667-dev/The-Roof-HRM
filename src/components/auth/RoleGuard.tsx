import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  /** When provided, the user's managerType must be one of these values (in addition to role check) */
  allowedManagerTypes?: string[];
  fallbackPath?: string;
}

/**
 * RoleGuard - Protects routes based on user role
 * 
 * Features:
 * - Shows loading state while profile is being fetched (instead of null)
 * - Owners always have access (bypass role check)
 * - Supports viewAs for dev mode role preview
 * - Supports optional allowedManagerTypes to gate manager sub-type routes
 * - Redirects to fallbackPath if role not allowed
 */
export function RoleGuard({ 
  children, 
  allowedRoles,
  allowedManagerTypes,
  fallbackPath = '/' 
}: RoleGuardProps) {
  const profile = useAuthStore((s) => s.profile);
  const viewAs = useAuthStore((s) => s.viewAs);
  const initialized = useAuthStore((s) => s.initialized);

  // Show loading while profile is being fetched
  // This prevents the blank screen issue
  if (!initialized || !profile) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Determine effective role — viewAs always overrides for UI preview
  const effectiveRole = viewAs?.role ?? profile.role;

  // Owners always have full access (unless previewing another role via viewAs)
  if (effectiveRole === 'owner') {
    return <>{children}</>;
  }

  // Check if user has required role
  if (!allowedRoles.includes(effectiveRole)) {
    return <Navigate to={fallbackPath} replace />;
  }

  // If the route is further gated by managerType, verify it
  if (allowedManagerTypes && allowedManagerTypes.length > 0) {
    const effectiveManagerType = (viewAs as any)?.managerType ?? (profile as any)?.managerType;
    if (!allowedManagerTypes.includes(effectiveManagerType)) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return <>{children}</>;
}

/**
 * Convenience wrappers for common role combinations
 */

/** Only allows owners */
export function OwnerOnly({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['owner']}>
      {children}
    </RoleGuard>
  );
}

/** Allows managers and owners */
export function ManagerOrOwner({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['owner', 'manager']}>
      {children}
    </RoleGuard>
  );
}

/** Allows all authenticated users */
export function AnyRole({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['owner', 'manager', 'staff']}>
      {children}
    </RoleGuard>
  );
}

export default RoleGuard;