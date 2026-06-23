import { useEffect, useState, type FormEvent } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  ReceiptText,
} from 'lucide-react';
import { pkr } from '../lib/engine';
import {
  currentMonthKey,
  defaultDateForMonth,
  formatDate,
  formatMonthLabel,
  monthDateLimits,
  shiftMonth,
} from '../lib/dates';
import {
  useAddExpense,
  useComputedEnrollments,
  useExpensesForMonth,
  usePaymentsForMonth,
  useSettings,
} from '../lib/hooks';
import {
  groupCollectionsByCourse,
  monthReport,
  type CollectionCourseGroup,
} from '../lib/metrics';
import { buildMonthCsv, downloadCsv } from '../lib/csv';
import { ExpenseListItem } from '../components/ExpenseListItem';
import type { ExpenseCategory, ExpenseRow, Method } from '../lib/types';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
  StatCard,
} from '../components/ui';

// Filename-safe slug from the academy name, e.g. "american-skill-hub".
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'academy'
  );
}

const CATEGORIES: ExpenseCategory[] = [
  'Rent',
  'Salaries',
  'Utilities',
  'Supplies',
  'Marketing',
  'Other',
];

export default function Months() {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const paymentsQ = usePaymentsForMonth(monthKey);
  const expensesQ = useExpensesForMonth(monthKey);
  const enrollmentsQ = useComputedEnrollments();
  const settingsQ = useSettings();

  const payments = paymentsQ.data ?? [];
  const expenses = expensesQ.data ?? [];

  const { collected, spent, profit, cash, online } = monthReport(payments, expenses);

  // Collections grouped Course -> Student -> payments, so one student appears
  // once (admission + monthly folded together) instead of a row per payment.
  const enrollmentById = new Map(enrollmentsQ.data.map((e) => [e.id, e]));
  const collectionGroups = groupCollectionsByCourse(payments, (id) => {
    const e = enrollmentById.get(id);
    return { studentName: e?.student_name ?? 'Unknown', courseName: e?.course_name ?? '' };
  });
  const topCourseTotal = collectionGroups.length ? collectionGroups[0].total : 0;

  const isThisMonth = monthKey === currentMonthKey();
  const academyName =
    (settingsQ.data ?? []).find((s) => s.key === 'academy_name')?.value || 'Academy';
  const nothingToExport = payments.length === 0 && expenses.length === 0;

  function handleExport() {
    const byId = new Map(enrollmentsQ.data.map((e) => [e.id, e]));
    const csv = buildMonthCsv({
      title: `${academyName} — ${formatMonthLabel(monthKey)}`,
      collected,
      spent,
      profit,
      payments: payments.map((p) => {
        const e = byId.get(p.enrollment_id);
        return {
          date: p.date,
          receipt_code: p.receipt_code,
          student: e?.student_name ?? '',
          course: e?.course_name ?? '',
          type: p.type,
          method: p.method,
          amount: Number(p.amount),
        };
      }),
      expenses: expenses.map((x) => ({
        date: x.date,
        expense_code: x.expense_code,
        category: x.category ?? '',
        description: x.description ?? '',
        method: x.method ?? '',
        amount: Number(x.amount),
      })),
    });
    downloadCsv(`${slugify(academyName)}-${monthKey}.csv`, csv);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-tight text-navy">Months &amp; Reports</h1>
        <Button
          variant="ghost"
          onClick={handleExport}
          disabled={nothingToExport}
          className="!py-2 !px-3 text-xs"
        >
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-between rounded-2xl bg-white ring-1 ring-slate-200 p-2">
        <button
          onClick={() => setMonthKey((m) => shiftMonth(m, -1))}
          className="rounded-xl p-2 text-slate-500 hover:bg-slate-50 hover:text-navy"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="font-bold text-navy">{formatMonthLabel(monthKey)}</p>
          {isThisMonth && <p className="text-[11px] text-cyan-dark font-semibold">This month</p>}
        </div>
        <button
          onClick={() => setMonthKey((m) => shiftMonth(m, 1))}
          className="rounded-xl p-2 text-slate-500 hover:bg-slate-50 hover:text-navy"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Profit summary */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Collected"
          value={pkr(collected)}
          icon={<TrendingUp className="w-5 h-5" />}
          tone="cyan"
        />
        <StatCard
          label="Expenses"
          value={pkr(spent)}
          icon={<TrendingDown className="w-5 h-5" />}
          tone="navy"
        />
        <StatCard
          label="Month Profit"
          value={pkr(profit)}
          icon={<Wallet className="w-5 h-5" />}
          tone={profit < 0 ? 'red' : 'cyan'}
        />
      </section>

      {/* Cash / Online split */}
      <Card className="p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">
          Collected — method split
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Cash</p>
            <p className="text-lg font-bold text-navy">{pkr(cash)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Online</p>
            <p className="text-lg font-bold text-navy">{pkr(online)}</p>
          </div>
        </div>
      </Card>

      {/* Collections grouped Course -> Student -> payments */}
      <section>
        <h2 className="font-label text-sm font-bold text-navy uppercase tracking-[0.16em] mb-2 px-1">
          Collections by Course ({collectionGroups.length})
        </h2>
        {paymentsQ.isLoading ? (
          <Card>
            <Spinner />
          </Card>
        ) : collectionGroups.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ReceiptText className="w-9 h-9" />}
              title="No payments this month"
              message="Payments logged in this month appear here, grouped by course."
            />
          </Card>
        ) : (
          <CollectionsByCourse groups={collectionGroups} maxTotal={topCourseTotal} />
        )}
      </section>

      {/* Expenses */}
      <ExpensesSection
        monthKey={monthKey}
        expenses={expenses}
        loading={expensesQ.isLoading}
      />
    </div>
  );
}

