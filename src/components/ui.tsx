import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';
  const variants: Record<string, string> = {
    primary: 'bg-gold text-navy hover:bg-gold-light shadow-sm',
    secondary: 'bg-navy text-white hover:bg-navy-light',
    ghost: 'bg-white text-navy ring-1 ring-slate-200 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------
// StatCard — big dashboard numbers
// ---------------------------------------------------------------------
export function StatCard({
  label,
  value,
  icon,
  tone = 'navy',
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: 'navy' | 'gold' | 'red';
}) {
  const tones: Record<string, string> = {
    navy: 'bg-navy text-white',
    gold: 'bg-gold text-navy',
    red: 'bg-red-600 text-white',
  };
  return (
    <div className={`rounded-2xl p-4 sm:p-5 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</span>
        {icon && <span className="opacity-80">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Flag badge (red overdue / green up_to_date / grey closed)
// ---------------------------------------------------------------------
export function FlagBadge({ flag }: { flag: 'overdue' | 'up_to_date' | 'closed' }) {
  const map = {
    overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-700 ring-red-200' },
    up_to_date: { label: 'Up to date', cls: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
    closed: { label: 'Closed', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  }[flag];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${map.cls}`}>
      {map.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: 'Active' | 'Completed' | 'Dropped' }) {
  const map = {
    Active: 'bg-navy/10 text-navy ring-navy/20',
    Completed: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    Dropped: 'bg-slate-100 text-slate-600 ring-slate-200',
  }[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${map}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-navy mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-navy placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-gold focus:border-gold transition';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

// ---------------------------------------------------------------------
// Misc states
// ---------------------------------------------------------------------
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
      <Loader2 className="w-5 h-5 animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-6">
      {icon && <div className="mx-auto mb-3 text-slate-300 flex justify-center">{icon}</div>}
      <p className="font-semibold text-navy">{title}</p>
      {message && <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">{message}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="rounded-2xl bg-red-50 ring-1 ring-red-200 p-4 text-sm text-red-700">
      <p className="font-semibold">Couldn't load data</p>
      <p className="mt-1 text-red-600/90">
        {message ?? 'Check your internet connection and Supabase keys, then try again.'}
      </p>
    </div>
  );
}
