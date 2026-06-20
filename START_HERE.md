# 🚀 START HERE — Build Your Academy App with Claude Code

This kit lets **Claude Code** build your complete academy software (React + Supabase, free, works on phone & laptop). You don't write code — Claude Code does. You do a little setup, then let it build.

**Total time:** ~30–45 min, most of it Claude Code working while you watch.

---

## What's in this kit

| File | What it's for | Who reads it |
|---|---|---|
| `CLAUDE.md` | The master spec — what to build, rules, stack | Claude Code (auto) |
| `ENGINE_LOGIC.md` | Exact calculation code | Claude Code |
| `TEST_CASES.md` | Tests the math must pass | Claude Code |
| `supabase_schema.sql` | Database setup (paste into Supabase) | **You** (once) |
| `STARTER_PROMPT.md` | The first message to give Claude Code | **You** (copy-paste) |
| `.env.example` | Template for your secret keys | **You** (fill in) |
| `START_HERE.md` | This guide | **You** |

---

## STEP 1 — Make a free Supabase project (your database) · ~5 min

1. Go to **https://supabase.com** → **Start your project** → sign in with Google/GitHub (free).
2. Click **New project**. Give it a name (e.g. "academy"), set a database password (save it somewhere), pick the closest region. Click **Create**. Wait ~2 min for it to spin up.
3. Once ready, open the **SQL Editor** (left sidebar) → **New query**.
4. Open the file **`supabase_schema.sql`** from this kit, copy ALL of it, paste into the query box, click **Run**. You should see "Success." Your 5 tables now exist.
5. Get your keys: left sidebar → **Project Settings** (gear) → **API**. Copy two things:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string)
   Keep these for Step 3.

### Create your owner login
6. Left sidebar → **Authentication** → **Users** → **Add user** → **Create new user**. Enter your email + a password. This is how you'll log into your app. (Turn OFF "email confirmation" prompt if it appears, or just confirm via the email.)

---

## STEP 2 — Install Claude Code · ~5 min

If you don't have it yet:
1. Make sure **Node.js** is installed (https://nodejs.org — get the LTS version).
2. Open a terminal (Command Prompt / PowerShell on Windows, Terminal on Mac).
3. Install Claude Code:
   ```
   npm install -g @anthropic-ai/claude-code
   ```
4. Make a folder for your project and put **all the files from this kit** inside it:
   ```
   mkdir academy-app
   cd academy-app
   ```
   Copy `CLAUDE.md`, `ENGINE_LOGIC.md`, `TEST_CASES.md`, `supabase_schema.sql`, `.env.example`, `STARTER_PROMPT.md`, `START_HERE.md` into this `academy-app` folder.
5. Start Claude Code from inside that folder:
   ```
   claude
   ```
   (Follow the one-time login it prompts for.)

---

## STEP 3 — Add your secret keys · ~2 min

1. In your `academy-app` folder, make a copy of `.env.example` and name it `.env`.
2. Open `.env` and paste your two values from Step 1:
   ```
   VITE_SUPABASE_URL=https://abcd1234.supabase.co
   VITE_SUPABASE_ANON_KEY=your-long-anon-key-here
   ```
3. Save. (This file stays private on your computer — never share it.)

---

## STEP 4 — Tell Claude Code to build it · the fun part

1. Open **`STARTER_PROMPT.md`**, copy the whole prompt.
2. Paste it into Claude Code (the `claude` session running in your terminal) and press Enter.
3. Claude Code will read `CLAUDE.md`, set up the project, build the engine, run the tests, and build the screens. **Let it work.** It may ask you to confirm steps or run commands — say yes.
4. When it says it's ready, run the app:
   ```
   npm run dev
   ```
   Open the link it shows (usually `http://localhost:5173`) in your browser. Log in with the email/password you made in Step 1. 🎉

---

## STEP 5 — Put it online (free) so your phone can use it · ~10 min

When you're happy with it locally:
1. Make a free account at **https://vercel.com** (sign in with GitHub).
2. Ask Claude Code: *"Help me deploy this to Vercel"* — it will guide you (push to GitHub, import to Vercel, add the two environment variables from your `.env`).
3. Vercel gives you a web link (like `academy-app.vercel.app`). Open it on your phone, log in — your app, on any device, synced.

---

## If something goes wrong

- **Just ask Claude Code.** It can see the errors and fix them. Tell it exactly what happened: "I ran X and got this error: [paste]."
- **Database errors** → re-check that `supabase_schema.sql` ran successfully (Step 1.4) and your `.env` keys are correct.
- **Can't log in** → make sure you created a user in Supabase Auth (Step 1.6) and you're using that exact email/password.

---

## A note on cost

Everything here is **free for your size**:
- Supabase free tier: way more than a single academy needs.
- Vercel free tier: plenty for personal use.
- Claude Code: you'll use your Claude subscription/credits to build it (the building is the main cost, one-time-ish).

No servers to rent, no monthly fees to run a single academy.

---

## What you'll end up with

A real web app where you:
- Log in securely from phone or laptop
- Add students (multiple courses each), with manual fees
- Log payments (admission/monthly, cash/online) — balances update live
- See who's overdue, sorted worst-first, with exact amounts
- Mark students Completed/Dropped (stops their fee accruing)
- Track monthly expenses and see monthly profit
- All in PKR, navy/gold, synced in the cloud

Good luck — and remember, Claude Code is your builder. When in doubt, just ask it.
