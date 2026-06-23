# American Skills Hub — Academy Management App

A developer-oriented overview of how the whole app works. Hand this to any engineer and they should be able to find their footing in ~15 minutes.

---

## 1. What the app is

A single-owner web app for an academy ("American Skill Hub — IT & Spoken English Academy") to manage **students, fees, payments, expenses**, and instantly see **who owes money**. It replaces a Google Sheet. It runs on phone and laptop, with data synced in the cloud. **All money is in PKR**, displayed as `PKR 12,000` (no decimals shown, stored to 2 dp).

There is exactly **one user** (the owner). No staff accounts, no student logins, no roles.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| UI framework | **React 18 + Vite + TypeScript** |
| Styling | **Tailwind CSS** (brand: navy `#0C0B2E`, signal cyan `#1FC6EE`, indigo, cream; fonts: Anton / Barlow Condensed / Inter) |
| Backend + DB + Auth | **Supabase** (hosted Postgres + Auth), via `@supabase/supabase-js` |
| Data fetching/caching | **TanStack Query** (`@tanstack/react-query`) |
| Routing | **React Router v6** |
| Icons | **lucide-react** |
| Hosting | **Vercel** (frontend) + **Supabase** (data) — all free tier |
| Tests | **Vitest** (unit tests for the engine + metrics + CSV) |

There is **no custom backend server**. The React app talks directly to Supabase from the browser. Supabase Row-Level Security (RLS) is what protects the data.

---

## 3. The core idea: "compute on read"

This is the single most important concept in the codebase.

**Derived numbers (balance, months owed, overdue flag, next due date) are NEVER stored.** They are recomputed from raw facts every time they're displayed. The only things stored are:
- the **fees** the owner typed (admission fee, monthly fee), and
- the **payment rows** (actual money received).

Everything else — how much a student owes, whether they're overdue, when their next payment is due — is calculated by a single pure function on the fly. This avoids the classic spreadsheet problem of stale/inconsistent derived columns.

That function lives in **`src/lib/engine.ts`**. It's pure (no I/O, no dates pulled from global state except an injectable `today`), and it's locked by unit tests in `src/lib/engine.test.ts` against the cases in `TEST_CASES.md`.

### The engine formulas (per enrollment)

```
net_monthly      = max(monthly_fee - discount, 0)
months_elapsed   = max((Y_now - Y_join)*12 + (M_now - M_join) + 1, 0)   // join month = month 1; never negative
monthly_paid     = sum(payments where type='Monthly')
admission_paid   = sum(payments where type='Admission')
months_paid      = net_monthly == 0 ? 0 : floor(monthly_paid / net_monthly)   // partial payment never advances a month
months_to_charge = status in (Completed,Dropped) ? months_paid : months_elapsed
monthly_due      = net_monthly * months_to_charge
monthly_owed     = max(monthly_due - monthly_paid, 0)
admission_owed   = max(admission_fee - admission_paid, 0)
balance          = monthly_owed + admission_owed         // ONE number = everything owed
next_due         = join-day anniversary + months_paid months
days_overdue     = closed ? 0 : max(today - next_due, 0)
flag             = Completed/Dropped → 'closed'
                   (today >= next_due AND balance > 0) → 'overdue'   // due date is INCLUSIVE
                   else → 'up_to_date'
```

Key domain rules baked into this:
1. **An "enrollment" = one student in one course.** A person in 2 courses = 2 rows, tracked independently.
2. **Fees are manual per enrollment.** The course catalogue only *suggests* defaults.
3. **Monthly fee accrues every month forever** from the join date, until status is set to `Completed`/`Dropped` (which freezes accrual).
4. **Typing a fee ≠ receiving money.** Balance only drops when a payment row exists. A brand-new student shows a balance immediately.
5. **Overdue is due-date INCLUSIVE.** Because the due date is the join-day anniversary, a brand-new unpaid student is overdue **from day one**. Once a month is paid, the next due date moves to the same day next month, and they're green until it arrives.
6. **Partial payments never advance the month counter** — the remainder shows as balance.
7. **Payment method (Cash/Online) is reconciliation only** — it never affects balances.
8. **No refunds** — payments are positive amounts only.

