import { FormEvent, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Label } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';

export function Login() {
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');

  // Redirect already-authenticated active users away from login
  const profile = useAuthStore((s) => s.profile);
  useEffect(() => {
    if (user && profile) {
      if (profile.status === 'pending' || profile.status === 'rejected') {
        navigate('/pending-approval', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (mode === 'signup') {
        await signUp(email, password, fullName, 'staff');
        navigate('/pending-approval');
      } else {
        await signIn(email, password);
        navigate('/');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md space-y-6 p-8">
        <div className="space-y-1 text-center">
          <h1 className="font-serif text-xl font-semibold text-foreground">
            {mode === 'signin' ? 'Sign in to' : 'Sign up for'} The Roof HRM
          </h1>
          <p className="text-sm text-muted-foreground">
            Internal access for F&B owners and managers.
          </p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error text-error px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Charlie Pham"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@venuegroup.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === 'signin' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="text-primary hover:underline"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-primary hover:underline"
              >
                Sign In
              </button>
            </>
          )}
        </p>
      </Card>
    </div>
  );
}

