import { describe, it, expect } from 'vitest';
import { buildMonthCsv, toCsv, type CsvExpense, type CsvPayment } from './csv';

describe('toCsv escaping', () => {
  it('quotes cells containing commas, quotes or newlines', () => {
    expect(toCsv([['a', 'b,c']])).toBe('a,"b,c"');
    expect(toCsv([['say "hi"']])).toBe('"say ""hi"""');
    expect(toCsv([['line1\nline2']])).toBe('"line1\nline2"');
  });

  it('renders null/undefined as empty cells and numbers as-is', () => {
    expect(toCsv([['x', null, undefined, 5]])).toBe('x,,,5');
  });

  it('an empty row becomes a blank line', () => {
    expect(toCsv([['a'], [], ['b']])).toBe('a\n\nb');
  });
});

describe('buildMonthCsv', () => {
  const payments: CsvPayment[] = [
    {
      date: '2026-06-20',
      receipt_code: 'RC042',
      student: 'Ayesha',
      course: 'Spoken English',
      type: 'Monthly',
      method: 'Cash',
      amount: 6000,
    },
  ];
  const expenses: CsvExpense[] = [
    {
      date: '2026-06-01',
      expense_code: 'EX003',
      category: 'Rent',
      description: 'Office, main branch',
      method: 'Cash',
      amount: 30000,
    },
  ];

  it('includes title, summary numbers, and both section headers + data', () => {
    const csv = buildMonthCsv({
      title: 'American Skill Hub — June 2026',
      collected: 6000,
      spent: 30000,
      profit: -24000,
      payments,
      expenses,
    });
    expect(csv).toContain('American Skill Hub — June 2026');
    expect(csv).toContain('Collected,6000');
    expect(csv).toContain('Profit,-24000');
    expect(csv).toContain('Date,Receipt,Student,Course,Type,Method,Amount');
    expect(csv).toContain('RC042');
    // description has a comma → must be quoted
    expect(csv).toContain('"Office, main branch"');
    expect(csv).toContain('Payments (1)');
    expect(csv).toContain('Expenses (1)');
  });

  it('handles an empty month without throwing', () => {
    const csv = buildMonthCsv({
      title: 'Empty',
      collected: 0,
      spent: 0,
      profit: 0,
      payments: [],
      expenses: [],
    });
    expect(csv).toContain('Payments (0)');
    expect(csv).toContain('Expenses (0)');
  });
});
