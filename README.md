# American Skill Hub — Academy Management

A calm, mobile-first web app for a single academy owner to manage students,
fees, payments, expenses, and see who owes money. It replaces a spreadsheet and
keeps everything synced in the cloud.

- **Currency:** PKR everywhere (`PKR 12,000`).
- **Stack:** React + Vite + TypeScript · Tailwind CSS (navy/gold) · Supabase
  (Postgres + Auth) · TanStack Query · React Router · lucide-react.
- **Works on phone and laptop**, single owner login.

---

## How the money math works (the engine)

All derived numbers — balance, overdue flag, months owed — are **computed on
read** in `src/lib/engine.ts`. Nothing derived is ever stored. The rules:

- An **enrollment** = one student in one course. Two courses = two rows.
- Fees (admission + monthly) are **manual per enrollment**; the course
  catalogue only *suggests* defaults.
- A monthly fee **accrues every month from the join date** until you set the
  status to **Completed** or **Dropped** (which freezes accrual).
- **Typing a fee ≠ receiving money.** A new student shows a balance immediately;
  it only drops when you **log a payment**. The UI surfaces this hint.
- **Balance = unpaid admission + unpaid accrued monthly** (one number).
- **Overdue is binary and strict:** red only when *past the due date* **and**
  *balance > 0*. Owes-but-not-yet-due is green. Completed/Dropped is grey.
- Partial payments never advance the month counter.

The engine is locked by unit tests (`src/lib/engine.test.ts`, pinned to
2026-06-19). Run them with `npm test`.

---

## 1. Set up the database (Supabase) — once

1. Create a free project at <https://supabase.com> → **New project**.
2. Open **SQL Editor → New query**, paste all of [`supabase_schema.sql`](./supabase_schema.sql),
   and click **Run**. This creates the 5 tables (`courses`, `enrollments`,
   `payments`, `expenses`, `settings`), seed courses, owner-only RLS, and the
   `enrollment_totals` view.
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
4. **Authentication → Users → Add user**: create your owner email + password.
   (Turn off email confirmation, or confirm via the email link.) This is your login.

---

## 2. Run it locally

Requires **Node.js 18+**.

```bash
# 1. Install dependencies
npm install

# 2. Add your Supabase keys
cp .env.example .env
# then edit .env:
#   VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
#   VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY

# 3. Start the dev server
npm run dev
```

Open the printed URL (usually <http://localhost:5173>) and log in with the user
you created in Supabase.

### Useful scripts

| Command           | What it does                          |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Start the local dev server            |
| `npm run build`   | Type-check and build for production   |
| `npm run preview` | Preview the production build locally  |
| `npm test`        | Run the engine unit tests (must pass) |

---

## 3. Deploy free on Vercel

1. Push this project to a GitHub repo.
2. Create a free account at <https://vercel.com> (sign in with GitHub).
3. **Add New → Project → Import** your repo. Vercel auto-detects Vite
   (build: `npm run build`, output: `dist`). `vercel.json` is already included so
   client-side routes work on refresh.
4. In **Project Settings → Environment Variables**, add the same two values from
   your `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. **Deploy.** You'll get a link like `your-app.vercel.app`. Open it on your
   phone and log in — same data, any device.

> Netlify works the same way: set the two env vars, build command `npm run build`,
> publish directory `dist`, and add a SPA redirect (`/* /index.html 200`).

Everything here fits comfortably in the free tiers of Supabase and Vercel.

---

## Project structure

```
src/
  lib/
    engine.ts        # pure money math (compute-on-read) + pkr() formatter
    engine.test.ts   # locked test cases (today = 2026-06-19)
    supabase.ts      # Supabase client (reads VITE_ env vars)
    types.ts         # database row shapes
    api.ts           # Supabase reads/writes + EN/RC/EX code generation
    hooks.ts         # TanStack Query hooks (run the engine, invalidate on save)
    dates.ts         # month-key helpers and date formatting
  auth/AuthProvider.tsx
  components/        # Layout, ProtectedRoute, shared UI primitives
  pages/             # Login, Home, Students, AddStudent, StudentDetail,
                     # LogPayment, Months, Settings
```

---

## Security note

This is a **single-owner** app. The Supabase RLS policies grant any
authenticated user full access, which is safe for one account. If you ever add
staff, tighten the policies in `supabase_schema.sql`.

The `.env` file holds your keys and is gitignored — never commit it.
