import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
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
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gold/15 ring-1 ring-gold/40 flex items-center justify-center mb-4">
            <GraduationCap className="w-8 h-8 text-gold" />
          </div>
          <h1 className="text-xl font-extrabold text-white">American Skill Hub</h1>
          <p className="text-gold font-semibold text-sm mt-0.5">Academy Management</p>
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
