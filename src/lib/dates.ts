// Small date helpers for month filtering & display. All app-facing dates are
// ISO 'YYYY-MM-DD' strings; month keys are 'YYYY-MM'.

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Current month key, e.g. '2026-06'.
export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Inclusive start + exclusive end (first day of next month) for a 'YYYY-MM' key.
// Use as: .gte('date', start).lt('date', endExclusive)
export function monthBounds(monthKey: string): { start: string; endExclusive: string } {
  const [y, m] = monthKey.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const endExclusive = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  return { start, endExclusive };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// '2026-06' → 'June 2026'
export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

// '2026-06-19' → '19 Jun 2026'
export function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}

// Shift a 'YYYY-MM' key by n months (used by the month picker arrows).
export function shiftMonth(monthKey: string, n: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

// A sensible default date INSIDE a given month: today when it's the current
// month, otherwise the first of that month. Keeps the add-expense form pointed
// at the month the owner is actually viewing.
export function defaultDateForMonth(monthKey: string): string {
  return monthKey === currentMonthKey() ? todayISO() : `${monthKey}-01`;
}

// Inclusive first/last day of a 'YYYY-MM' key, for an <input type="date"> min/max.
export function monthDateLimits(monthKey: string): { min: string; max: string } {
  const [y, m] = monthKey.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this
  return { min: `${y}-${pad(m)}-01`, max: `${y}-${pad(m)}-${pad(lastDay)}` };
}
