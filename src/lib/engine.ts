// =====================================================================
// engine.ts — The calculation heart of the academy app.
//
// PURE & SIDE-EFFECT-FREE. Every value is DERIVED ON READ — never stored.
// Implemented exactly per ENGINE_LOGIC.md. The unit tests in engine.test.ts
// (values from TEST_CASES.md) MUST pass before any UI relies on this.
// =====================================================================

export type Status = 'Active' | 'Completed' | 'Dropped';
export type Flag = 'overdue' | 'up_to_date' | 'closed';

export interface Enrollment {
  id: number;
  student_name: string;
  phone?: string;
  course_name: string;
  join_date: string; // ISO 'YYYY-MM-DD'
  due_day: number; // 1..31
  admission_fee: number;
  monthly_fee: number;
  discount: number;
  status: Status;
}

export interface PaidTotals {
  monthly_paid: number; // sum of type='Monthly' payments
  admission_paid: number; // sum of type='Admission' payments
}

export interface Computed {
  net_monthly: number;
  months_elapsed: number;
  months_paid: number;
  monthly_due: number;
  monthly_owed: number;
  admission_owed: number;
  balance: number; // headline: includes unpaid admission
  total_paid: number;
  next_due: Date | null; // null when closed
  days_overdue: number;
  flag: Flag;
}

// ---------------------------------------------------------------------
// Date helpers (implement carefully — the old #NUM! bug lived here).
// ---------------------------------------------------------------------

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate(); // month is 1..12 here; day 0 = last day of prev
}

// Add whole months to a date, clamping the day to the target month length.
function addMonths(d: Date, n: number): Date {
  const y = d.getFullYear();
  const m = d.getMonth() + n; // 0-indexed month math
  const targetYear = y + Math.floor(m / 12);
  const targetMonth0 = ((m % 12) + 12) % 12;
  const dim = daysInMonth(targetYear, targetMonth0 + 1);
  const day = Math.min(d.getDate(), dim);
  return new Date(targetYear, targetMonth0, day);
}

// Whole days between today and a due date (positive if due date is in the past).
function daysBetween(today: Date, due: Date): number {
  const ms = today.setHours(0, 0, 0, 0) - due.setHours(0, 0, 0, 0);
  return Math.floor(ms / 86400000);
}

// ---------------------------------------------------------------------
// The main function
// ---------------------------------------------------------------------

export function compute(e: Enrollment, paid: PaidTotals, today = new Date()): Computed {
  const join = new Date(e.join_date + 'T00:00:00');

  const net_monthly = Math.max(e.monthly_fee - e.discount, 0);

  // SAFE month arithmetic — never a backward date-diff (this was the #NUM! bug source).
  const months_elapsed = Math.max(
    (today.getFullYear() - join.getFullYear()) * 12 +
      (today.getMonth() - join.getMonth()) +
      1,
    0,
  );

  const months_paid = net_monthly === 0 ? 0 : Math.floor(paid.monthly_paid / net_monthly);

  const closed = e.status === 'Completed' || e.status === 'Dropped';
  const months_to_charge = closed ? months_paid : months_elapsed;
  const monthly_due = net_monthly * months_to_charge;

  const monthly_owed = Math.max(monthly_due - paid.monthly_paid, 0);
  const admission_owed = Math.max(e.admission_fee - paid.admission_paid, 0);
  const balance = monthly_owed + admission_owed;
  const total_paid = paid.monthly_paid + paid.admission_paid;

  // next due date.
  // first_due = the due-day, anchored to the join month — but NEVER before the
  // join date itself. If the due-day has already passed within the join month
  // (due_day falls earlier in the month than the join day), the first due rolls
  // forward one month. This guarantees a brand-new student is never instantly
  // "overdue" before they've joined (see TEST_CASES.md cases 1 & 7, and
  // CLAUDE.md golden rule 6: owes-but-not-yet-due = green). The ENGINE_LOGIC.md
  // pseudocode under-specified this edge; the rolled value is what the test lock
  // (and the case-1 note "next_due ≥ today") requires.
  const dim = daysInMonth(join.getFullYear(), join.getMonth() + 1);
  let first_due = new Date(join.getFullYear(), join.getMonth(), Math.min(e.due_day, dim));
  if (first_due.getTime() < join.getTime()) {
    first_due = addMonths(first_due, 1);
  }
  const next_due = closed ? null : addMonths(first_due, months_paid);

  const days_overdue =
    closed || !next_due ? 0 : Math.max(daysBetween(new Date(today), new Date(next_due)), 0);

  let flag: Flag;
  if (closed) flag = 'closed';
  else if (days_overdue > 0 && balance > 0) flag = 'overdue';
  else flag = 'up_to_date';

  return {
    net_monthly,
    months_elapsed,
    months_paid,
    monthly_due,
    monthly_owed,
    admission_owed,
    balance,
    total_paid,
    next_due,
    days_overdue,
    flag,
  };
}

// ---------------------------------------------------------------------
// Currency formatting (use everywhere).
// ---------------------------------------------------------------------

export function pkr(n: number): string {
  return 'PKR ' + Math.round(n).toLocaleString('en-PK');
}