---

## 4. Data model (Supabase / Postgres)

Defined in **`supabase_schema.sql`** (paste into Supabase SQL editor). Mirrored in TypeScript at `src/lib/types.ts`. Five tables + one view:

- **`courses`** — reference catalogue. `name`, `instructor` (label only), `typical_admission`, `typical_monthly`, `active`. Suggested fees only; no logic.
- **`enrollments`** — the heart. One row = one student in one course. `student_name`, `phone`, `course_id`/`course_name` (snapshot), `join_date`, `due_day` (1–31, anchored to join day), `admission_fee`, `monthly_fee`, `discount`, `status` (`Active`/`Completed`/`Dropped`), `enroll_code` (e.g. `EN001`, app-generated).
- **`payments`** — the cash ledger; the single source of truth for money received. `enrollment_id` (FK, cascade delete), `date`, `type` (`Admission`/`Monthly`), `method` (`Cash`/`Online`), `amount` (> 0), `receipt_code` (e.g. `RC001`).
- **`expenses`** — outflows. `date`, `category`, `description`, `method`, `amount` (> 0), `expense_code` (e.g. `EX001`).
- **`settings`** — key/value (`academy_name`, `currency`).
- **`enrollment_totals`** (VIEW) — pre-joins each enrollment's `monthly_paid` and `admission_paid` sums so the app fetches paid totals in one round-trip instead of N. The engine still computes balance/flag in code; this view just supplies the two paid sums it needs.

**Security:** RLS is enabled on every table. A single policy ("auth full access", `for all`) grants any **authenticated** user full read/write and blocks anonymous users. Since there's exactly one account, "authenticated = the owner." (If staff were ever added, these policies would need tightening.)

---

## 5. Auth

- Supabase **email/password**, single owner account.
- `src/auth/AuthProvider.tsx` wraps the app, tracks the Supabase `session`, and exposes `signIn` / `signOut` via a React context (`useAuth`).
- `src/components/ProtectedRoute.tsx` gates every route except `/login`.

---

## 6. Data flow (how a screen gets its numbers)

```
Supabase tables ──▶ src/lib/api.ts (thin query functions)
                        │
                        ▼
              src/lib/hooks.ts (TanStack Query wrappers + mutations)
                        │   useComputedEnrollments(): fetch enrollments + enrollment_totals,
                        │   merge them, run compute() per row  ◀── src/lib/engine.ts
                        ▼
              src/lib/metrics.ts (pure dashboard/report aggregations)
                        │
                        ▼
                   pages/*.tsx render
```

- **`src/lib/api.ts`** — all Supabase calls (fetch/insert/update/delete for each table; auto-generates `EN`/`RC`/`EX` codes via `nextCode`).
- **`src/lib/hooks.ts`** — React Query hooks. The centerpiece is `useComputedEnrollments()`, which fetches enrollments + the totals view, merges them, and runs the engine per row to produce `ComputedEnrollment` objects. **Every mutation invalidates the relevant queries** (`useInvalidateAll`), so balances/flags refresh instantly after any save.
- **`src/lib/metrics.ts`** — pure functions over computed enrollments and payment/expense rows: `dashboardMetrics`, `chaseList` (overdue, worst-first), `monthReport` (collected/spent/profit + cash/online split), and `earningsByCourse` (per-course collections). All unit-tested.
- **`src/lib/dates.ts`** — ISO date + `YYYY-MM` month-key helpers (month bounds, shift month, format, default-date-for-month, etc.).
- **`src/lib/csv.ts`** — builds the month CSV export.

---

## 7. Screens (`src/pages`) and routes (`src/App.tsx`)

