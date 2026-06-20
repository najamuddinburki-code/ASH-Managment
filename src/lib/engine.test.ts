import { describe, it, expect } from 'vitest';
import { compute, pkr, type Enrollment, type PaidTotals } from './engine';

// Pin "today" so every derived value is deterministic (per TEST_CASES.md).
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

describe('engine — TEST_CASES.md', () => {
  it('case 1: new student owes admission + first month', () => {
    const c = compute(E({ monthly_fee: 6000, admission_fee: 5000 }), P(0, 0), TODAY);
    expect(c.months_elapsed).toBe(1);
    expect(c.monthly_due).toBe(6000);
    expect(c.balance).toBe(11000);
    expect(c.flag).toBe('up_to_date');
  });

  it('case 2: admission cleared, monthly still due', () => {
    const c = compute(E({ monthly_fee: 6000, admission_fee: 5000 }), P(0, 5000), TODAY);
    expect(c.admission_owed).toBe(0);
    expect(c.balance).toBe(6000);
  });

  it('case 3: fully paid first month → balance 0, up_to_date', () => {
    const c = compute(E({ monthly_fee: 6000, admission_fee: 5000 }), P(6000, 5000), TODAY);
    expect(c.months_paid).toBe(1);
    expect(c.monthly_owed).toBe(0);
    expect(c.balance).toBe(0);
    expect(c.flag).toBe('up_to_date');
  });

  it('case 4: long unpaid active student is overdue with big balance', () => {
    const c = compute(
      E({ join_date: '2025-11-20', monthly_fee: 9000, admission_fee: 15000, due_day: 20 }),
      P(18000, 0),
      TODAY,
    );
    expect(c.months_elapsed).toBe(8);
    expect(c.monthly_due).toBe(72000);
    expect(c.monthly_owed).toBe(54000);
    expect(c.admission_owed).toBe(15000);
    expect(c.balance).toBe(69000);
    expect(c.flag).toBe('overdue');
  });

  it('case 5: partial payment never advances the month counter', () => {
    const c = compute(
      E({
        join_date: '2026-01-12',
        monthly_fee: 8000,
        discount: 2000,
        admission_fee: 12000,
        due_day: 12,
      }),
      P(3000, 12000),
      TODAY,
    );
    expect(c.net_monthly).toBe(6000);
    expect(c.months_paid).toBe(0); // partial, must NOT advance
    expect(c.monthly_owed).toBe(c.monthly_due - 3000);
    expect(c.balance).toBeGreaterThan(0);
    expect(c.flag).toBe('overdue');
  });

  it('case 6: completed freezes accrual, balance zero', () => {
    const c = compute(
      E({ join_date: '2026-01-02', monthly_fee: 9000, admission_fee: 15000, status: 'Completed' }),
      P(36000, 15000),
      TODAY,
    );
    expect(c.months_paid).toBe(4);
    expect(c.monthly_due).toBe(36000); // frozen at months_paid, not months_elapsed
    expect(c.balance).toBe(0);
    expect(c.flag).toBe('closed');
    expect(c.next_due).toBeNull();
  });

  it('case 7: due-day after today must not crash (the old #NUM! bug)', () => {
    expect(() =>
      compute(E({ join_date: '2026-06-05', monthly_fee: 5000, due_day: 28 }), P(0, 0), TODAY),
    ).not.toThrow();

    const c = compute(
      E({ join_date: '2026-06-05', monthly_fee: 5000, due_day: 28 }),
      P(0, 0),
      TODAY,
    );
    expect(c.months_elapsed).toBe(1);
    expect(c.next_due).not.toBeNull();
    expect(c.next_due!.getFullYear()).toBe(2026);
    expect(c.next_due!.getMonth()).toBe(5); // June (0-indexed)
    expect(c.next_due!.getDate()).toBe(28);
    expect(c.days_overdue).toBe(0);
    expect(c.flag).toBe('up_to_date');
  });

  it('case 8: dropped is closed, no accrual growth, never flagged', () => {
    const c = compute(
      E({
        join_date: '2025-12-22',
        monthly_fee: 6000,
        discount: 1500,
        admission_fee: 10000,
        status: 'Dropped',
      }),
      P(0, 0),
      TODAY,
    );
    expect(c.flag).toBe('closed');
    expect(c.days_overdue).toBe(0);
    expect(c.next_due).toBeNull();
    expect(c.monthly_due).toBe(0); // frozen at months_paid (0) — no accrual growth
  });
});

describe('pkr() formatting', () => {
  it('formats with PKR prefix and thousands separators, no decimals', () => {
    expect(pkr(12000)).toBe('PKR 12,000');
    expect(pkr(0)).toBe('PKR 0');
    expect(pkr(6999.6)).toBe('PKR 7,000'); // rounds for display
  });
});
