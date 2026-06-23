import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { History, Info, Pencil, ReceiptText, Search, X } from 'lucide-react';
import { pkr } from '../lib/engine';
import { todayISO } from '../lib/dates';
import {
  useAddPayment,
  useComputedEnrollments,
  useRecentPayments,
  useSettings,
  type ComputedEnrollment,
} from '../lib/hooks';
import type { Method, PaymentRow, PaymentType } from '../lib/types';
import { Button, Card, Field, FlagBadge, Input, Select, Spinner } from '../components/ui';
import { PaymentListItem } from '../components/PaymentListItem';
import { Receipt } from '../components/Receipt';

// A ready-made amount the owner can tap instead of typing. Each option is a
// single, correct payment: it sets BOTH the type and the amount, so the ledger
// is never mis-attributed.
interface QuickOption {
  key: string;
  label: string;
  type: PaymentType;
  amount: number;
}

// Build the quick-amount options for a selected enrollment. Kept pure so it's
// easy to reason about. Deduped by type+amount so we never show two identical
// buttons (e.g. when one month's fee already equals the whole balance).
function quickOptions(c: ComputedEnrollment['computed']): QuickOption[] {
  const out: QuickOption[] = [];
  const push = (o: QuickOption) => {
    if (o.amount > 0 && !out.some((x) => x.type === o.type && x.amount === o.amount)) out.push(o);
  };
  // One month's fee — the most common daily action.
  push({ key: 'monthly', label: 'Monthly Fee', type: 'Monthly', amount: Math.round(c.net_monthly) });
  // Clear the admission still owed.
  push({ key: 'admission', label: 'Admission Fee', type: 'Admission', amount: Math.round(c.admission_owed) });
  // One-tap "clear everything" — only when the balance is a single payment type
  // (otherwise the two buttons above clear it correctly in two taps).
  if (c.balance > 0 && (c.admission_owed === 0 || c.monthly_owed === 0)) {
    push({
      key: 'clear',
      label: 'Clear Balance',
      type: c.monthly_owed > 0 ? 'Monthly' : 'Admission',
      amount: Math.round(c.balance),
    });
  }
  return out;
}

