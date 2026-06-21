# CLAUDE.md — Academy Management App

> This file is read by Claude Code automatically. It is the single source of truth for what to build. Follow it exactly. When in doubt, prefer simplicity — the end user is a non-technical academy owner who wants a calm, fast tool.

## What we're building

A **cloud web app** for a single academy owner ("American Skill Hub - IT (Computer) & Spoken English Academy") to manage students, fees, payments, expenses, and see who owes money. It replaces a Google Sheet. It must work on **phone and laptop**, with data **synced in the cloud**.

**Currency: PKR everywhere.** Format as `PKR 12,000` (no decimals in display; store 2 dp).

## Tech stack (DECIDED — do not change)

- **Frontend:** React + Vite + TypeScript
- **Styling:** Tailwind CSS. Brand & Design System v1.0 — deep navy (`#0C0B2E`), signal cyan accent (`#1FC6EE`), indigo (`#1C1B5E`), cream (`#E7E5DF`), white, high contrast. Mobile-first. Type: Anton (display/big numbers), Barlow Condensed (labels/eyebrows), Inter (body). Buttons are pills; the "ASH ●" wordmark with its cyan dot is the brand mark.
- **Backend + DB + Auth:** Supabase (hosted Postgres). Use the `@supabase/supabase-js` client.
- **Hosting target:** Vercel or Netlify (frontend) + Supabase (data). All free tier.
- **State/data:** TanStack Query (`@tanstack/react-query`) for fetching/caching Supabase data.
- **Routing:** React Router.
- **Icons:** lucide-react.

Keep dependencies minimal. No Redux, no heavy UI kit. Plain Tailwind components.

## Golden rules of the domain (READ CAREFULLY — these are the whole point)

1. **An "enrollment" = one student in one course.** A person taking 2 courses = 2 enrollment rows. Each tracked independently. Re-enrollment = new row.
2. **Fees are MANUAL per enrollment** (admission + monthly), typed by the owner. The course catalogue only suggests default amounts.
3. **No fixed course duration.** A monthly fee **accrues automatically every month** from the join date, forever, until the owner sets the enrollment's status to `Completed` or `Dropped` (which freezes accrual).
4. **Typing a fee ≠ receiving money.** Setting fees only defines what's *expected*. Balance only drops when a **payment row** exists. A brand-new student correctly shows a balance until their first payment is logged — SURFACE THIS clearly in the UI with a hint so the owner isn't confused.
5. **Balance includes unpaid admission + unpaid accrued monthly.** One number = everything owed.
6. **Overdue is binary, due-date INCLUSIVE:** red when (today is on or past the due date) AND (balance > 0). The due date is the join-day anniversary, so a brand-new unpaid student is due — and red — from **day one**. Once a month is paid, the next due date is the same day next month and the student is green until it arrives. Closed (Completed/Dropped) = grey, never flagged.
7. **Partial payments never advance the month counter** — the unpaid remainder shows as balance.
8. **Payment method (Cash/Online)** is for reconciliation only; it never affects balances.
9. **No refunds, no commission, no attendance, no capacity, no student logins, no roles.** Single owner only. (See "Out of scope".)

## The engine (compute on read — never store derived values)

Implement these EXACTLY. See `ENGINE_LOGIC.md` for full detail and `TEST_CASES.md` for values that must match.

```
net_monthly      = max(monthly_fee - discount, 0)
months_elapsed   = max((Y_now - Y_join)*12 + (M_now - M_join) + 1, 0)   // NEVER use a date-diff that can go negative
monthly_paid     = sum(payments where type='Monthly' for this enrollment)
admission_paid   = sum(payments where type='Admission' for this enrollment)
months_paid      = net_monthly == 0 ? 0 : floor(monthly_paid / net_monthly)
months_to_charge = status in (Completed,Dropped) ? months_paid : months_elapsed
monthly_due      = net_monthly * months_to_charge
monthly_owed     = max(monthly_due - monthly_paid, 0)
admission_owed   = max(admission_fee - admission_paid, 0)
balance          = monthly_owed + admission_owed
total_paid       = monthly_paid + admission_paid
first_due        = date(join.year, join.month, min(due_day, daysInMonth(join.year, join.month)))
next_due         = addMonths(first_due, months_paid)        // clamp day to month length
days_overdue     = status in (Completed,Dropped) ? 0 : max(today - next_due, 0)
flag             = Completed→'closed' ; Dropped→'closed' ;
                   (today >= next_due AND balance>0)→'overdue' ; else 'up_to_date'
                   // due date is INCLUSIVE — a new unpaid student is due from day one
```

Put this in a single pure module `src/lib/engine.ts` with unit tests (`engine.test.ts`) using the values in `TEST_CASES.md`. The numbers MUST match before building UI.

## Screens to build (in this order)

1. **Auth** — Supabase email/password. Single owner. Simple login page.
2. **Home / Dashboard** — three big cards (Cash In This Month, Total Owed, Students Overdue), action buttons (Add Student, Log Payment), and the **chase list** (overdue, worst-first: name · owes · days late). Calm, navy/cyan.
3. **Students** — list with color-coded rows (red overdue / green ok / grey closed): Name · Course · Monthly · Status · Paid · Balance. "Add Student" form. Row → detail view (full payment history, edit fees/status). Engine "working" numbers in a collapsible section, hidden by default.
4. **Log Payment** — form: pick enrollment (searchable), type (Admission/Monthly), method (Cash/Online), amount, date (default today). Hint: "This records money received; balance updates automatically."
5. **Months / Reports** — month picker → that month's collections, expenses (add-expense form here), and profit (collected − expenses).
6. **Settings** — academy name, course catalogue (add/edit/retire courses + suggested fees).

## Database

Schema is in `supabase_schema.sql` — the user pastes it into the Supabase SQL editor. Tables: `courses`, `enrollments`, `payments`, `expenses`, `settings`. RLS policies included (owner-only). Do NOT invent extra tables.

## Dashboard metric definitions

```
Cash In This Month   = sum(payments.amount where date in current month)
Total Owed To You    = sum(balance over enrollments where status='Active')
Students Overdue     = count(enrollments where flag='overdue')
Active Enrollments   = count(enrollments where status='Active')
Net Profit (all time)= sum(payments.amount) - sum(expenses.amount)
Cash/Online (month)  = sum(payments.amount where method=X and this month)
Month profit(M)      = sum(payments in M) - sum(expenses in M)
```

## Out of scope (do NOT build — owner explicitly declined)

Instructor commission · fixed course durations · refunds/reversals · attendance · capacity limits · student logins · roles/permissions · sibling/referral discounts · SMS/WhatsApp automation · multi-year tab sprawl (use date filters instead).

## Definition of done

- Engine unit tests pass against `TEST_CASES.md`.
- Owner can: log in, add a student, log a payment, see balance/flag update, mark Completed/Dropped, add an expense, see month profit, and read the chase list sorted worst-first.
- Works responsively on a phone screen.
- Navy/cyan brand theme applied (Anton/Barlow Condensed/Inter, ASH wordmark). PKR formatting everywhere.
- README explains how to run locally and deploy free.
