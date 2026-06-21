# ENGINE_LOGIC.md — The Calculation Heart

Implement this as a **pure, side-effect-free** module `src/lib/engine.ts`. Every value here is **derived on read** — never stored. Write `engine.test.ts` and make `TEST_CASES.md` pass before any UI work.

## Types

```ts
export type Status = 'Active' | 'Completed' | 'Dropped';
export type Flag = 'overdue' | 'up_to_date' | 'closed';

export interface Enrollment {
  id: number;
  student_name: string;
  phone?: string;
  course_name: string;
  join_date: string;      // ISO 'YYYY-MM-DD'
  due_day: number;        // 1..31
  admission_fee: number;
  monthly_fee: number;
  discount: number;
  status: Status;
}

export interface PaidTotals {
  monthly_paid: number;     // sum of type='Monthly' payments
  admission_paid: number;   // sum of type='Admission' payments
}

export interface Computed {
  net_monthly: number;
  months_elapsed: number;
  months_paid: number;
  monthly_due: number;
  monthly_owed: number;
  admission_owed: number;
  balance: number;          // headline: includes unpaid admission
  total_paid: number;
  next_due: Date | null;    // null when closed
  days_overdue: number;
  flag: Flag;
}
```

## Date helpers (implement carefully — the old bug lived here)

```ts
function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate(); // month is 1..12 here; day 0 = last day of prev
}

// Add whole months to a date, clamping the day to the target month length.
function addMonths(d: Date, n: number): Date {
  const y = d.getFullYear();
  const m = d.getMonth() + n;          // 0-indexed month math
  const targetYear = y + Math.floor(m / 12);
  const targetMonth0 = ((m % 12) + 12) % 12;
  const dim = daysInMonth(targetYear, targetMonth0 + 1);
  const day = Math.min(d.getDate(), dim);
  return new Date(targetYear, targetMonth0, day);
}

// Whole days between today and a due date (positive if due date is in the past).
function daysBetween(today: Date, due: Date): number {
  const ms = today.setHours(0,0,0,0) - due.setHours(0,0,0,0);
  return Math.floor(ms / 86400000);
}
```

## The main function

```ts
export function compute(e: Enrollment, paid: PaidTotals, today = new Date()): Computed {
  const join = new Date(e.join_date + 'T00:00:00');

  const net_monthly = Math.max(e.monthly_fee - e.discount, 0);

  // SAFE month arithmetic — never a backward date-diff (this was the #NUM! bug source).
  const months_elapsed = Math.max(
    (today.getFullYear() - join.getFullYear()) * 12 +
    (today.getMonth() - join.getMonth()) + 1,
    0
  );

  const months_paid = net_monthly === 0 ? 0 : Math.floor(paid.monthly_paid / net_monthly);

  const closed = e.status === 'Completed' || e.status === 'Dropped';
  const months_to_charge = closed ? months_paid : months_elapsed;
  const monthly_due = net_monthly * months_to_charge;

  const monthly_owed   = Math.max(monthly_due - paid.monthly_paid, 0);
  const admission_owed = Math.max(e.admission_fee - paid.admission_paid, 0);
  const balance = monthly_owed + admission_owed;
  const total_paid = paid.monthly_paid + paid.admission_paid;

  // next due date
  const dim = daysInMonth(join.getFullYear(), join.getMonth() + 1);
  const first_due = new Date(join.getFullYear(), join.getMonth(), Math.min(e.due_day, dim));
  const next_due = closed ? null : addMonths(first_due, months_paid);

  // Signed days from the due date (0 = due today, negative = not due yet).
  const overdue_by = closed || !next_due
    ? -Infinity
    : daysBetween(new Date(today), new Date(next_due));
  const days_overdue = Math.max(overdue_by, 0);

  let flag: Flag;
  if (closed) flag = 'closed';
  else if (overdue_by >= 0 && balance > 0) flag = 'overdue'; // due date reached (inclusive) + owes
  else flag = 'up_to_date';

  return {
    net_monthly, months_elapsed, months_paid, monthly_due, monthly_owed,
    admission_owed, balance, total_paid, next_due, days_overdue, flag,
  };
}
```

## Currency formatting (use everywhere)

```ts
export function pkr(n: number): string {
  return 'PKR ' + Math.round(n).toLocaleString('en-PK');
}
```

## Why each rule exists (so you don't "simplify" it wrongly)

- **months_elapsed uses +1 and max(…,0):** the join month is month one; guards a future join date.
- **Never DATEDIF-style backward diff:** the original spreadsheet crashed (`#NUM!`) when a due-day anchor landed after "today." Month arithmetic avoids it entirely.
- **months_paid floors on whole months:** a partial payment must NOT advance the month; it shows as balance instead.
- **closed freezes accrual:** Completed/Dropped stop the monthly charge growing — the only way to stop it.
- **balance includes admission:** owner wants ONE number = everything owed.
- **binary flag, due-date inclusive:** red needs (due date reached) AND (owes). The due date is the join-day anniversary, so a brand-new unpaid student is due — and chased — from day one; once a month is paid, the next due date is the same day next month and the student is green until it arrives.
