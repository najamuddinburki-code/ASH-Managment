// Pure metric helpers for the dashboard and month report. Kept side-effect free
// and dependency-light (engine + types only) so they can be unit-tested directly
// and reused by the screens — no duplicated math in components.

import type { Computed } from './engine';
import type { Method, Status } from './types';

// The minimum shape the metrics need from a computed enrollment.
export interface EnrollmentLike {
  status: Status;
  computed: Computed;
}

type AmountRow = { amount: number };
type MethodRow = { amount: number; method: Method | null };

// Sum a list of {amount} rows. Number() guards against numeric-as-string
// values that Postgres/PostgREST can return for numeric columns.
export function sumAmounts(rows: AmountRow[]): number {
  return rows.reduce((s, r) => s + Number(r.amount), 0);
}

// Split a month's collections by payment method (reconciliation only).
export function methodSplit(payments: MethodRow[]): { cash: number; online: number } {
  let cash = 0;
  let online = 0;
  for (const p of payments) {
    if (p.method === 'Cash') cash += Number(p.amount);
    else if (p.method === 'Online') online += Number(p.amount);
  }
  return { cash, online };
}

// Money collected grouped by the course each payment's enrollment belongs to —
// "how much is Spoken English making". `courseOf` resolves an enrollment id to a
// course label (callers map via their loaded enrollments). Sorted biggest-first.
export interface CourseEarning {
  course: string;
  amount: number;
}

export function earningsByCourse(
  payments: { enrollment_id: number; amount: number }[],
  courseOf: (enrollmentId: number) => string,
): CourseEarning[] {
  const totals = new Map<string, number>();
  for (const p of payments) {
    const course = courseOf(p.enrollment_id) || 'No course';
    totals.set(course, (totals.get(course) ?? 0) + Number(p.amount));
  }
  return [...totals.entries()]
    .map(([course, amount]) => ({ course, amount }))
    .sort((a, b) => b.amount - a.amount || a.course.localeCompare(b.course));
}

// ---------------------------------------------------------------------
// Dashboard
//   Cash In This Month = sum(payments this month)
//   Total Owed To You  = sum(balance over Active enrollments)
//   Students Overdue   = count(flag === 'overdue')
// ---------------------------------------------------------------------
export interface DashboardMetrics {
  cashInMonth: number;
  totalOwed: number;
  overdueCount: number;
}

export function dashboardMetrics(
  enrollments: EnrollmentLike[],
  monthPayments: AmountRow[],
): DashboardMetrics {
  const active = enrollments.filter((e) => e.status === 'Active');
  const totalOwed = active.reduce((s, e) => s + e.computed.balance, 0);
  const overdueCount = enrollments.filter((e) => e.computed.flag === 'overdue').length;
  return {
    cashInMonth: sumAmounts(monthPayments),
    totalOwed,
    overdueCount,
  };
}

// Overdue enrollments, worst-first: biggest balance first, then most days late.
// Generic so callers keep their richer row type (name, id, …).
export function chaseList<T extends EnrollmentLike>(enrollments: T[]): T[] {
  return enrollments
    .filter((e) => e.computed.flag === 'overdue')
    .sort(
      (a, b) =>
        b.computed.balance - a.computed.balance ||
        b.computed.days_overdue - a.computed.days_overdue,
    );
}

// ---------------------------------------------------------------------
// Month report
//   Profit = collected − expenses
// ---------------------------------------------------------------------
export interface MonthReport {
  collected: number;
  spent: number;
  profit: number;
  cash: number;
  online: number;
}

export function monthReport(payments: MethodRow[], expenses: AmountRow[]): MonthReport {
  const collected = sumAmounts(payments);
  const spent = sumAmounts(expenses);
  const { cash, online } = methodSplit(payments);
  return { collected, spent, profit: collected - spent, cash, online };
}
