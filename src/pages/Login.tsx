import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button, Field, Input } from '../components/ui';

export default function Login() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
    else navigate('/');
  }

  return (
    <div className="relative min-h-screen bg-navy flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Spotlight — radial cyan glow on navy (brand signature) */}
      <div
        className="pointer-events-none absolute -top-32 -right-24 w-[480px] h-[480px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(31,198,238,.20), rgba(31,198,238,0) 65%)',
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          {/* ASH ● wordmark inside a logo pill */}
          <div className="mx-auto mb-5 inline-flex items-center gap-2.5 rounded-full bg-white/5 ring-1 ring-white/10 px-5 py-3">
            <span className="font-display text-4xl leading-none tracking-tight text-white">ASH</span>
            <span className="w-3 h-3 rounded-full bg-cyan shrink-0" />
          </div>
          <h1 className="font-display text-3xl tracking-tight text-white leading-none">
            American Skills Hub
          </h1>
          <p className="font-label text-cyan font-semibold text-sm tracking-[0.2em] uppercase mt-2">
            Academy Management
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-6 shadow-xl space-y-4"
        >
          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" loading={busy} className="w-full">
            Sign in
          </Button>
        </form>

        <p className="text-center text-white/40 text-xs mt-6">
          Single-owner access · your data stays private
        </p>
      </div>
    </div>
  );
}
