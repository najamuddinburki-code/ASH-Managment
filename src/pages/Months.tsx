import { useEffect, useState, type FormEvent } from 'react';
import {
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
import { monthReport } from '../lib/metrics';
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
          CSV
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

      {/* Collections list */}
      <section>
        <h2 className="font-label text-sm font-bold text-navy uppercase tracking-[0.16em] mb-2 px-1">
          Collections ({payments.length})
        </h2>
        {paymentsQ.isLoading ? (
          <Card>
            <Spinner />
          </Card>
        ) : payments.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ReceiptText className="w-9 h-9" />}
              title="No payments this month"
              message="Payments logged in this month appear here."
            />
          </Card>
        ) : (
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">
                    {p.type} · <span className="font-normal text-slate-500">{p.method}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(p.date)}
                    {p.receipt_code ? ` · ${p.receipt_code}` : ''}
                  </p>
                </div>
                <p className="font-bold text-emerald-600 shrink-0">{pkr(Number(p.amount))}</p>
              </div>
            ))}
          </Card>
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
              Save expense
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
