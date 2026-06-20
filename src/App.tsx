import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import Placeholder from './pages/Placeholder';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/students" element={<Placeholder title="Students" phase="Phase 4" />} />
                <Route path="/students/new" element={<Placeholder title="Add Student" phase="Phase 4" />} />
                <Route path="/students/:id" element={<Placeholder title="Student" phase="Phase 4" />} />
                <Route path="/pay" element={<Placeholder title="Log Payment" phase="Phase 5" />} />
                <Route path="/months" element={<Placeholder title="Months & Reports" phase="Phase 6" />} />
                <Route path="/settings" element={<Placeholder title="Settings" phase="Phase 7" />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
