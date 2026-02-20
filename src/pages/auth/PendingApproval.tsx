import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Clock, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export function PendingApproval() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const [checking, setChecking] = useState(false);

  // If status flips to active, redirect to dashboard
  useEffect(() => {
    if (profile?.status === 'active') {
      navigate('/', { replace: true });
    }
    if (profile?.status === 'rejected') {
      // Stay on this page but show rejected state (handled below)
    }
  }, [profile?.status, navigate]);

  // Poll every 30 seconds to check if owner has approved
  useEffect(() => {
    const interval = setInterval(async () => {
      setChecking(true);
      await fetchProfile();
      setChecking(false);
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchProfile]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const isRejected = profile?.status === 'rejected';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-10 shadow-card text-center">
        {/* Logo / brand */}
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Clock className="h-7 w-7 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="font-serif text-xl font-semibold text-foreground">
            {isRejected ? 'Account Not Approved' : 'Pending Approval'}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isRejected
              ? 'Your account request was not approved. Please contact the venue owner directly if you believe this is a mistake.'
              : 'Your account has been created. The venue owner will review your request and assign your role before you can access the system.'}
          </p>
        </div>

        {!isRejected && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-left space-y-1">
            <p className="text-xs font-medium text-foreground">What happens next?</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Owner reviews your sign-up request</li>
              <li>Your role and details are assigned</li>
              <li>You receive access to your dashboard</li>
            </ol>
          </div>
        )}

        {/* Auto-check indicator */}
        {!isRejected && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            {checking
              ? <><Loader2 className="h-3 w-3 animate-spin" /> Checking status…</>
              : <><Clock className="h-3 w-3" /> Checking automatically every 30 seconds</>
            }
          </div>
        )}

        {/* Account info */}
        {profile && (
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-left">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Signed in as</p>
            <p className="text-sm font-medium text-foreground">{profile.fullName}</p>
            <p className="text-xs text-muted-foreground">{profile.email}</p>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
