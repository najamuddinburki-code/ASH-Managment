import { useState } from 'react';
import { ArrowRight, Check, Plus, Printer, Share2 } from 'lucide-react';
import { pkr } from '../lib/engine';
import { formatDate } from '../lib/dates';
import type { PaymentRow } from '../lib/types';
import { Button, Card } from './ui';

export interface ReceiptData {
  academyName: string;
  studentName: string;
  courseName: string;
  payment: PaymentRow;
  remainingBalance?: number;
}

// Shown after a payment is logged. The `.receipt-print` card is the only thing
// that prints (see the @media print rule in index.css); Share uses the native
// share sheet on phones and falls back to copying plain text on desktop.
export function Receipt({
  data,
  onAnother,
  onDone,
}: {
  data: ReceiptData;
  onAnother: () => void;
  onDone: () => void;
}) {
  const { academyName, studentName, courseName, payment } = data;
  const [copied, setCopied] = useState(false);

  function receiptText(): string {
    return [
      academyName,
      payment.receipt_code ? `Receipt ${payment.receipt_code}` : 'Receipt',
      '----------------------------',
      `Student: ${studentName}`,
      courseName ? `Course: ${courseName}` : '',
      `Type: ${payment.type}`,
      `Method: ${payment.method}`,
      `Amount: ${pkr(Number(payment.amount))}`,
      `Date: ${formatDate(payment.date)}`,
      '----------------------------',
      'Thank you!',
    ]
      .filter(Boolean)
      .join('\n');
  }

  async function share() {
    const text = receiptText();
    try {
      if (navigator.share) {
        await navigator.share({
          title: payment.receipt_code ? `Receipt ${payment.receipt_code}` : 'Receipt',
          text,
        });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user dismissed the share sheet — nothing to do */
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center text-center pt-2 print:hidden">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
          <Check className="w-7 h-7 text-emerald-600" />
        </div>
        <p className="font-bold text-navy text-lg">Payment recorded</p>
        <p className="text-sm text-slate-500">Balance updated automatically.</p>
      </div>

      <Card className="p-5 receipt-print">
        <div className="text-center border-b border-dashed border-slate-200 pb-3">
          <p className="font-extrabold text-navy leading-tight">{academyName}</p>
          <p className="text-xs text-slate-400 mt-0.5">Payment Receipt</p>
        </div>
        <dl className="text-sm mt-3 space-y-1.5">
          <Row k="Receipt" v={payment.receipt_code ?? '—'} mono />
          <Row k="Student" v={studentName} />
          {courseName && <Row k="Course" v={courseName} />}
          <Row k="Type" v={payment.type} />
          <Row k="Method" v={payment.method} />
          <Row k="Date" v={formatDate(payment.date)} />
        </dl>
        <div className="flex items-center justify-between border-t border-dashed border-slate-200 mt-3 pt-3">
          <span className="text-sm font-semibold text-slate-500">Amount received</span>
          <span className="text-xl font-extrabold text-emerald-600">
            {pkr(Number(payment.amount))}
          </span>
        </div>
        {typeof data.remainingBalance === 'number' && (
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-slate-400">Remaining balance</span>
            <span
              className={`text-sm font-bold ${
                data.remainingBalance > 0 ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              {pkr(data.remainingBalance)}
            </span>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 print:hidden">
        <Button variant="ghost" onClick={share}>
          <Share2 className="w-4 h-4" />
          {copied ? 'Copied!' : 'Share'}
        </Button>
        <Button variant="ghost" onClick={() => window.print()}>
          <Printer className="w-4 h-4" />
          Print
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 print:hidden">
        <Button variant="secondary" onClick={onAnother}>
          <Plus className="w-4 h-4" />
          Log another
        </Button>
        <Button variant="primary" onClick={onDone}>
          View student
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-400">{k}</dt>
      <dd className={`font-semibold text-navy text-right ${mono ? 'font-mono text-xs' : ''}`}>{v}</dd>
    </div>
  );
}
