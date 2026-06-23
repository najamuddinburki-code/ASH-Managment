import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Clock,
  Info,
  Pencil,
  Phone,
  ReceiptText,
  Trash2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { compute, pkr, type Computed, type Enrollment as EngineEnrollment, type Status } from '../lib/engine';
import { formatDate } from '../lib/dates';
import {
  useCourses,
  useDeleteEnrollment,
  useEnrollment,
  usePaymentsForEnrollment,
  useUpdateEnrollment,
} from '../lib/hooks';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  FlagBadge,
  Input,
  Select,
  Spinner,
  StatusBadge,
} from '../components/ui';
import { PaymentListItem } from '../components/PaymentListItem';
import type { EnrollmentRow } from '../lib/types';

// Quick-pay link from the student page: suggest the type + amount that clears
// the most relevant debt (admission first if owed, else this month's monthly).
function payHref(id: number, c: Computed): string {
  const owesAdmission = c.admission_owed > 0;
  const type = owesAdmission ? 'Admission' : 'Monthly';
  const amount = Math.round(owesAdmission ? c.admission_owed : c.monthly_owed);
  return `/pay?enrollment=${id}&type=${type}&amount=${amount}`;
}

function toEngine(e: EnrollmentRow): EngineEnrollment {
  return {
    id: e.id,
    student_name: e.student_name,
    phone: e.phone ?? undefined,
    course_name: e.course_name ?? '',
    join_date: e.join_date,
    due_day: e.due_day,
    admission_fee: Number(e.admission_fee),
    monthly_fee: Number(e.monthly_fee),
    discount: Number(e.discount),
    status: e.status,
  };
}

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const enrollmentId = Number(id);

  const enrollmentQ = useEnrollment(enrollmentId);
  const paymentsQ = usePaymentsForEnrollment(enrollmentId);
  const { data: courses } = useCourses();
  const updateEnrollment = useUpdateEnrollment();
  const deleteEnrollment = useDeleteEnrollment();

  const [editing, setEditing] = useState(false);
  const [showWorking, setShowWorking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const payments = paymentsQ.data ?? [];
  const paid = useMemo(() => {
    let monthly_paid = 0;
    let admission_paid = 0;
    for (const p of payments) {
      if (p.type === 'Monthly') monthly_paid += Number(p.amount);
      else admission_paid += Number(p.amount);
    }
    return { monthly_paid, admission_paid };
  }, [payments]);

  if (enrollmentQ.isError) return <ErrorState message={(enrollmentQ.error as Error)?.message} />;
  if (enrollmentQ.isLoading || !enrollmentQ.data) return <Spinner label="Loading student…" />;

  const e = enrollmentQ.data;
  const c = compute(toEngine(e), paid);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/students" className="text-slate-500 hover:text-navy">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-display text-2xl tracking-tight text-navy">Student Details</h1>
      </div>

      {/* Summary */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <Avatar name={e.student_name} size="lg" tone="brand" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl tracking-tight text-navy leading-tight truncate">
              {e.student_name}
            </h2>
            <p className="text-sm text-slate-500 truncate">{e.course_name || 'No course'}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <StatusBadge status={e.status} />
              <FlagBadge flag={c.flag} />
              {e.enroll_code && <span className="text-xs text-slate-400">ID: {e.enroll_code}</span>}
            </div>
            {e.phone && (
              <a
                href={`tel:${e.phone}`}
                className="inline-flex items-center gap-1.5 text-sm text-navy mt-1.5 hover:text-cyan-dark"
              >
                <Phone className="w-3.5 h-3.5" />
                {e.phone}
              </a>
            )}
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Metric
            icon={Wallet}
            tint="red"
            label="Owes"
            value={pkr(c.balance)}
            valueClass={c.balance > 0 ? 'text-red-600' : 'text-emerald-600'}
          />
          <Metric
            icon={ReceiptText}
            tint="emerald"
            label="Paid so far"
            value={pkr(c.total_paid)}
            valueClass="text-emerald-600"
          />
          <Metric icon={CalendarDays} tint="cyan" label="Joined on" value={formatDate(e.join_date)} />
          <Metric
            icon={CalendarClock}
            tint="indigo"
            label="Next payment due"
            value={c.next_due ? formatDate(toISO(c.next_due)) : '—'}
          />
          <Metric
            icon={Clock}
            tint="amber"
            label="Days late"
            value={
              c.flag === 'overdue'
                ? c.days_overdue > 0
                  ? `${c.days_overdue} day${c.days_overdue === 1 ? '' : 's'}`
                  : 'Due today'
                : '0 days'
            }
            sub={c.flag === 'overdue' ? undefined : 'On time'}
            valueClass={c.flag === 'overdue' ? 'text-red-600' : 'text-emerald-600'}
          />
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Link to={payHref(e.id, c)}>
            <Button variant="primary" className="w-full !px-2 text-sm">
              <ReceiptText className="w-4 h-4" />
              Log Payment
            </Button>
          </Link>
          <Button
            variant="secondary"
            className="w-full !px-2 text-sm"
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil className="w-4 h-4" />
            {editing ? 'Close' : 'Edit Student'}
          </Button>
          <Button
            variant="ghost"
            className="w-full !px-2 text-sm !text-red-600 !ring-red-200 hover:!bg-red-50"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>

        {confirmDelete && (
          <div className="mt-3 rounded-xl bg-red-50 ring-1 ring-red-200 p-3">
            <p className="text-sm font-semibold text-red-700">Delete this student?</p>
            <p className="text-xs text-red-600/80 mt-1">
              This permanently removes the student and ALL their payment history. This cannot be
              undone.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={deleteEnrollment.isPending}
                onClick={async () => {
                  await deleteEnrollment.mutateAsync(e.id);
                  navigate('/students');
                }}
              >
                Yes, Delete
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Edit form */}
      {editing && (
        <EditForm
          enrollment={e}
          courses={(courses ?? []).filter((co) => co.active || co.id === e.course_id)}
          saving={updateEnrollment.isPending}
          onSave={async (patch) => {
            await updateEnrollment.mutateAsync({ id: e.id, patch });
            setEditing(false);
          }}
          deleting={deleteEnrollment.isPending}
          onDelete={async () => {
            await deleteEnrollment.mutateAsync(e.id);
            navigate('/students');
          }}
        />
      )}

      {/* Payment history */}
      <section>
        <h2 className="font-label text-sm font-bold text-navy uppercase tracking-[0.16em] mb-2 px-1">
          Payment History
        </h2>
        {paymentsQ.isLoading ? (
          <Card>
            <Spinner />
          </Card>
        ) : payments.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ReceiptText className="w-9 h-9" />}
              title="No payments yet"
              message="Logged payments appear here, newest first."
            />
          </Card>
        ) : (
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {payments.map((p) => (
              <PaymentListItem key={p.id} payment={p} />
            ))}
          </Card>
        )}
      </section>

      {/* Engine working numbers — hidden by default */}
      <section>
        <button
          onClick={() => setShowWorking((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white ring-1 ring-slate-200 hover:bg-slate-50 transition"
        >
          <span className="flex items-center gap-3 text-left">
            <span className="w-9 h-9 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Info className="w-4 h-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-navy">How balance is calculated</span>
              <span className="block text-xs text-slate-500">
                Total fees − Total payments = Outstanding balance.
              </span>
            </span>
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition ${showWorking ? 'rotate-180' : ''}`} />
        </button>
        {showWorking && (
          <Card className="mt-2 p-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Working label="net_monthly" value={pkr(c.net_monthly)} />
              <Working label="months_elapsed" value={String(c.months_elapsed)} />
              <Working label="months_paid" value={String(c.months_paid)} />
              <Working label="monthly_due" value={pkr(c.monthly_due)} />
              <Working label="monthly_owed" value={pkr(c.monthly_owed)} />
              <Working label="admission_owed" value={pkr(c.admission_owed)} />
              <Working label="balance" value={pkr(c.balance)} />
              <Working label="days_overdue" value={String(c.days_overdue)} />
              <Working label="flag" value={c.flag} />
            </dl>
            <p className="text-xs text-slate-400 mt-3">
              These are computed on read from fees + payments — never stored.
            </p>
          </Card>
        )}
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  tint,
  label,
  value,
  sub,
  valueClass = 'text-navy',
}: {
  icon: LucideIcon;
  tint: 'red' | 'emerald' | 'cyan' | 'indigo' | 'amber';
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  const tints: Record<string, string> = {
    red: 'bg-red-100 text-red-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    cyan: 'bg-cyan/15 text-cyan-dark',
    indigo: 'bg-indigo/10 text-indigo',
    amber: 'bg-amber-100 text-amber-600',
  };
  return (
    <div className="rounded-xl ring-1 ring-slate-200 p-3 flex items-center gap-3">
      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tints[tint]}`}>
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`font-bold leading-tight ${valueClass}`}>{value}</p>
        {sub && <p className="text-[11px] text-emerald-600">{sub}</p>}
      </div>
    </div>
  );
}

