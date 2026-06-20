import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  Pencil,
  Phone,
  ReceiptText,
  Calculator,
} from 'lucide-react';
import { compute, pkr, type Enrollment as EngineEnrollment, type Status } from '../lib/engine';
import { formatDate } from '../lib/dates';
import {
  useCourses,
  useEnrollment,
  usePaymentsForEnrollment,
  useUpdateEnrollment,
} from '../lib/hooks';
import {
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
import type { EnrollmentRow } from '../lib/types';

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
  const enrollmentId = Number(id);

  const enrollmentQ = useEnrollment(enrollmentId);
  const paymentsQ = usePaymentsForEnrollment(enrollmentId);
  const { data: courses } = useCourses();
  const updateEnrollment = useUpdateEnrollment();

  const [editing, setEditing] = useState(false);
  const [showWorking, setShowWorking] = useState(false);

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
        <h1 className="text-xl font-extrabold text-navy truncate">{e.student_name}</h1>
      </div>

      {/* Summary */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={e.status} />
              <FlagBadge flag={c.flag} />
              {e.enroll_code && (
                <span className="text-xs text-slate-400 font-mono">{e.enroll_code}</span>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-2">{e.course_name || 'No course'}</p>
            {e.phone && (
              <a
                href={`tel:${e.phone}`}
                className="inline-flex items-center gap-1.5 text-sm text-navy mt-1 hover:text-gold-dark"
              >
                <Phone className="w-3.5 h-3.5" />
                {e.phone}
              </a>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs uppercase tracking-wide text-slate-400">Balance</p>
            <p className={`text-2xl font-extrabold ${c.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {pkr(c.balance)}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 pt-4 border-t border-slate-100 text-sm">
          <Detail label="Joined" value={formatDate(e.join_date)} />
          <Detail label="Due day" value={String(e.due_day)} />
          <Detail label="Monthly (net)" value={`${pkr(c.net_monthly)}/mo`} />
          <Detail label="Total paid" value={pkr(c.total_paid)} />
          <Detail label="Next due" value={c.next_due ? formatDate(toISO(c.next_due)) : '—'} />
          <Detail
            label="Days late"
            value={c.days_overdue > 0 ? `${c.days_overdue}` : '—'}
          />
        </dl>

        <div className="flex gap-3 mt-4">
          <Link to={`/pay?enrollment=${e.id}`} className="flex-1">
            <Button variant="primary" className="w-full">
              <ReceiptText className="w-4 h-4" />
              Log Payment
            </Button>
          </Link>
          <Button variant="ghost" className="flex-1" onClick={() => setEditing((v) => !v)}>
            <Pencil className="w-4 h-4" />
            {editing ? 'Close edit' : 'Edit'}
          </Button>
        </div>
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
        />
      )}

      {/* Payment history */}
      <section>
        <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-2 px-1">
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

      {/* Engine working numbers — hidden by default */}
      <section>
        <button
          onClick={() => setShowWorking((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white ring-1 ring-slate-200 text-sm font-semibold text-navy hover:bg-slate-50 transition"
        >
          <span className="inline-flex items-center gap-2">
            <Calculator className="w-4 h-4 text-slate-400" />
            Show working (how the balance is calculated)
          </span>
          <ChevronDown className={`w-4 h-4 transition ${showWorking ? 'rotate-180' : ''}`} />
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-semibold text-navy">{value}</dd>
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
}: {
  enrollment: EnrollmentRow;
  courses: { id: number; name: string }[];
  saving: boolean;
  onSave: (patch: Parameters<ReturnType<typeof useUpdateEnrollment>['mutateAsync']>[0]['patch']) => Promise<void>;
}) {
  const [name, setName] = useState(e.student_name);
  const [phone, setPhone] = useState(e.phone ?? '');
  const [courseId, setCourseId] = useState(e.course_id ? String(e.course_id) : '');
  const [dueDay, setDueDay] = useState(String(e.due_day));
  const [admissionFee, setAdmissionFee] = useState(String(Number(e.admission_fee)));
  const [monthlyFee, setMonthlyFee] = useState(String(Number(e.monthly_fee)));
  const [discount, setDiscount] = useState(String(Number(e.discount)));
  const [status, setStatus] = useState<Status>(e.status);
  const [error, setError] = useState<string | null>(null);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    const due = parseInt(dueDay, 10);
    if (Number.isNaN(due) || due < 1 || due > 31) {
      setError('Due day must be between 1 and 31.');
      return;
    }
    const course = courses.find((c) => String(c.id) === courseId);
    try {
      await onSave({
        student_name: name.trim(),
        phone: phone.trim() || null,
        course_id: course?.id ?? null,
        course_name: course?.name ?? null,
        due_day: due,
        admission_fee: Number(admissionFee) || 0,
        monthly_fee: Number(monthlyFee) || 0,
        discount: Number(discount) || 0,
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due day (1–31)">
            <Input type="number" min={1} max={31} value={dueDay} onChange={(ev) => setDueDay(ev.target.value)} />
          </Field>
          <Field label="Status" hint="Completed / Dropped freezes monthly accrual.">
            <Select value={status} onChange={(ev) => setStatus(ev.target.value as Status)}>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="Dropped">Dropped</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Admission fee (PKR)">
            <Input type="number" min={0} value={admissionFee} onChange={(ev) => setAdmissionFee(ev.target.value)} />
          </Field>
          <Field label="Monthly fee (PKR)">
            <Input type="number" min={0} value={monthlyFee} onChange={(ev) => setMonthlyFee(ev.target.value)} />
          </Field>
        </div>
        <Field label="Monthly discount (PKR)">
          <Input type="number" min={0} value={discount} onChange={(ev) => setDiscount(ev.target.value)} />
        </Field>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <Button type="submit" loading={saving} className="w-full">
          Save changes
        </Button>
      </form>
    </Card>
  );
}