// Course -> Student -> payment accordion. One student appears once, with their
// admission + monthly folded under them; tap a course (then a student) to drill in.
function CollectionsByCourse({
  groups,
  maxTotal,
}: {
  groups: CollectionCourseGroup[];
  maxTotal: number;
}) {
  const [openCourses, setOpenCourses] = useState<Set<string>>(new Set());
  const [openStudents, setOpenStudents] = useState<Set<number>>(new Set());

  function toggleCourse(k: string) {
    setOpenCourses((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }
  function toggleStudent(id: number) {
    setOpenStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const courseOpen = openCourses.has(g.course);
        return (
          <Card key={g.course} className="overflow-hidden">
            {/* Course header */}
            <button
              type="button"
              onClick={() => toggleCourse(g.course)}
              className="w-full text-left px-4 py-3 hover:bg-slate-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-navy truncate">{g.course}</p>
                  <p className="text-xs text-slate-500">
                    {g.studentCount} student{g.studentCount === 1 ? '' : 's'} paid ·{' '}
                    <span className="font-semibold text-emerald-600">{pkr(g.total)} collected</span>
                  </p>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 shrink-0 transition ${courseOpen ? 'rotate-180' : ''}`}
                />
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-cyan"
                  style={{ width: `${maxTotal > 0 ? (g.total / maxTotal) * 100 : 0}%` }}
                />
              </div>
            </button>

            {/* Students inside the course */}
            {courseOpen && (
              <div className="border-t border-slate-100 divide-y divide-slate-100 bg-slate-50/40">
                {g.students.map((s) => {
                  const studentOpen = openStudents.has(s.enrollmentId);
                  return (
                    <div key={s.enrollmentId}>
                      <button
                        type="button"
                        onClick={() => toggleStudent(s.enrollmentId)}
                        className="w-full text-left px-4 py-2.5 hover:bg-white"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-2">
                            <ChevronDown
                              className={`w-4 h-4 text-slate-400 shrink-0 transition ${studentOpen ? 'rotate-180' : ''}`}
                            />
                            <p className="font-medium text-navy truncate">{s.studentName}</p>
                          </div>
                          <p className="text-sm font-bold text-emerald-600 shrink-0">
                            {pkr(s.total)} paid
                          </p>
                        </div>
                      </button>

                      {/* Individual payment lines for the student */}
                      {studentOpen && (
                        <div className="px-4 pb-3 pl-10 space-y-1.5">
                          {s.payments.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                              <div className="min-w-0">
                                <span className="text-navy">
                                  {p.type === 'Monthly' ? 'Monthly fee' : 'Admission fee'}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {' · '}
                                  {p.method ?? '—'} · {formatDate(p.date)}
                                </span>
                              </div>
                              <span className="font-semibold text-navy shrink-0">{pkr(p.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function ExpensesSection({
  monthKey,
  expenses,
  loading,
}: {
  monthKey: string;
  expenses: ExpenseRow[];
  loading: boolean;
}) {
  const addExpense = useAddExpense();
  const [open, setOpen] = useState(false);
  // Default the date to the month the owner is viewing (today if it's the
  // current month) and re-sync whenever they navigate, so an expense added
  // while viewing another month doesn't silently land in the current one.
  const [date, setDate] = useState(() => defaultDateForMonth(monthKey));
  useEffect(() => setDate(defaultDateForMonth(monthKey)), [monthKey]);
  const dateLimits = monthDateLimits(monthKey);
  const [category, setCategory] = useState<ExpenseCategory>('Rent');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState<Method>('Cash');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (date < dateLimits.min || date > dateLimits.max) {
      setError(`Pick a date within ${formatMonthLabel(monthKey)}.`);
      return;
    }
    try {
      await addExpense.mutateAsync({
        date,
        category,
        description: description.trim() || null,
        method,
        amount: amt,
      });
      setDescription('');
      setAmount('');
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="font-label text-sm font-bold text-navy uppercase tracking-[0.16em]">
          Expenses ({(expenses ?? []).length})
        </h2>
        <Button variant="ghost" onClick={() => setOpen((v) => !v)} className="!py-2 !px-3 text-xs">
          <Plus className="w-4 h-4" />
          Add Expense
        </Button>
      </div>

      {open && (
        <Card className="p-4 mb-2">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" hint={`Within ${formatMonthLabel(monthKey)}.`}>
                <Input
                  type="date"
                  required
                  min={dateLimits.min}
                  max={dateLimits.max}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Category">
                <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Description" hint="Optional.">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Office rent"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Method">
                <Select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                  <option value="Cash">Cash</option>
                  <option value="Online">Online</option>
                </Select>
              </Field>
              <Field label="Amount (PKR)">
                <Input
                  type="number"
                  min={1}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" loading={addExpense.isPending} className="w-full">
              Save Expense
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <Card>
          <Spinner />
        </Card>
      ) : (expenses ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon={<TrendingDown className="w-9 h-9" />}
            title="No expenses this month"
            message="Add rent, salaries, utilities and more to see month profit."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {(expenses ?? []).map((x) => (
            <ExpenseListItem key={x.id} expense={x} />
          ))}
        </Card>
      )}

      <p className="sr-only">Showing {formatMonthLabel(monthKey)}</p>
    </section>
  );
}
