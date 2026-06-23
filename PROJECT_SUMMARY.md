# American Skills Hub — Academy Management App

A developer-oriented overview of the whole app as it stands today. Hand this to any engineer and they should be productive in ~15 minutes.

---

## 1. What the app is

A single-owner web app for an academy ("American Skill Hub — IT & Spoken English Academy") to manage **students, fees, payments, expenses**, and instantly see **who owes money**. It replaces a Google Sheet, works on phone and laptop, and syncs to the cloud. **All money is in PKR**, shown as `PKR 12,000` (no decimals in display; stored to 2 dp).

There is exactly **one user** — the owner. No staff accounts, no student logins, no roles.

Live at: `ash-managment.vercel.app` (deploys from the `main` branch).

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| UI | **React 18 + Vite + TypeScript** |
| Styling | **Tailwind CSS** — navy `#0C0B2E`, signal cyan `#1FC6EE`, indigo, cream; fonts Anton (display) / Barlow Condensed (labels) / Inter (body); "ASH ●" wordmark with the cyan dot |
| Backend + DB + Auth | **Supabase** (hosted Postgres + Auth), via `@supabase/supabase-js` |
| Data fetching/caching | **TanStack Query** (`@tanstack/react-query`) |
| Routing | **React Router v6** |
| Icons | **lucide-react** |
| Hosting | **Vercel** (frontend) + **Supabase** (data), free tier |
| Tests | **Vitest** (engine, metrics, csv) |

No custom backend server — the React app talks directly to Supabase from the browser. Data is protected by Supabase Row-Level Security (RLS), not by hiding keys.

---

## 3. The core idea: "compute on read"

The single most important concept. **Derived numbers (balance, months owed, overdue flag, next-due date) are NEVER stored.** Only raw facts are stored: the **fees** the owner typed and the **payment rows** (money received). Everything else is recomputed on the fly by one pure function — `src/lib/engine.ts` — every time it's shown. This avoids stale/inconsistent derived columns (the classic spreadsheet failure).

The engine is pure and locked by unit tests (`src/lib/engine.test.ts`) against `TEST_CASES.md`, with `today` pinned for determinism.

### Engine formulas (per enrollment)

```
net_monthly      = max(monthly_fee - discount, 0)
months_elapsed   = max((Y_now - Y_join)*12 + (M_now - M_join) + 1, 0)   // join month = month 1; never negative
months_paid      = net_monthly == 0 ? 0 : floor(monthly_paid / net_monthly)  // partial payment never advances a month
months_to_charge = status in (Completed,Dropped) ? months_paid : months_elapsed
monthly_owed     = max(net_monthly * months_to_charge - monthly_paid, 0)
admission_owed   = max(admission_fee - admission_paid, 0)
balance          = monthly_owed + admission_owed          // ONE number = everything owed
next_due         = join-day anniversary + months_paid months
flag             = Completed/Dropped → 'closed'
                   (today >= next_due AND balance > 0) → 'overdue'   // due date is INCLUSIVE
                   else → 'up_to_date'
```

Key domain rules:
1. **One enrollment = one student in one course.** Two courses = two rows, tracked independently.
2. **Fees are manual per enrollment.** The course catalogue only *suggests* defaults.
3. **Monthly fee accrues every month forever** from the join date until status is `Completed`/`Dropped` (which freezes accrual).
4. **Typing a fee ≠ receiving money.** Balance only drops when a payment row exists.
5. **Overdue is due-date INCLUSIVE.** The due date is the join-day anniversary, so a brand-new unpaid student is overdue **from day one**. After a month is paid, the next due date is the same day next month; they're green until it arrives.
6. **Partial payments never advance the month counter** — the remainder shows as balance.
7. **Payment method (Cash/Online) is reconciliation only** — it never affects balances.
8. **No refunds** — payment amounts are positive only.

---

## 4. Data model (Supabase / Postgres)

In `supabase_schema.sql` (paste into the Supabase SQL editor once). Mirrored in `src/lib/types.ts`. Five tables + one view:

