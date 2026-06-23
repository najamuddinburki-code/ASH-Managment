import { forwardRef } from 'react';
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
  // Pills are a brand signature (100px radius). Inter 800 labels.
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';
  const variants: Record<string, string> = {
    primary: 'bg-cyan text-navy hover:bg-cyan-light shadow-sm',
    secondary: 'bg-navy text-white hover:bg-navy-light',
    ghost: 'bg-white text-navy ring-1 ring-slate-200 hover:bg-cyan-tint',
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
  tone?: 'navy' | 'cyan' | 'red';
}) {
  const tones: Record<string, string> = {
    navy: 'bg-navy text-white',
    cyan: 'bg-cyan text-navy',
    red: 'bg-red-600 text-white',
  };
  return (
    <div className={`rounded-2xl p-4 sm:p-5 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="font-label text-[12px] font-semibold uppercase tracking-[0.18em] opacity-80">
          {label}
        </span>
        {icon && <span className="opacity-80">{icon}</span>}
      </div>
      {/* Anton display for the hero number — the brand's "card number" role */}
      <div className="mt-2 font-display text-3xl sm:text-4xl tracking-tight leading-none break-words">
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// BrandMark — the "ASH ●" wordmark. The cyan dot is non-negotiable.
// ---------------------------------------------------------------------
export function BrandMark({
  onDark = false,
  size = 'md',
  withWordmark = false,
}: {
  onDark?: boolean;
  size?: 'sm' | 'md' | 'lg';
  withWordmark?: boolean;
}) {
  const text = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' }[size];
  const dot = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-3 h-3' }[size];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`font-display leading-none tracking-tight ${text} ${onDark ? 'text-white' : 'text-navy'}`}>
        ASH
      </span>
      <span className={`${dot} rounded-full bg-cyan shrink-0`} />
      {withWordmark && (
        <>
          <span className={`mx-1 h-5 w-px ${onDark ? 'bg-white/20' : 'bg-slate-300'}`} />
          <span
            className={`font-extrabold text-[10px] tracking-[0.12em] ${onDark ? 'text-white' : 'text-navy'}`}
          >
            AMERICAN SKILLS HUB
          </span>
        </>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------
// Avatar — initials circle. `tone="brand"` = uniform cyan (students);
// default derives a stable color from the name (nice for course circles).
// ---------------------------------------------------------------------
const AVATAR_TONES = [
  'bg-cyan/15 text-cyan-dark',
  'bg-indigo/10 text-indigo',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashTone(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length];
}

export function Avatar({
  name,
  size = 'md',
  tone = 'auto',
  className = '',
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'auto' | 'brand';
  className?: string;
}) {
  const dim = { sm: 'w-9 h-9 text-xs', md: 'w-11 h-11 text-sm', lg: 'w-16 h-16 text-2xl' }[size];
  const color = tone === 'brand' ? 'bg-cyan/15 text-cyan-dark' : hashTone(name);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-extrabold shrink-0 ${dim} ${color} ${className}`}
    >
      {initials(name)}
    </span>
  );
}

// Course avatar — the uploaded course photo when set, else initials.
export function CourseAvatar({
  name,
  imageUrl,
  size = 'md',
  className = '',
}: {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dim = { sm: 'w-9 h-9', md: 'w-11 h-11', lg: 'w-16 h-16' }[size];
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`rounded-full object-cover shrink-0 ring-1 ring-slate-200 ${dim} ${className}`}
      />
    );
  }
  return <Avatar name={name} size={size} className={className} />;
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
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-navy placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-cyan focus:border-cyan transition';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    return <input ref={ref} {...props} className={`${inputCls} ${props.className ?? ''}`} />;
  },
);

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
