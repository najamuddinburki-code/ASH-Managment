import { Link } from 'react-router-dom';
import { Wallet, Coins, AlertTriangle, UserPlus, ReceiptText, CheckCircle2 } from 'lucide-react';
import { pkr } from '../lib/engine';
import { currentMonthKey, formatMonthLabel } from '../lib/dates';
import { useComputedEnrollments, usePaymentsForMonth } from '../lib/hooks';
import { Button, Card, EmptyState, ErrorState, FlagBadge, Spinner, StatCard } from '../components/ui';

export default function Home() {
  const monthKey = currentMonthKey();
  const { data: enrollments, isLoading, isError, error } = useComputedEnrollments();
  const paymentsQ = usePaymentsForMonth(monthKey);

  const cashThisMonth = (paymentsQ.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const totalOwed = enrollments
    .filter((e) => e.status === 'Active')
    .reduce((sum, e) => sum + e.computed.balance, 0);
  const overdue = enrollments.filter((e) => e.computed.flag === 'overdue');

  // Chase list: worst-first — biggest balance first, then most days late.
  const chase = [...overdue].sort(
    (a, b) =>
      b.computed.balance - a.computed.balance ||
      b.computed.days_overdue - a.computed.days_overdue,
  );

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label={`Cash In · ${formatMonthLabel(monthKey)}`}
          value={paymentsQ.isLoading ? '…' : pkr(cashThisMonth)}
          icon={<Wallet className="w-5 h-5" />}
          tone="gold"
        />
        <StatCard
          label="Total Owed To You"
          value={isLoading ? '…' : pkr(totalOwed)}
          icon={<Coins className="w-5 h-5" />}
          tone="navy"
        />
        <StatCard
          label="Students Overdue"
          value={isLoading ? '…' : String(overdue.length)}
          icon={<AlertTriangle className="w-5 h-5" />}
          tone={overdue.length > 0 ? 'red' : 'navy'}
        />
      </section>

      {/* Actions */}
      <section className="grid grid-cols-2 gap-3">
        <Link to="/students/new">
          <Button variant="primary" className="w-full">
            <UserPlus className="w-4 h-4" />
            Add Student
          </Button>
        </Link>
        <Link to="/pay">
          <Button variant="secondary" className="w-full">
            <ReceiptText className="w-4 h-4" />
            Log Payment
          </Button>
        </Link>
      </section>

      {/* Chase list */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide">Chase List</h2>
          {chase.length > 0 && (
            <span className="text-xs text-slate-500">{chase.length} overdue · worst first</span>
          )}
        </div>

        {isError ? (
          <ErrorState message={(error as Error)?.message} />
        ) : isLoading ? (
          <Card>
            <Spinner label="Loading students…" />
          </Card>
        ) : chase.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CheckCircle2 className="w-10 h-10" />}
              title="Nobody is overdue"
              message="When a student passes their due date with a balance owing, they'll show up here — worst first."
            />
          </Card>
        ) : (
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {chase.map((e) => (
              <Link
                key={e.id}
                to={`/students/${e.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-navy truncate">{e.student_name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {e.course_name || 'No course'} · {e.computed.days_overdue} day
                    {e.computed.days_overdue === 1 ? '' : 's'} late
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-red-600">{pkr(e.computed.balance)}</p>
                  <FlagBadge flag="overdue" />
                </div>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
