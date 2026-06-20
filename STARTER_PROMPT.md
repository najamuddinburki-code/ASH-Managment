# STARTER_PROMPT.md — Copy this into Claude Code

Copy everything in the box below and paste it as your first message to Claude Code (running in your `academy-app` folder). It already has `CLAUDE.md`, `ENGINE_LOGIC.md`, and `TEST_CASES.md` to work from.

---

```
Read CLAUDE.md, ENGINE_LOGIC.md, and TEST_CASES.md in this folder carefully — they are the complete spec for the app I want you to build. Follow them exactly. The end user is a non-technical academy owner; favor a calm, simple, mobile-friendly UI.

Build this in phases, and pause after each phase so I can check it:

PHASE 1 — Project setup
- Scaffold a Vite + React + TypeScript project in this folder.
- Add Tailwind CSS with a theme using deep navy (#0B1F3A), gold (#C8A24B), white. Mobile-first.
- Install: @supabase/supabase-js, @tanstack/react-query, react-router-dom, lucide-react, and vitest for tests.
- Create a Supabase client in src/lib/supabase.ts that reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from .env (the .env already exists with my keys).
- Confirm it runs (npm run dev) with a placeholder page.

PHASE 2 — The engine (do this before any real UI)
- Implement src/lib/engine.ts EXACTLY as specified in ENGINE_LOGIC.md (compute on read, safe month arithmetic, binary strict flag, balance includes admission).
- Write src/lib/engine.test.ts using TEST_CASES.md, with today pinned to 2026-06-19.
- Run the tests and make ALL cases pass. Show me the passing output. Do not proceed until green.

PHASE 3 — Auth + Home dashboard
- Supabase email/password login (single owner). Simple login page; protect all routes.
- Home: three big cards (Cash In This Month, Total Owed To You, Students Overdue), action buttons (Add Student, Log Payment), and the chase list (overdue enrollments, worst-first: name, owes, days late). Use the engine for all derived numbers. PKR formatting via the pkr() helper.

PHASE 4 — Students
- Students list with color-coded rows (red overdue / green up_to_date / grey closed): Name, Course, Monthly, Status, Paid, Balance.
- "Add Student" form (name, phone, course dropdown from courses table that pre-fills suggested fees, join date, due day, admission fee, monthly fee, discount). Auto-generate enroll_code like EN001.
- Row → detail page: full payment history, edit fees/status (Active/Completed/Dropped). Show engine "working" numbers in a collapsible section, hidden by default.

PHASE 5 — Log Payment
- Form: searchable enrollment picker, type (Admission/Monthly), method (Cash/Online), amount, date (default today). Auto-generate receipt_code like RC001.
- Show the hint: "This records money received; the balance updates automatically."
- After saving, balances/flags must reflect immediately (invalidate React Query cache).

PHASE 6 — Months / Reports + Expenses
- Month picker → that month's collections (from payments), an "Add Expense" form (date, category, description, method, amount), and Month Profit = collected − expenses. Cash/Online split for the month.

PHASE 7 — Settings + polish
- Settings: academy name (from settings table), course catalogue (add/edit/retire courses + suggested fees).
- Apply navy/gold theme consistently, ensure phone responsiveness, add empty states, and write a README with run + free-deploy (Vercel) instructions.

Remember the domain golden rules from CLAUDE.md, especially: typing a fee ≠ receiving money (surface this hint in the UI), monthly fees accrue automatically until Completed/Dropped, and overdue is binary+strict. Do NOT build anything in the "Out of scope" list.

Start with Phase 1 now.
```

---

## Tips while Claude Code works

- **Let it finish each phase**, then click through what it built before saying "continue to the next phase."
- If a number looks wrong, point it at `TEST_CASES.md`: *"Re-check the engine against TEST_CASES.md."*
- If the UI feels cluttered, say: *"Make this calmer and simpler — hide secondary info."*
- To deploy later: *"Help me deploy this to Vercel for free, step by step."*
- If you want the WhatsApp reminder feature later (we left it out), just ask: *"Add a one-tap WhatsApp reminder link for overdue students using wa.me deep links."*
