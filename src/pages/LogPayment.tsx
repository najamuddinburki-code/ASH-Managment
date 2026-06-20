import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Info, ReceiptText, Search, X } from 'lucide-react';
import { pkr } from '../lib/engine';
import { todayISO } from '../lib/dates';
import { useAddPayment, useComputedEnrollments, type ComputedEnrollment } from '../lib/hooks';
import type { Method, PaymentType } from '../lib/types';
import { Button, Card, Field, FlagBadge, Input, Select, Spinner } from '../components/ui';

export default function LogPayment() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preselectId = params.get('enrollment');

  const { data: enrollments, isLoading } = useComputedEnrollments();
  const addPayment = useAddPayment();

  const [selectedId, setSelectedId] = useState<number | null>(
    preselectId ? Number(preselectId) : null,
  );
  const [search, setSearch] = useState('');
  const [type, setType] = useState<PaymentType>('Monthly');
  const [method, setMethod] = useState<Method>('Cash');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const selected = enrollments.find((e) => e.id === selectedId) ?? null;

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

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!selected) {
      setError('Pick a student enrollment first.');
      return;
    }
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    try {
      await addPayment.mutateAsync({
        enrollment_id: selected.id,
        date,
        type,
        method,
        amount: amt,
        note: note.trim() || null,
      });
      setDone(true);
      // brief confirmation, then back to the student
      setTimeout(() => navigate(`/students/${selected.id}`), 700);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <p className="font-bold text-navy text-lg">Payment recorded</p>
        <p className="text-sm text-slate-500 mt-1">Balance updated automatically.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-navy">Log Payment</h1>

      <div className="rounded-xl bg-gold/10 ring-1 ring-gold/30 p-3 flex gap-2.5 text-sm text-navy">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-gold-dark" />
        <p>This records money received; the balance updates automatically.</p>
      </div>

      <Card className="p-4 sm:p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Enrollment picker */}
          {selected ? (
            <SelectedEnrollment enrollment={selected} onClear={() => setSelectedId(null)} />
          ) : (
            <div>
              <span className="block text-sm font-medium text-navy mb-1.5">Student enrollment</span>
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
              <div className="mt-2 rounded-xl ring-1 ring-slate-200 divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {isLoading ? (
                  <Spinner />
                ) : matches.length === 0 ? (
                  <p className="text-sm text-slate-500 px-4 py-3">No students found.</p>
                ) : (
                  matches.map((e) => (
                    <button
                      type="button"
                      key={e.id}
                      onClick={() => {
                        setSelectedId(e.id);
                        setSearch('');
                      }}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-navy truncate">{e.student_name}</p>
                        <p className="text-xs text-slate-500 truncate">{e.course_name || 'No course'}</p>
                      </div>
                      <span className="text-sm font-semibold text-slate-500 shrink-0">
                        {pkr(e.computed.balance)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as PaymentType)}>
                <option value="Monthly">Monthly</option>
                <option value="Admission">Admission</option>
              </Select>
            </Field>
            <Field label="Method">
              <Select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                <option value="Cash">Cash</option>
                <option value="Online">Online</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (PKR)">
              <Input
                type="number"
                min={1}
                step="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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

          <Button type="submit" loading={addPayment.isPending} className="w-full" disabled={!selected}>
            <ReceiptText className="w-4 h-4" />
            Save payment
          </Button>
        </form>
      </Card>
    </div>
  );
}

function SelectedEnrollment({
  enrollment: e,
  onClear,
}: {
  enrollment: ComputedEnrollment;
  onClear: () => void;
}) {
  return (
    <div className="rounded-xl bg-navy text-white p-3.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold truncate">{e.student_name}</p>
        <p className="text-xs text-white/70 truncate">
          {e.course_name || 'No course'} · Balance {pkr(e.computed.balance)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <FlagBadge flag={e.computed.flag} />
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10"
          aria-label="Change student"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
