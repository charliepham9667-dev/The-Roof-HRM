import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

/**
 * ProtectedRoute - Single source of truth for route protection
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const initialized = useAuthStore((s) => s.initialized);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initialize = useAuthStore((s) => s.initialize);
  const location = useLocation();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!initialized || isLoading) {
    return <AuthLoadingScreen message="Checking authentication..." />;
  }

  if (user && !profile) {
    return <AuthLoadingScreen message="Loading your profile..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Block pending/rejected users from accessing the app
  if (profile && (profile.status === 'pending' || profile.status === 'rejected')) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
}

function AuthLoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
        <p className="mt-8 text-xs text-muted-foreground/50">The Roof Workspace</p>
      </div>
    </div>
  );
}export default ProtectedRoute;