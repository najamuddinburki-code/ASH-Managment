import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  Coins,
  AlertTriangle,
  UserPlus,
  ReceiptText,
  CheckCircle2,
  ChevronDown,
  Info,
  ChevronRight,
} from 'lucide-react';
import { pkr } from '../lib/engine';
import { currentMonthKey, formatMonthLabel } from '../lib/dates';
import { useComputedEnrollments, usePaymentsForMonth, type ComputedEnrollment } from '../lib/hooks';
import { chaseList, dashboardMetrics, groupEnrollmentsByCourse } from '../lib/metrics';
import { Avatar, Button, Card, EmptyState, ErrorState, Spinner, StatCard } from '../components/ui';

const PREVIEW = 4; // overdue students shown per course before "View all".

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
  const [openCourses, setOpenCourses] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState<Set<string>>(new Set());

  const { cashInMonth, totalOwed, overdueCount } = dashboardMetrics(
    enrollments,
    paymentsQ.data ?? [],
  );

  // Overdue students grouped by course, worst-first within each course.
  const chase = chaseList(enrollments);
  const overdueByCourse = groupEnrollmentsByCourse(chase, (e) => e.course_name || 'No course');

  function toggleCourse(course: string) {
    setOpenCourses((prev) => {
      const next = new Set(prev);
      if (next.has(course)) next.delete(course);
      else next.add(course);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <section className="grid grid-cols-3 gap-3">
        <StatCard
          label={`Money In · ${formatMonthLabel(monthKey)}`}
          value={paymentsQ.isLoading ? '…' : pkr(cashInMonth)}
          icon={<Wallet className="w-5 h-5" />}
          tone="cyan"
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

      {/* Overdue by course */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="font-label text-sm font-bold text-navy uppercase tracking-[0.16em]">
            Overdue by Course
          </h2>
          {chase.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
              <Info className="w-3.5 h-3.5" />
              Sorted by worst first
            </span>
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
              title="No one owes you right now"
              message="When a student's payment becomes overdue, they'll appear here — grouped by course."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {overdueByCourse.map((g) => {
              const open = openCourses.has(g.course);
              const all = showAll.has(g.course);
              const visible = all ? g.students : g.students.slice(0, PREVIEW);
              return (
                <Card key={g.course} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleCourse(g.course)}
                    className="w-full text-left px-4 py-3.5 hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={g.course} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-navy truncate">{g.course}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          <span className="text-red-600 font-semibold">{g.studentCount} overdue</span>
                          {' · '}
                          <span className="font-semibold text-navy">{pkr(g.totalOwed)}</span> owed
                        </p>
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-slate-400 shrink-0 transition ${open ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>

                  {open && (
                    <div className="border-t border-slate-100 divide-y divide-slate-100">
                      {visible.map((e) => (
                        <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                          <Avatar name={e.student_name} tone="brand" size="sm" />
                          <Link to={`/students/${e.id}`} className="min-w-0 flex-1 group">
                            <p className="font-semibold text-navy truncate group-hover:text-cyan-dark">
                              {e.student_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {e.computed.days_overdue === 0
                                ? 'due today'
                                : `${e.computed.days_overdue} day${e.computed.days_overdue === 1 ? '' : 's'} late`}
                            </p>
                          </Link>
                          <p className="font-bold text-red-600 shrink-0">{pkr(e.computed.balance)}</p>
                          <Link to={quickPayHref(e)} className="shrink-0">
                            <Button variant="primary" className="!py-1.5 !px-3 text-xs">
                              <ReceiptText className="w-3.5 h-3.5" />
                              Record Payment
                            </Button>
                          </Link>
                        </div>
                      ))}

                      {g.students.length > PREVIEW && !all && (
                        <button
                          type="button"
                          onClick={() => setShowAll((prev) => new Set(prev).add(g.course))}
                          className="w-full flex items-center justify-center gap-1 px-4 py-3 text-sm font-semibold text-cyan-dark hover:bg-slate-50"
                        >
                          View all {g.studentCount} overdue students
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