- **`courses`** — catalogue. `name`, `instructor` (label only), `typical_admission`, `typical_monthly`, `active`. Suggested fees only; no logic.
- **`enrollments`** — the heart. One row = one student in one course. `student_name`, `phone`, `course_id`/`course_name` (snapshot), `join_date`, `due_day` (1–31, anchored to join day), `admission_fee`, `monthly_fee`, `discount`, `status` (`Active`/`Completed`/`Dropped`), `enroll_code` (e.g. `EN001`).
- **`payments`** — the cash ledger; single source of truth for money received. `enrollment_id` (FK, cascade delete), `date`, `type` (`Admission`/`Monthly`), `method` (`Cash`/`Online`), `amount` (> 0), `receipt_code` (e.g. `RC001`).
- **`expenses`** — outflows. `date`, `category`, `description`, `method`, `amount` (> 0), `expense_code` (e.g. `EX001`).
- **`settings`** — key/value (`academy_name`, `currency`).
- **`enrollment_totals`** (VIEW) — pre-joins each enrollment's `monthly_paid` and `admission_paid` sums, so the app fetches paid totals in one round-trip instead of N. The engine still computes balance/flag in code.

**Security:** RLS enabled on every table; one policy ("auth full access", `for all`) grants any authenticated user full read/write and blocks anonymous. One account ⇒ authenticated = owner.

---

## 5. Auth

Supabase email/password, single owner. `src/auth/AuthProvider.tsx` tracks the session and exposes `signIn`/`signOut` via `useAuth`. `src/components/ProtectedRoute.tsx` gates every route except `/login`.

---

## 6. Data flow

```
Supabase tables
   └─ src/lib/api.ts          thin query/insert/update/delete functions (auto-generates EN/RC/EX codes)
        └─ src/lib/hooks.ts   TanStack Query hooks + mutations
              │  useComputedEnrollments(): fetch enrollments + enrollment_totals,
              │  merge, run compute() per row  ◀── src/lib/engine.ts
              └─ src/lib/metrics.ts   pure aggregations
                    └─ src/pages/*.tsx  render
```

- **`api.ts`** — all Supabase calls. Enrollments: insert/update/delete + **`bulkUpdateEnrollments`** (one round-trip via `.in('id', ids)`). Payments & expenses: insert/update/delete. Courses & settings: insert/update/upsert.
- **`hooks.ts`** — query hooks + mutations. Centerpiece `useComputedEnrollments()` merges enrollments + totals and runs the engine per row → `ComputedEnrollment`. **Every mutation invalidates the relevant queries**, so balances/flags refresh instantly.
- **`metrics.ts`** (pure, unit-tested):
  - `sumAmounts`, `methodSplit`
  - `dashboardMetrics` (cash in / total owed / overdue count)
  - `chaseList` (overdue, biggest first, then most days late)
  - `monthReport` (collected / spent / profit + cash/online split)
  - `earningsByCourse` (per-course collected totals)
  - `groupCollectionsByCourse` (Course → Student → payment lines for the Reports accordion)
- **`dates.ts`** — ISO date + `YYYY-MM` month-key helpers (bounds, shift, format, default-date-for-month, month date limits).
- **`csv.ts`** — builds the month CSV export.

---

## 7. Screens & routes (`src/App.tsx`)

Bottom nav: **Home · Students · Payments · Reports · Settings**.

| Route | File | What it does |
|---|---|---|
| `/login` | `Login.tsx` | Email/password sign-in; brand spotlight UI. |
| `/` | `Home.tsx` | Dashboard: 3 cards (Money In · month, Total Owed To You, Students Overdue), Add Student / Log Payment, and the **"Who Owes You"** chase list (overdue, biggest first, with one-tap Record Payment). |
| `/students` | `Students.tsx` | Roster, color-coded by flag, each row shows **Owes / Paid**. Search + filter chips (All/Overdue/Up to date/Closed). **Bulk edit:** "Select" mode adds checkboxes → set a common **join date** across many students at once. |
| `/students/new` | `AddStudent.tsx` | Add-student form; picking a course pre-fills suggested fees; due day derives from the join date. |
| `/students/:id` | `StudentDetail.tsx` | Summary (Owes, Paid so far, Joined on, Fee due each month, Monthly fee, Next payment due, Days late), Log Payment, Edit Student (name/phone/course/fees/status), Delete Student, payment history (swipe to edit/delete), and a collapsible "show working" panel exposing every engine value. |
| `/pay` | `LogPayment.tsx` | **Guided flow:** search → select → a single **Selected Student** card (name, course, balance, flag) → **quick-amount buttons** (Monthly Fee / Admission Fee / Clear Balance / Custom Amount; each sets type + amount in one tap) → Save (disabled until student + amount > 0 + type + method + date). Then a printable/shareable **Receipt**. Recent payments list below (swipe to edit/delete). |
| `/months` | `Months.tsx` | **Reports.** Month picker → Collected / Expenses / Month Profit, Cash/Online split, **Collections by Course accordion** (Course → Student → individual payments), **Expenses** (add + swipe to edit/delete), and **Export Report** (CSV). |
| `/settings` | `Settings.tsx` | Academy name + course catalogue (add / edit / retire courses and their suggested fees). |

