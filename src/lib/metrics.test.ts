import { describe, it, expect } from 'vitest';
import { compute, type Enrollment, type PaidTotals } from './engine';
import {
  chaseList,
  dashboardMetrics,
  methodSplit,
  monthReport,
  sumAmounts,
  type EnrollmentLike,
} from './metrics';
import type { Method } from './types';

// Pin "today" so the whole scenario is deterministic.
const TODAY = new Date('2026-06-19T00:00:00');

function E(over: Partial<Enrollment>): Enrollment {
  return {
    id: 1,
    student_name: 'Test',
    course_name: 'Spoken English',
    join_date: '2026-06-20',
    due_day: 5,
    admission_fee: 0,
    monthly_fee: 0,
    discount: 0,
    status: 'Active',
    ...over,
  };
}
const P = (m: number, a: number): PaidTotals => ({ monthly_paid: m, admission_paid: a });

// Build a computed enrollment exactly like the app's hooks do (compute on read).
function row(name: string, e: Partial<Enrollment>, paid: PaidTotals): EnrollmentLike & { name: string } {
  const enr = E({ ...e, student_name: name });
  return { name, status: enr.status, computed: compute(enr, paid, TODAY) };
}

// ---------------------------------------------------------------------
// A realistic academy: one student in every meaningful state.
// ---------------------------------------------------------------------
const newStudent = row('Ayesha (brand new)', { monthly_fee: 6000, admission_fee: 5000 }, P(0, 0));
const longOverdue = row(
  'Bilal (long unpaid)',
  { join_date: '2025-11-20', monthly_fee: 9000, admission_fee: 15000, due_day: 20 },
  P(18000, 0),
);
const partialOverdue = row(
  'Chnaya (partial)',
  { join_date: '2026-01-12', monthly_fee: 8000, discount: 2000, admission_fee: 12000, due_day: 12 },
  P(3000, 12000),
);
const paidUp = row('Daniyal (paid up)', { monthly_fee: 6000, admission_fee: 5000 }, P(6000, 5000));
const completed = row(
  'Erum (completed)',
  { join_date: '2026-01-02', monthly_fee: 9000, admission_fee: 15000, status: 'Completed' },
  P(36000, 15000),
);
const dropped = row(
  'Faisal (dropped, still owes)',
  { join_date: '2025-12-22', monthly_fee: 6000, discount: 1500, admission_fee: 10000, status: 'Dropped' },
  P(0, 0),
);

const academy = [newStudent, longOverdue, partialOverdue, paidUp, completed, dropped];

describe('per-student balances & flags (the whole roster)', () => {
  it('brand-new student owes admission + first month, not yet overdue', () => {
    expect(newStudent.computed.balance).toBe(11000);
    expect(newStudent.computed.flag).toBe('up_to_date');
  });

  it('long-unpaid active student is overdue with the right balance', () => {
    expect(longOverdue.computed.balance).toBe(69000);
    expect(longOverdue.computed.flag).toBe('overdue');
  });

  it('partial payment does not advance the month → still overdue', () => {
    expect(partialOverdue.computed.months_paid).toBe(0);
    expect(partialOverdue.computed.balance).toBe(33000);
    expect(partialOverdue.computed.flag).toBe('overdue');
  });

  it('fully-paid student shows zero balance, up to date', () => {
    expect(paidUp.computed.balance).toBe(0);
    expect(paidUp.computed.flag).toBe('up_to_date');
  });

  it('completed freezes accrual at zero balance and is never flagged', () => {
    expect(completed.computed.balance).toBe(0);
    expect(completed.computed.flag).toBe('closed');
  });

  it('dropped still owes admission but is closed (grey, not chased)', () => {
    expect(dropped.computed.admission_owed).toBe(10000);
    expect(dropped.computed.flag).toBe('closed');
    expect(dropped.computed.days_overdue).toBe(0);
  });
});

describe('dashboard metrics', () => {
  // The owner logged these payments during June 2026.
  const junePayments: { amount: number; method: Method }[] = [
    { amount: 6000, method: 'Cash' }, // Daniyal monthly
    { amount: 5000, method: 'Online' }, // Daniyal admission
    { amount: 3000, method: 'Cash' }, // Chnaya partial
  ];

  it('Total Owed counts only Active enrollments (excludes completed & dropped)', () => {
    const m = dashboardMetrics(academy, junePayments);
    // Active owing: 11000 + 69000 + 33000 + 0 (paid up) = 113000
    expect(m.totalOwed).toBe(113000);
  });

  it('Students Overdue counts only red flags', () => {
    const m = dashboardMetrics(academy, junePayments);
    expect(m.overdueCount).toBe(2); // Bilal + Chnaya
  });

  it('Cash In This Month sums every payment that month regardless of method', () => {
    const m = dashboardMetrics(academy, junePayments);
    expect(m.cashInMonth).toBe(14000);
  });

  it('Expected This Month sums net monthly over Active only (run-rate)', () => {
    const m = dashboardMetrics(academy, junePayments);
    // Active net monthlies: 6000 + 9000 + (8000-2000) + 6000 = 27000.
    // Completed (Erum) and Dropped (Faisal) are excluded.
    expect(m.expectedThisMonth).toBe(27000);
  });
});

describe('chase list (worst-first)', () => {
  it('lists only overdue students, biggest balance first', () => {
    const list = chaseList(academy);
    expect(list.map((e) => e.name)).toEqual(['Bilal (long unpaid)', 'Chnaya (partial)']);
  });

  it('breaks ties on balance by most days late', () => {
    const a = row('A', { join_date: '2026-03-10', monthly_fee: 5000, due_day: 10 }, P(0, 0));
    const b = row('B', { join_date: '2026-05-10', monthly_fee: 5000, due_day: 10 }, P(0, 0));
    // Both owe the same monthly accrual pattern but A joined earlier → more days late.
    const list = chaseList([b, a]);
    expect(list[0].computed.days_overdue).toBeGreaterThanOrEqual(list[1].computed.days_overdue);
  });

  it('is empty when nobody is overdue', () => {
    expect(chaseList([paidUp, completed, dropped])).toHaveLength(0);
  });
});

describe('month report (collections, expenses, profit, split)', () => {
  const payments: { amount: number; method: Method }[] = [
    { amount: 6000, method: 'Cash' },
    { amount: 5000, method: 'Online' },
    { amount: 3000, method: 'Cash' },
  ];
  const expenses = [{ amount: 30000 }, { amount: 4500 }]; // rent + utilities

  it('computes collected, spent and profit', () => {
    const r = monthReport(payments, expenses);
    expect(r.collected).toBe(14000);
    expect(r.spent).toBe(34500);
    expect(r.profit).toBe(-20500); // a loss month — must show negative, not clamp
  });

  it('splits collections into cash vs online', () => {
    const { cash, online } = methodSplit(payments);
    expect(cash).toBe(9000);
    expect(online).toBe(5000);
    expect(cash + online).toBe(sumAmounts(payments));
  });

  it('handles an empty month with no errors', () => {
    const r = monthReport([], []);
    expect(r).toEqual({ collected: 0, spent: 0, profit: 0, cash: 0, online: 0 });
  });
});

describe('numeric-as-string safety (PostgREST can return numeric as text)', () => {
  it('sumAmounts coerces string amounts', () => {
    // @ts-expect-error — intentionally simulate string amounts from the wire
    expect(sumAmounts([{ amount: '6000' }, { amount: '5000.50' }])).toBe(11000.5);
  });
});