export default function LogPayment() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preselectId = params.get('enrollment');
  const preType = params.get('type');
  const preAmount = params.get('amount');

  const { data: enrollments, isLoading } = useComputedEnrollments();
  const settingsQ = useSettings();
  const recentQ = useRecentPayments(12);
  const addPayment = useAddPayment();
  const amountRef = useRef<HTMLInputElement>(null);

  const academyName =
    (settingsQ.data ?? []).find((s) => s.key === 'academy_name')?.value || 'Academy';

  const [selectedId, setSelectedId] = useState<number | null>(
    preselectId ? Number(preselectId) : null,
  );
  const [search, setSearch] = useState('');
  const [type, setType] = useState<PaymentType>(preType === 'Admission' ? 'Admission' : 'Monthly');
  const [method, setMethod] = useState<Method>('Cash');
  const [amount, setAmount] = useState(preAmount ?? '');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  // Which quick button is active (for highlight); 'custom' = owner typed their own.
  const [activeQuick, setActiveQuick] = useState<string | null>(preAmount ? 'custom' : null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    payment: PaymentRow;
    studentName: string;
    courseName: string;
    enrollmentId: number;
  } | null>(null);

  const selected = enrollments.find((e) => e.id === selectedId) ?? null;
  const options = selected ? quickOptions(selected.computed) : [];

  // Student name lookup for the recent-payments list (which spans students).
  const nameById = useMemo(
    () => new Map(enrollments.map((e) => [e.id, e.student_name])),
    [enrollments],
  );

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Active first, then by name; hide closed unless searched explicitly.
    return enrollments
      .filter((e) => (q ? true : e.status === 'Active'))
      .filter(
        (e) =>
          !q ||
          e.student_name.toLowerCase().includes(q) ||
          (e.course_name ?? '').toLowerCase().includes(q) ||
          (e.enroll_code ?? '').toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [enrollments, search]);

  // Everything required must be present before Save activates.
  const canSave = !!selected && Number(amount) > 0 && !!type && !!method && !!date;

  function pickStudent(id: number) {
    setSelectedId(id);
    setSearch('');
    // Reset the entry fields for the freshly selected student.
    setActiveQuick(null);
    setAmount('');
    setError(null);
  }

  function applyQuick(o: QuickOption) {
    setType(o.type);
    setAmount(String(o.amount));
    setActiveQuick(o.key);
    setError(null);
  }

  function useCustom() {
    setActiveQuick('custom');
    setError(null);
    amountRef.current?.focus();
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!selected) {
      setError('Pick a student first.');
      return;
    }
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    try {
      const created = await addPayment.mutateAsync({
        enrollment_id: selected.id,
        date,
        type,
        method,
        amount: amt,
        note: note.trim() || null,
      });
      setReceipt({
        payment: created,
        studentName: selected.student_name,
        courseName: selected.course_name ?? '',
        enrollmentId: selected.id,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // Receipt screen (after a successful save). Remaining balance is read live so
  // it reflects the just-recorded payment once totals refetch.
  if (receipt) {
    const live = enrollments.find((e) => e.id === receipt.enrollmentId);
    return (
      <Receipt
        data={{
          academyName,
          studentName: receipt.studentName,
          courseName: receipt.courseName,
          payment: receipt.payment,
          remainingBalance: live?.computed.balance,
        }}
        onAnother={() => {
          setReceipt(null);
          setAmount('');
          setNote('');
          setActiveQuick(null);
        }}
        onDone={() => navigate(`/students/${receipt.enrollmentId}`)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl tracking-tight text-navy">Log Payment</h1>

      <div className="rounded-xl bg-cyan/10 ring-1 ring-cyan/30 p-3 flex gap-2.5 text-sm text-navy">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-cyan-dark" />
        <p>This records money received; the balance updates automatically.</p>
      </div>

      {/* STEP 1 — pick a student (only shown until one is selected) */}
      {!selected ? (
        <Card className="p-4 sm:p-5">
          <span className="block text-sm font-medium text-navy mb-1.5">Search student</span>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, course, or code…"
              className="pl-10"
              autoFocus
            />
          </div>
          <div className="mt-2 rounded-xl ring-1 ring-slate-200 divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {isLoading ? (
              <Spinner />
            ) : matches.length === 0 ? (
              <p className="text-sm text-slate-500 px-4 py-3">No students found yet.</p>
            ) : (
              matches.map((e) => (
                <button
                  type="button"
                  key={e.id}
                  onClick={() => pickStudent(e.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-navy truncate">{e.student_name}</p>
                    <p className="text-xs text-slate-500 truncate">{e.course_name || 'No course'}</p>
                  </div>
                  <span
                    className={`text-sm font-semibold shrink-0 ${
                      e.computed.flag === 'overdue' ? 'text-red-600' : 'text-slate-500'
                    }`}
                  >
                    {pkr(e.computed.balance)}
                  </span>
                </button>
              ))
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* STEP 2 — the clearly-shown selected student, kept above the form */}
          <SelectedStudent enrollment={selected} onChange={() => setSelectedId(null)} />

          {/* STEP 3 — the payment form, below the selected student */}
          <Card className="p-4 sm:p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Quick amounts */}
              <div>
                <span className="block text-sm font-medium text-navy mb-1.5">Quick amount</span>
                <div className="flex flex-wrap gap-2">
                  {options.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => applyQuick(o)}
                      className={`rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition ${
                        activeQuick === o.key
                          ? 'bg-navy text-white ring-navy'
                          : 'bg-white text-navy ring-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {o.label} · {pkr(o.amount)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={useCustom}
                    className={`rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition inline-flex items-center gap-1.5 ${
                      activeQuick === 'custom'
                        ? 'bg-navy text-white ring-navy'
                        : 'bg-white text-navy ring-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Custom Amount
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Payment Type">
                  <Select
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value as PaymentType);
                      setActiveQuick('custom');
                    }}
                  >
                    <option value="Monthly">Monthly fee</option>
                    <option value="Admission">Admission fee</option>
                  </Select>
                </Field>
                <Field label="Payment Method">
                  <Select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount Received (PKR)">
                  <Input
                    ref={amountRef}
                    type="number"
                    min={1}
                    step="1"
                    required
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setActiveQuick('custom');
                    }}
                    placeholder="0"
                  />
                </Field>
                <Field label="Date">
                  <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
              </div>

              <Field label="Note" hint="Optional.">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. June fee" />
              </Field>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                loading={addPayment.isPending}
                className="w-full"
                disabled={!canSave}
              >
                <ReceiptText className="w-4 h-4" />
                Save Payment
              </Button>
            </form>
          </Card>
        </>
      )}

      {/* Recent payments — edit or delete to fix a mistake */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="font-label text-sm font-bold text-navy uppercase tracking-[0.16em] inline-flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            Recent payments
          </h2>
          <span className="text-xs text-slate-500">tap to edit or delete</span>
        </div>
        {recentQ.isLoading ? (
          <Card>
            <Spinner />
          </Card>
        ) : (recentQ.data ?? []).length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500 px-4 py-6 text-center">No payments yet.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {(recentQ.data ?? []).map((p) => (
              <PaymentListItem
                key={p.id}
                payment={p}
                subtitle={nameById.get(p.enrollment_id) ?? undefined}
              />
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

// The selected student, shown clearly above the form so the owner always knows
// who they're paying for.
function SelectedStudent({
  enrollment: e,
  onChange,
}: {
  enrollment: ComputedEnrollment;
  onChange: () => void;
}) {
  return (
    <div className="rounded-2xl bg-navy text-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-label text-[11px] uppercase tracking-[0.16em] text-white/50">
            Selected student
          </p>
          <p className="font-display text-2xl tracking-tight leading-none mt-1 truncate">
            {e.student_name}
          </p>
          <p className="text-sm text-white/70 truncate mt-1">{e.course_name || 'No course'}</p>
        </div>
        <button
          type="button"
          onClick={onChange}
          className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
        >
          <X className="w-3.5 h-3.5" />
          Change
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-white/10">
        <FlagBadge flag={e.computed.flag} />
        <div className="text-right">
          <span className="font-label text-[11px] uppercase tracking-[0.16em] text-white/50">
            Balance
          </span>
          <p
            className={`font-display text-xl leading-none mt-0.5 ${
              e.computed.balance > 0 ? 'text-cyan' : 'text-emerald-300'
            }`}
          >
            {pkr(e.computed.balance)}
          </p>
        </div>
      </div>
    </div>
  );
}
