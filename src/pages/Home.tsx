import { Link } from 'react-router-dom';
import {
  Wallet,
  Coins,
  AlertTriangle,
  UserPlus,
  ReceiptText,
  CheckCircle2,
  Target,
} from 'lucide-react';
import { pkr } from '../lib/engine';
import { currentMonthKey, formatMonthLabel } from '../lib/dates';
import { useComputedEnrollments, usePaymentsForMonth, type ComputedEnrollment } from '../lib/hooks';
import { chaseList, dashboardMetrics } from '../lib/metrics';
import { Button, Card, EmptyState, ErrorState, FlagBadge, Spinner, StatCard } from '../components/ui';

// Quick-pay link: pre-pick the enrollment, and suggest the type + amount that
// clears the most relevant debt (admission first if owed, else this month's).
function quickPayHref(e: ComputedEnrollment): string {
  const owesAdmission = e.computed.admission_owed > 0;
  const type = owesAdmission ? 'Admission' : 'Monthly';
  const amount = Math.round(owesAdmission ? e.computed.admission_owed : e.computed.monthly_owed);
  return `/pay?enrollment=${e.id}&type=${type}&amount=${amount}`;
}

export default function Home() {
  const monthKey = currentMonthKey();
  const { data: enrollments, isLoading, isError, error } = useComputedEnrollments();
  const paymentsQ = usePaymentsForMonth(monthKey);

  const { cashInMonth, expectedThisMonth, totalOwed, overdueCount } = dashboardMetrics(
    enrollments,
    paymentsQ.data ?? [],
  );
  // Chase list: overdue only, worst-first (biggest balance, then most days late).
  const chase = chaseList(enrollments);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={`Cash In · ${formatMonthLabel(monthKey)}`}
          value={paymentsQ.isLoading ? '…' : pkr(cashInMonth)}
          icon={<Wallet className="w-5 h-5" />}
          tone="gold"
        />
        <StatCard
          label={`Expected · ${formatMonthLabel(monthKey)}`}
          value={isLoading ? '…' : pkr(expectedThisMonth)}
          icon={<Target className="w-5 h-5" />}
          tone="navy"
        />
        <StatCard
          label="Total Owed To You"
          value={isLoading ? '…' : pkr(totalOwed)}
          icon={<Coins className="w-5 h-5" />}
          tone="navy"
        />
        <StatCard
          label="Students Overdue"
          value={isLoading ? '…' : String(overdueCount)}
          icon={<AlertTriangle className="w-5 h-5" />}
          tone={overdueCount > 0 ? 'red' : 'navy'}
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
              <div key={e.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <Link to={`/students/${e.id}`} className="min-w-0 group">
                    <p className="font-semibold text-navy truncate group-hover:text-gold-dark">
                      {e.student_name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {e.course_name || 'No course'} · {e.computed.days_overdue} day
                      {e.computed.days_overdue === 1 ? '' : 's'} late
                    </p>
                  </Link>
                  <p className="font-bold text-red-600 shrink-0">{pkr(e.computed.balance)}</p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <FlagBadge flag="overdue" />
                  <Link to={quickPayHref(e)}>
                    <Button variant="primary" className="!py-1.5 !px-3 text-xs">
                      <ReceiptText className="w-3.5 h-3.5" />
                      Record payment
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
