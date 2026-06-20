import { useState, type FormEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { pkr } from '../lib/engine';
import { formatDate } from '../lib/dates';
import { useDeletePayment, useUpdatePayment } from '../lib/hooks';
import type { Method, PaymentRow, PaymentType } from '../lib/types';
import { Button, Field, Input, Select } from './ui';

// One payment row with inline Edit + Delete. Self-contained: it owns its edit
// state and runs the mutations itself, so it drops into any payments list
// (student history, recent-payments manager) unchanged. `subtitle` lets callers
// show who the payment belongs to when the list spans students.
export function PaymentListItem({
  payment,
  subtitle,
}: {
  payment: PaymentRow;
  subtitle?: string;
}) {
  const update = useUpdatePayment();
  const del = useDeletePayment();

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<PaymentType>(payment.type);
  const [method, setMethod] = useState<Method>(payment.method);
  const [amount, setAmount] = useState(String(Number(payment.amount)));
  const [date, setDate] = useState(payment.date);
  const [note, setNote] = useState(payment.note ?? '');

  function resetFields() {
    setType(payment.type);
    setMethod(payment.method);
    setAmount(String(Number(payment.amount)));
    setDate(payment.date);
    setNote(payment.note ?? '');
  }

  async function save(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    try {
      await update.mutateAsync({
        id: payment.id,
        patch: { type, method, amount: amt, date, note: note.trim() || null },
      });
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove() {
    setError(null);
    try {
      await del.mutateAsync(payment.id);
      // row disappears on refetch
    } catch (err) {
      setError((err as Error).message);
      setConfirming(false);
    }
  }

  if (editing) {
    return (
      <div className="px-4 py-3 bg-slate-50/60">
        <form onSubmit={save} className="space-y-3">
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Note" hint="Optional.">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetFields();
                setEditing(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={update.isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-navy">
            {payment.type} · <span className="font-normal text-slate-500">{payment.method}</span>
          </p>
          <p className="text-xs text-slate-400 truncate">
            {subtitle ? `${subtitle} · ` : ''}
            {formatDate(payment.date)}
            {payment.receipt_code ? ` · ${payment.receipt_code}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <p className="font-bold text-emerald-600 mr-1">{pkr(Number(payment.amount))}</p>
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              setEditing(true);
            }}
            aria-label="Edit payment"
            className="rounded-lg p-2 text-slate-400 hover:text-navy hover:bg-slate-100"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setConfirming((v) => !v)}
            aria-label="Delete payment"
            className="rounded-lg p-2 text-slate-400 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {confirming && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-red-50 ring-1 ring-red-200 px-3 py-2">
          <span className="text-sm text-red-700">Delete this payment?</span>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              onClick={() => setConfirming(false)}
              className="!py-1.5 !px-3 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={remove}
              loading={del.isPending}
              className="!py-1.5 !px-3 text-xs"
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {error && !confirming && (
        <p className="mt-2 text-sm text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