**Shared components** (`src/components`): `Layout` (app shell + nav + `BrandMark`), `ui.tsx` (Button, Card, Field, Input [forwards refs], Select, StatCard, FlagBadge, StatusBadge, EmptyState, ErrorState, Spinner, BrandMark), `PaymentListItem` & `ExpenseListItem` (rows with **swipe-to-reveal Edit/Delete on touch, icon buttons on desktop**), `Receipt` (printable + native share / copy).

**Favicon:** `public/favicon.svg` — navy tile, white "ASH", cyan dot.

---

## 8. Key metric definitions

```
Money In (month)     = sum(payments.amount where date in month)
Total Owed To You    = sum(balance over enrollments where status = 'Active')
Students Overdue     = count(enrollments where flag = 'overdue')
Month Profit         = sum(payments in M) - sum(expenses in M)
Cash / Online split  = sum(payments where method = X and this month)
Collections by Course= month's payments grouped Course -> Student -> payment lines
```

---

## 9. UX conventions worth knowing

- **Numbers are labelled** ("Owes" / "Paid"), buttons use plain action words (Add Student, Save Payment, Export Report…), messages are short and friendly.
- **Touch vs desktop:** edit/delete rows are swipe-to-reveal on phones (coarse pointer) and icon buttons on desktop — see `useCoarsePointer()`.
- **One student, once:** the Reports collections list and the Payment picker each show a student a single time, even though admission and monthly are separate payment rows underneath.
- **Destructive actions confirm first** (delete student/payment/expense, bulk edit apply).

---

## 10. Local dev & deployment

```bash
npm install
cp .env.example .env       # add Supabase keys:
                           #   VITE_SUPABASE_URL=https://<project>.supabase.co
                           #   VITE_SUPABASE_ANON_KEY=<anon public key>
npm run dev                # Vite dev server
npm test                   # Vitest (engine + metrics + csv)
npm run build              # tsc --noEmit && vite build
```

- **Database:** run `supabase_schema.sql` once in the Supabase SQL editor; create the owner's account in Supabase Auth.
- **Deploy:** push to GitHub → Vercel builds `main` and auto-redeploys on every merge. Set the two `VITE_SUPABASE_*` env vars in Vercel. The Supabase anon key is a public client key (safe in the browser); RLS protects the data.

---

## 11. Testing

- `engine.test.ts` — locks the calculation engine against `TEST_CASES.md` (today pinned). **Must pass before trusting any UI number.**
- `metrics.test.ts` — dashboard totals, chase-list ordering, month report, per-course earnings, Course→Student→payment grouping.
- `csv.test.ts` — CSV export shape.

Currently **38 tests, all green.** Reference docs in the repo: `CLAUDE.md` (product spec / source of truth), `ENGINE_LOGIC.md` (engine rationale), `TEST_CASES.md` (locked numbers), `README.md`.

---

## 12. Explicitly out of scope

Instructor commission · fixed course durations · refunds/reversals · attendance · capacity limits · student logins · roles/permissions · referral discounts · SMS/WhatsApp automation. The owner declined these — don't build them without asking.

---

## 13. Feature checklist (what exists today)

- Login (single owner), protected routes
- Dashboard with chase list ("Who Owes You")
- Students: list, search, filters, Owes/Paid display, add, edit, delete
- **Bulk-edit join date** across selected students
- Add / edit student fees & status; mark Completed/Dropped
- **Log Payment**: guided flow, quick-amount buttons, validation, receipt (print/share)
- Payment history with swipe edit/delete
- Reports: month picker, profit, cash/online split, **Collections by Course accordion**, CSV export
- Expenses: add, **edit/delete**, date locked to the viewed month
- Per-course earnings
- Settings: academy name + course catalogue (add/edit/retire)
- Compute-on-read engine, **overdue-from-day-one** logic, unit-tested
- PKR formatting, navy/cyan brand theme, ASH favicon, mobile-first responsive

### Possible next steps (not built)
- Bulk-edit other fields (status, monthly fee, course) — the API/UI pattern already exists for join date.
- One-tap "pay everything" on the Payment page that auto-creates the two payments when a new student owes both admission and a month.
- A "shift each student's join date by an offset" variant of bulk edit.