| Route | File | What it does |
|---|---|---|
| `/login` | `Login.tsx` | Email/password sign-in. Brand spotlight UI. |
| `/` | `Home.tsx` | Dashboard: 3 stat cards (Cash In This Month, Total Owed, Students Overdue), Add Student / Log Payment buttons, and the **chase list** (overdue students, worst-first, with a quick "record payment" link). |
| `/students` | `Students.tsx` | Roster, color-coded rows (red overdue / green ok / grey closed): Name · Course · Monthly · Status · Paid · Balance. |
| `/students/new` | `AddStudent.tsx` | Add-student form. Selecting a course pre-fills suggested fees. Due day is derived from the join date. |
| `/students/:id` | `StudentDetail.tsx` | Full payment history (each row editable/deletable), edit fees/status, mark Completed/Dropped, delete enrollment, and a collapsible "show working" panel exposing every engine value. |
| `/pay` | `LogPayment.tsx` | Log a payment: pick enrollment (searchable), type, method, amount, date. Can be pre-filled via query params from quick-pay links. |
| `/months` | `Months.tsx` | Month picker → that month's Collected / Expenses / Profit, Cash/Online split, **Earnings by Course**, collections list, and **Expenses** (add/edit/delete). CSV export. |
| `/settings` | `Settings.tsx` | Academy name + course catalogue (add/edit/retire courses and their suggested fees). |

Shared UI lives in `src/components/`: `Layout.tsx` (app shell + nav + `BrandMark`), `ui.tsx` (Button, Card, Field, Input, Select, StatCard, badges, `BrandMark` — the "ASH ●" wordmark with the non-negotiable cyan dot), `PaymentListItem.tsx` and `ExpenseListItem.tsx` (rows with **swipe-to-reveal Edit/Delete on touch, icon buttons on desktop**), `Receipt.tsx` (printable receipt).

---

## 8. Dashboard / report metric definitions

```
Cash In This Month   = sum(payments.amount where date in current month)
Total Owed To You    = sum(balance over enrollments where status = 'Active')
Students Overdue     = count(enrollments where flag = 'overdue')
Net Profit / month   = sum(payments in M) - sum(expenses in M)
Cash/Online (month)  = sum(payments where method = X and this month)
Earnings by Course   = sum(payments this month) grouped by enrollment's course
```

---

## 9. Local dev & deployment

**Run locally:**
```bash
npm install
cp .env.example .env      # then fill in your Supabase keys:
                          #   VITE_SUPABASE_URL=https://<project>.supabase.co
                          #   VITE_SUPABASE_ANON_KEY=<anon public key>
npm run dev               # Vite dev server
npm test                  # Vitest (engine + metrics + csv)
npm run build             # tsc --noEmit && vite build
```

**Database setup:** paste `supabase_schema.sql` into the Supabase SQL editor and run it once. Create the owner's account in Supabase Auth (email/password).

**Deploy:** push to GitHub; Vercel builds the frontend from the `main` branch and auto-redeploys on every merge. Supabase hosts the data. Set the two `VITE_SUPABASE_*` env vars in the Vercel project. Production URL: `ash-managment.vercel.app`.

> Note: the Supabase **anon key is a public client key** (safe to ship to the browser) — the database is protected by RLS, not by hiding the key.

---

## 10. Testing

- `src/lib/engine.test.ts` — locks the calculation engine against `TEST_CASES.md` (with `today` pinned to `2026-06-19` for determinism). **These must pass before trusting any UI number.**
- `src/lib/metrics.test.ts` — dashboard totals, chase-list ordering, month report, per-course earnings.
- `src/lib/csv.test.ts` — CSV export shape.

Reference docs in the repo: `CLAUDE.md` (product spec / source of truth), `ENGINE_LOGIC.md` (engine rationale), `TEST_CASES.md` (locked numeric cases), `README.md`.

---

## 11. Explicitly out of scope

Instructor commission · fixed course durations · refunds/reversals · attendance · capacity limits · student logins · roles/permissions · referral discounts · SMS/WhatsApp automation. The owner declined all of these — don't build them without asking.

---

## 12. Current state / possible next work

Recently added: due-date-inclusive overdue logic (overdue from day one), expense edit/delete, expense date defaulting to the viewed month, per-course earnings, and the ASH favicon.

**Requested but not yet built: bulk editing** (e.g. update the join date across many students at once). There is currently no bulk-edit UI — edits are one record at a time on each detail screen. A natural implementation would add multi-select on the Students list plus a "bulk edit" action that issues per-row `updateEnrollment` calls (the mutation already exists in `hooks.ts`).
