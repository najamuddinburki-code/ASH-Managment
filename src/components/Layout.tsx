import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Users, Wallet, CalendarDays, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useSettings } from '../lib/hooks';
import { BrandMark } from './ui';

const navItems = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/students', label: 'Students', icon: Users, end: false },
  { to: '/pay', label: 'Payments', icon: Wallet, end: false },
  { to: '/months', label: 'Reports', icon: CalendarDays, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
];

export default function Layout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const academyName =
    settings?.find((s) => s.key === 'academy_name')?.value ?? 'American Skills Hub';

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-cream-light flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-navy text-white">
        <div className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <BrandMark onDark size="md" />
            <span className="hidden sm:block h-7 w-px bg-white/15" />
            <div className="min-w-0">
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-cyan font-semibold leading-none">
                Academy
              </p>
              <h1 className="text-sm font-bold truncate leading-tight mt-0.5">{academyName}</h1>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-5 pb-28">
        <Outlet />
      </main>

      {/* Bottom navigation (mobile-first, also fine on desktop) */}
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200">
        <div className="mx-auto max-w-3xl grid grid-cols-5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                  isActive ? 'text-cyan-dark' : 'text-slate-500 hover:text-navy'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-dark' : ''}`} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}
