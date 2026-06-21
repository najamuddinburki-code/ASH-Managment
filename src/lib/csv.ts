// CSV helpers for the month export. buildMonthCsv + escaping are pure (and
// unit-tested); downloadCsv touches the DOM to trigger a browser file save.

type Cell = string | number | null | undefined;

// Quote a cell only when it contains a comma, quote, or newline (RFC-4180).
function escapeCell(v: Cell): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(escapeCell).join(',')).join('\n');
}

export interface CsvPayment {
  date: string;
  receipt_code: string | null;
  student: string;
  course: string;
  type: string;
  method: string;
  amount: number;
}

export interface CsvExpense {
  date: string;
  expense_code: string | null;
  category: string;
  description: string;
  method: string;
  amount: number;
}

export interface MonthCsvInput {
  title: string;
  collected: number;
  spent: number;
  profit: number;
  payments: CsvPayment[];
  expenses: CsvExpense[];
}

// One human-readable CSV with a summary block, then payments, then expenses.
// Opens cleanly in Excel / Google Sheets.
export function buildMonthCsv(input: MonthCsvInput): string {
  const rows: Cell[][] = [];
  rows.push([input.title]);
  rows.push([]);
  rows.push(['Summary']);
  rows.push(['Collected', input.collected]);
  rows.push(['Expenses', input.spent]);
  rows.push(['Profit', input.profit]);
  rows.push([]);
  rows.push([`Payments (${input.payments.length})`]);
  rows.push(['Date', 'Receipt', 'Student', 'Course', 'Type', 'Method', 'Amount']);
  for (const p of input.payments) {
    rows.push([p.date, p.receipt_code, p.student, p.course, p.type, p.method, p.amount]);
  }
  rows.push([]);
  rows.push([`Expenses (${input.expenses.length})`]);
  rows.push(['Date', 'Code', 'Category', 'Description', 'Method', 'Amount']);
  for (const x of input.expenses) {
    rows.push([x.date, x.expense_code, x.category, x.description, x.method, x.amount]);
  }
  return toCsv(rows);
}

// Trigger a download of the given text as a .csv file.
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
