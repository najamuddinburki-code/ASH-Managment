import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Spinner } from './ui';

export default function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return <Outlet />;
}
