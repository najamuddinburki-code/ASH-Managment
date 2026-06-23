// Pure metric helpers for the dashboard and month report. Kept side-effect free
// and dependency-light (engine + types only) so they can be unit-tested directly
// and reused by the screens — no duplicated math in components.

import type { Computed } from './engine';
import type { Method, PaymentType, Status } from './types';

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
// Collections grouped Course -> Student -> individual payments. Lets the month
// page show one student once (with their admission + monthly folded together)
// instead of a separate flat row per payment. `info` resolves an enrollment id
// to its student + course labels. Everything is sorted biggest-first.
// ---------------------------------------------------------------------
export interface CollectionPaymentLine {
  id: number;
  type: PaymentType;
  method: Method | null;
  date: string;
  amount: number;
}
export interface CollectionStudentGroup {
  enrollmentId: number;
  studentName: string;
  total: number;
  payments: CollectionPaymentLine[];
}
export interface CollectionCourseGroup {
  course: string;
  total: number;
  studentCount: number;
  students: CollectionStudentGroup[];
}

type CollectionPaymentRow = {
  id: number;
  enrollment_id: number;
  type: PaymentType;
  method: Method | null;
  date: string;
  amount: number;
};

export function groupCollectionsByCourse(
  payments: CollectionPaymentRow[],
  info: (enrollmentId: number) => { studentName: string; courseName: string },
): CollectionCourseGroup[] {
  const courses = new Map<string, Map<number, CollectionStudentGroup>>();
  for (const p of payments) {
    const meta = info(p.enrollment_id);
    const course = meta.courseName || 'No course';
    let students = courses.get(course);
    if (!students) {
      students = new Map();
      courses.set(course, students);
    }
    let sg = students.get(p.enrollment_id);
    if (!sg) {
      sg = {
        enrollmentId: p.enrollment_id,
        studentName: meta.studentName || 'Unknown',
        total: 0,
        payments: [],
      };
      students.set(p.enrollment_id, sg);
    }
    const amount = Number(p.amount);
    sg.total += amount;
    sg.payments.push({ id: p.id, type: p.type, method: p.method, date: p.date, amount });
  }

  const out: CollectionCourseGroup[] = [];
  for (const [course, students] of courses) {
    const studentGroups = [...students.values()].map((s) => ({
      ...s,
      // Newest payment first, then admission before monthly on the same day.
      payments: s.payments.sort(
        (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.type.localeCompare(b.type)),
      ),
    }));
    studentGroups.sort((a, b) => b.total - a.total || a.studentName.localeCompare(b.studentName));
    const total = studentGroups.reduce((s, g) => s + g.total, 0);
    out.push({ course, total, studentCount: studentGroups.length, students: studentGroups });
  }
  out.sort((a, b) => b.total - a.total || a.course.localeCompare(b.course));
  return out;
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
