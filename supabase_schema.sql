-- =====================================================================
-- ACADEMY APP — Supabase / Postgres schema
-- Paste this whole file into:  Supabase → your project → SQL Editor → New query → Run
-- Creates 5 tables, sensible defaults, and owner-only security (RLS).
-- =====================================================================

-- ---------- COURSES (reference catalogue; suggested fees only) ----------
create table if not exists courses (
  id                  bigint generated always as identity primary key,
  name                text not null unique,
  instructor          text,                       -- label only, no logic
  typical_admission   numeric(10,2) default 0,
  typical_monthly     numeric(10,2) default 0,
  active              boolean default true,
  image_url           text,                       -- course photo (data URL); shown as the course avatar
  created_at          timestamptz default now()
);
-- If you created `courses` before image_url existed, run this once:
alter table courses add column if not exists image_url text;

-- ---------- ENROLLMENTS (one row = one student in one course) ----------
create table if not exists enrollments (
  id              bigint generated always as identity primary key,
  enroll_code     text unique,                    -- e.g. EN001 (app generates)
  student_name    text not null,
  phone           text,
  course_id       bigint references courses(id),
  course_name     text,                           -- snapshot label
  join_date       date not null,
  due_day         int not null default 1 check (due_day between 1 and 31),
  admission_fee   numeric(10,2) not null default 0,   -- MANUAL per student
  monthly_fee     numeric(10,2) not null default 0,   -- MANUAL per student
  discount        numeric(10,2) not null default 0,   -- per month
  status          text not null default 'Active'
                  check (status in ('Active','Completed','Dropped')),
  notes           text,
  created_at      timestamptz default now()
);

-- ---------- PAYMENTS (cash ledger; single source of truth) ----------
create table if not exists payments (
  id              bigint generated always as identity primary key,
  receipt_code    text unique,                    -- e.g. RC001 (app generates)
  enrollment_id   bigint references enrollments(id) on delete cascade not null,
  date            date not null default current_date,
  type            text not null check (type in ('Admission','Monthly')),
  method          text not null check (method in ('Cash','Online')),
  amount          numeric(10,2) not null check (amount > 0),   -- no refunds → positive only
  note            text,
  created_at      timestamptz default now()
);

-- ---------- EXPENSES (monthly outflows; filter by date for "month tabs") ----------
create table if not exists expenses (
  id              bigint generated always as identity primary key,
  expense_code    text unique,
  date            date not null default current_date,
  category        text,                           -- Rent|Salaries|Utilities|Supplies|Marketing|Other
  description     text,
  method          text check (method in ('Cash','Online')),
  amount          numeric(10,2) not null check (amount > 0),
  created_at      timestamptz default now()
);

-- ---------- SETTINGS (key/value) ----------
create table if not exists settings (
  key             text primary key,
  value           text
);

insert into settings (key, value) values
  ('academy_name', 'American Skill Hub - IT (Computer) & Spoken English Academy'),
  ('currency', 'PKR')
on conflict (key) do nothing;

-- ---------- Seed a few example courses (optional; delete if unwanted) ----------
insert into courses (name, instructor, typical_admission, typical_monthly) values
  ('Spoken English', 'Sara Khan',   5000, 3000),
  ('IELTS Prep',     'Bilal Ahmed', 12000, 8000),
  ('Graphic Design', 'Hina Raza',   10000, 6000),
  ('Web Development','Omar Sheikh',  15000, 9000),
  ('Quran Tajweed',  'Yusuf Ali',    2000, 1500)
on conflict (name) do nothing;

-- =====================================================================
-- ROW LEVEL SECURITY  — single-owner app: any logged-in user is the owner.
-- (For a single account this is safe. If you ever add staff, tighten these.)
-- =====================================================================
alter table courses     enable row level security;
alter table enrollments enable row level security;
alter table payments    enable row level security;
alter table expenses    enable row level security;
alter table settings    enable row level security;

-- Allow authenticated users full access; block anonymous.
do $$
declare t text;
begin
  foreach t in array array['courses','enrollments','payments','expenses','settings']
  loop
    execute format($f$
      drop policy if exists "auth full access" on %I;
      create policy "auth full access" on %I
        for all
        to authenticated
        using (true)
        with check (true);
    $f$, t, t);
  end loop;
end $$;

-- =====================================================================
-- OPTIONAL: a live view that pre-joins paid sums (handy for the app).
-- The app still computes balance/flag in code (engine.ts), but this
-- saves round-trips by giving paid totals per enrollment.
-- =====================================================================
create or replace view enrollment_totals as
select
  e.id as enrollment_id,
  coalesce(m.monthly_paid, 0)   as monthly_paid,
  coalesce(a.admission_paid, 0) as admission_paid
from enrollments e
left join (
  select enrollment_id, sum(amount) as monthly_paid
  from payments where type = 'Monthly' group by enrollment_id
) m on m.enrollment_id = e.id
left join (
  select enrollment_id, sum(amount) as admission_paid
  from payments where type = 'Admission' group by enrollment_id
) a on a.enrollment_id = e.id;

-- Done. Your tables are ready.
