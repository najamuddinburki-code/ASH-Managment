import { useState, type FormEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  ReceiptText,
} from 'lucide-react';
import { pkr } from '../lib/engine';
import {
  currentMonthKey,
  formatDate,
  formatMonthLabel,
  shiftMonth,
  todayISO,
} from '../lib/dates';
import { useAddExpense, useExpensesForMonth, usePaymentsForMonth } from '../lib/hooks';
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

  const payments = paymentsQ.data ?? [];
  const expenses = expensesQ.data ?? [];

  const collected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const cash = payments.filter((p) => p.method === 'Cash').reduce((s, p) => s + Number(p.amount), 0);
  const online = payments
    .filter((p) => p.method === 'Online')
    .reduce((s, p) => s + Number(p.amount), 0);
  const spent = expenses.reduce((s, x) => s + Number(x.amount), 0);
  const profit = collected - spent;

  const isThisMonth = monthKey === currentMonthKey();

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold text-navy">Months &amp; Reports</h1>

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
          {isThisMonth && <p className="text-[11px] text-gold-dark font-semibold">This month</p>}
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
          tone="gold"
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
          tone={profit < 0 ? 'red' : 'gold'}
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
        <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-2 px-1">
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
  const [date, setDate] = useState(todayISO());
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
        <h2 className="text-sm font-bold text-navy uppercase tracking-wide">
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
              <Field label="Date">
                <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
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
            <div key={x.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-navy">
                  {x.category || 'Other'}
                  {x.description ? <span className="font-normal text-slate-500"> · {x.description}</span> : ''}
                </p>
                <p className="text-xs text-slate-400">
                  {formatDate(x.date)}
                  {x.method ? ` · ${x.method}` : ''}
                  {x.expense_code ? ` · ${x.expense_code}` : ''}
                </p>
              </div>
              <p className="font-bold text-red-600 shrink-0">−{pkr(Number(x.amount))}</p>
            </div>
          ))}
        </Card>
      )}

      <p className="sr-only">Showing {formatMonthLabel(monthKey)}</p>
    </section>
  );
}
