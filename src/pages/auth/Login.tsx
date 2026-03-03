import { FormEvent, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

// iOS PWA standalone mode has a WebKit bug where inputs inside
// positioned/shadowed containers don't receive focus on tap.
// The only reliable fix is to call .focus() programmatically on touchend.
function usePWAInputFix() {
  const handleTouchEnd = (e: React.TouchEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    // Small timeout lets the tap event fully resolve before focusing
    setTimeout(() => input.focus(), 0);
  };
  return handleTouchEnd;
}

export function Login() {
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const profile = useAuthStore((s) => s.profile);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const fullNameRef = useRef<HTMLInputElement>(null);

  const handleTouchEnd = usePWAInputFix();

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
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#fff',
        padding: '48px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: 400,
          margin: '0 auto',
          backgroundColor: '#fff',
          padding: '32px 24px',
          borderRadius: 12,
          border: '1px solid #dad4c8',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1a1612', marginBottom: 4 }}>
            {mode === 'signin' ? 'Sign in to' : 'Sign up for'} The Roof HRM
          </h1>
          <p style={{ fontSize: 14, color: '#82786a' }}>
            Internal access for F&B owners and managers.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            backgroundColor: 'rgba(184,50,50,0.08)',
            border: '1px solid #b83232',
            color: '#b83232',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 14,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="fullName"
                style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#1a1612', marginBottom: 6 }}
              >
                Full Name
              </label>
              <input
                ref={fullNameRef}
                id="fullName"
                type="text"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onTouchEnd={handleTouchEnd}
                placeholder="Charlie Pham"
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="email"
              style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#1a1612', marginBottom: 6 }}
            >
              Work Email
            </label>
            <input
              ref={emailRef}
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onTouchEnd={handleTouchEnd}
              placeholder="you@venuegroup.com"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="password"
              style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#1a1612', marginBottom: 6 }}
            >
              Password
            </label>
            <input
              ref={passwordRef}
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onTouchEnd={handleTouchEnd}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '10px 0',
              backgroundColor: '#9a6f2e',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              touchAction: 'manipulation',
            }}
          >
            {isLoading && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
            {isLoading ? 'Signing in…' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        {/* Mode toggle */}
        <p style={{ textAlign: 'center', fontSize: 14, color: '#82786a', marginTop: 20 }}>
          {mode === 'signin' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                style={{ color: '#9a6f2e', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, touchAction: 'manipulation' }}
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
                style={{ color: '#9a6f2e', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, touchAction: 'manipulation' }}
              >
                Sign In
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  padding: '0 12px',
  fontSize: 16,   // 16px prevents iOS auto-zoom
  color: '#1a1612',
  backgroundColor: '#fff',
  border: '1px solid #dad4c8',
  borderRadius: 8,
  outline: 'none',
  boxSizing: 'border-box',
  // These are the critical iOS PWA properties:
  WebkitAppearance: 'none',
  touchAction: 'manipulation',
};