function Working({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 pb-1">
      <dt className="font-mono text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold text-navy">{value}</dd>
    </div>
  );
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------
// Inline edit form
// ---------------------------------------------------------------------
function EditForm({
  enrollment: e,
  courses,
  saving,
  onSave,
  deleting,
  onDelete,
}: {
  enrollment: EnrollmentRow;
  courses: { id: number; name: string }[];
  saving: boolean;
  onSave: (patch: Parameters<ReturnType<typeof useUpdateEnrollment>['mutateAsync']>[0]['patch']) => Promise<void>;
  deleting: boolean;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(e.student_name);
  const [phone, setPhone] = useState(e.phone ?? '');
  const [courseId, setCourseId] = useState(e.course_id ? String(e.course_id) : '');
  const [admissionFee, setAdmissionFee] = useState(String(Number(e.admission_fee)));
  const [monthlyFee, setMonthlyFee] = useState(String(Number(e.monthly_fee)));
  const [status, setStatus] = useState<Status>(e.status);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    const course = courses.find((c) => String(c.id) === courseId);
    try {
      await onSave({
        student_name: name.trim(),
        phone: phone.trim() || null,
        course_id: course?.id ?? null,
        course_name: course?.name ?? null,
        // Monthly due date tracks the join day-of-month.
        due_day: Number(e.join_date.slice(8, 10)) || 1,
        admission_fee: Number(admissionFee) || 0,
        monthly_fee: Number(monthlyFee) || 0,
        status,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Student name">
          <Input required value={name} onChange={(ev) => setName(ev.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(ev) => setPhone(ev.target.value)} />
        </Field>
        <Field label="Course">
          <Select value={courseId} onChange={(ev) => setCourseId(ev.target.value)}>
            <option value="">— No course —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" hint="Completed / Dropped freezes monthly accrual.">
            <Select value={status} onChange={(ev) => setStatus(ev.target.value as Status)}>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="Dropped">Dropped</option>
            </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Admission fee (PKR)">
            <Input type="number" min={0} value={admissionFee} onChange={(ev) => setAdmissionFee(ev.target.value)} />
          </Field>
          <Field label="Monthly fee (PKR)">
            <Input type="number" min={0} value={monthlyFee} onChange={(ev) => setMonthlyFee(ev.target.value)} />
          </Field>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <Button type="submit" loading={saving} className="w-full">
          Save Changes
        </Button>
      </form>

      {/* Danger zone — delete the whole enrollment (and its payment history) */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        {!confirmDelete ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            className="w-full !text-red-600 !ring-red-200 hover:!bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete Student
          </Button>
        ) : (
          <div className="rounded-xl bg-red-50 ring-1 ring-red-200 p-3">
            <p className="text-sm font-semibold text-red-700">Delete this student?</p>
            <p className="text-xs text-red-600/80 mt-1">
              This permanently removes the enrollment and ALL its payment history. This cannot be
              undone.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={deleting}
                onClick={async () => {
                  setError(null);
                  try {
                    await onDelete();
                  } catch (err) {
                    setError((err as Error).message);
                    setConfirmDelete(false);
                  }
                }}
              >
                Yes, Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
