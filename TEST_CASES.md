# TEST_CASES.md — Lock the Engine (these MUST pass)

Write `src/lib/engine.test.ts` (Vitest) using these. **Pin `today = 2026-06-19`** in the tests so results are deterministic. All amounts in PKR.

```ts
import { describe, it, expect } from 'vitest';
import { compute, Enrollment, PaidTotals } from './engine';

const TODAY = new Date('2026-06-19T00:00:00');

function E(over: Partial<Enrollment>): Enrollment {
  return {
    id: 1, student_name: 'Test', course_name: 'Spoken English',
    join_date: '2026-06-20', due_day: 5,
    admission_fee: 0, monthly_fee: 0, discount: 0, status: 'Active',
    ...over,
  };
}
const P = (m: number, a: number): PaidTotals => ({ monthly_paid: m, admission_paid: a });
```

## Cases

| # | Enrollment | Paid (monthly, admission) | Expect |
|---|---|---|---|
| 1 | join 2026-06-20, monthly 6000, admission 5000, due_day 5 | (0, 0) | months_elapsed=1, monthly_due=6000, balance=**11000**, flag=`up_to_date` (due day 5 not yet passed in a future month → next_due ≥ today) |
| 2 | same as #1 | (0, 5000) | balance=**6000** (admission cleared, monthly still due) |
| 3 | same as #1 | (6000, 5000) | months_paid=1, monthly_owed=0, balance=**0**, flag=`up_to_date` |
| 4 | join 2025-11-20, monthly 9000, admission 15000, due_day 20 | (18000, 0) | months_elapsed=8, monthly_due=72000, monthly_owed=54000, admission_owed=15000, balance=**69000**, flag=`overdue` |
| 5 | join 2026-01-12, monthly 8000, discount 2000, admission 12000, due_day 12 | (3000, 12000) | net_monthly=6000, months_paid=0 (partial), monthly_owed = monthly_due − 3000, balance > 0, flag=`overdue` |
| 6 | join 2026-01-02, monthly 9000, admission 15000, status `Completed` | (36000, 15000) | months_to_charge frozen at months_paid(=4), monthly_due=36000, balance=**0**, flag=`closed`, next_due=null |
| 7 | join 2026-06-05, monthly 5000, admission 0, due_day 28 (28 > today 19) | (0, 0) | MUST NOT throw; months_elapsed=1; next_due = 2026-06-28; days_overdue=0; flag=`up_to_date` |
| 8 | join 2025-12-22, monthly 6000, discount 1500, admission 10000, status `Dropped` | (0, 0) | flag=`closed`, days_overdue=0, no accrual growth |

## Example assertions

```ts
describe('engine', () => {
  it('case 1: new student owes admission + first month', () => {
    const c = compute(E({ monthly_fee:6000, admission_fee:5000 }), P(0,0), TODAY);
    expect(c.months_elapsed).toBe(1);
    expect(c.monthly_due).toBe(6000);
    expect(c.balance).toBe(11000);
    expect(c.flag).toBe('up_to_date');
  });

  it('case 4: long unpaid active student is overdue with big balance', () => {
    const c = compute(
      E({ join_date:'2025-11-20', monthly_fee:9000, admission_fee:15000, due_day:20 }),
      P(18000, 0), TODAY
    );
    expect(c.months_elapsed).toBe(8);
    expect(c.balance).toBe(69000);
    expect(c.flag).toBe('overdue');
  });

  it('case 6: completed freezes accrual, balance zero', () => {
    const c = compute(
      E({ join_date:'2026-01-02', monthly_fee:9000, admission_fee:15000, status:'Completed' }),
      P(36000, 15000), TODAY
    );
    expect(c.balance).toBe(0);
    expect(c.flag).toBe('closed');
    expect(c.next_due).toBeNull();
  });

  it('case 7: due-day after today must not crash (the old #NUM! bug)', () => {
    expect(() => compute(
      E({ join_date:'2026-06-05', monthly_fee:5000, due_day:28 }),
      P(0,0), TODAY
    )).not.toThrow();
  });
});
```

If all of these pass, the core logic is correct. Build the UI on top with confidence.
