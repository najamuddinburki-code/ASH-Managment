import { supabase } from './supabase';
import { monthBounds } from './dates';
import type {
  CourseRow,
  EnrollmentRow,
  EnrollmentTotalRow,
  ExpenseRow,
  PaymentRow,
  SettingRow,
} from './types';

function must<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------------------------------------------------------------------
// Code generation: EN001 / RC001 / EX001. Find the highest existing numeric
// suffix for the given prefix+column and return the next one, zero-padded.
// (Robust to gaps from deletions; single-owner app, so no race concern.)
// ---------------------------------------------------------------------
async function nextCode(
  table: 'enrollments' | 'payments' | 'expenses',
  column: 'enroll_code' | 'receipt_code' | 'expense_code',
  prefix: string,
): Promise<string> {
  const { data, error } = await supabase.from(table).select(column);
  if (error) throw new Error(error.message);
  let max = 0;
  for (const row of (data ?? []) as Array<Record<string, string | null>>) {
    const code = row[column];
    if (!code) continue;
    const m = code.match(new RegExp(`^${prefix}(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------
export async function fetchCourses(): Promise<CourseRow[]> {
  const { data, error } = await supabase.from('courses').select('*').order('name');
  return must(data, error);
}

export async function insertCourse(
  c: Pick<CourseRow, 'name' | 'instructor' | 'typical_admission' | 'typical_monthly'>,
): Promise<CourseRow> {
  const { data, error } = await supabase.from('courses').insert(c).select().single();
  return must(data, error);
}

export async function updateCourse(
  id: number,
  patch: Partial<Pick<CourseRow, 'name' | 'instructor' | 'typical_admission' | 'typical_monthly' | 'active'>>,
): Promise<CourseRow> {
  const { data, error } = await supabase.from('courses').update(patch).eq('id', id).select().single();
  return must(data, error);
}

// ---------------------------------------------------------------------
// Enrollments
// ---------------------------------------------------------------------
export async function fetchEnrollments(): Promise<EnrollmentRow[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .order('created_at', { ascending: false });
  return must(data, error);
}

export async function fetchEnrollment(id: number): Promise<EnrollmentRow> {
  const { data, error } = await supabase.from('enrollments').select('*').eq('id', id).single();
  return must(data, error);
}

export async function fetchEnrollmentTotals(): Promise<EnrollmentTotalRow[]> {
  const { data, error } = await supabase.from('enrollment_totals').select('*');
  return must(data, error);
}

export type NewEnrollment = Pick<
  EnrollmentRow,
  | 'student_name'
  | 'phone'
  | 'course_id'
  | 'course_name'
  | 'join_date'
  | 'due_day'
  | 'admission_fee'
  | 'monthly_fee'
  | 'discount'
>;

export async function insertEnrollment(e: NewEnrollment): Promise<EnrollmentRow> {
  const enroll_code = await nextCode('enrollments', 'enroll_code', 'EN');
  const { data, error } = await supabase
    .from('enrollments')
    .insert({ ...e, enroll_code, status: 'Active' })
    .select()
    .single();
  return must(data, error);
}

export async function updateEnrollment(
  id: number,
  patch: Partial<
    Pick<
      EnrollmentRow,
      | 'student_name'
      | 'phone'
      | 'course_id'
      | 'course_name'
      | 'join_date'
      | 'due_day'
      | 'admission_fee'
      | 'monthly_fee'
      | 'discount'
      | 'status'
      | 'notes'
    >
  >,
): Promise<EnrollmentRow> {
  const { data, error } = await supabase.from('enrollments').update(patch).eq('id', id).select().single();
  return must(data, error);
}

// Delete an enrollment. Payments cascade-delete with it (see schema FK), so
// callers must confirm with the owner first — this also removes payment history.
export async function deleteEnrollment(id: number): Promise<void> {
  const { error } = await supabase.from('enrollments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------
export async function fetchPaymentsForEnrollment(enrollmentId: number): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('date', { ascending: false });
  return must(data, error);
}

export async function fetchPaymentsForMonth(monthKey: string): Promise<PaymentRow[]> {
  const { start, endExclusive } = monthBounds(monthKey);
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .gte('date', start)
    .lt('date', endExclusive)
    .order('date', { ascending: false });
  return must(data, error);
}

// Most recent payments across all students (for the "Recent payments" manage
// list on the Log Payment screen). Ordered newest-first by entry time.
export async function fetchRecentPayments(limit = 12): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return must(data, error);
}

export type NewPayment = Pick<PaymentRow, 'enrollment_id' | 'date' | 'type' | 'method' | 'amount' | 'note'>;

export async function insertPayment(p: NewPayment): Promise<PaymentRow> {
  const receipt_code = await nextCode('payments', 'receipt_code', 'RC');
  const { data, error } = await supabase
    .from('payments')
    .insert({ ...p, receipt_code })
    .select()
    .single();
  return must(data, error);
}

export async function updatePayment(
  id: number,
  patch: Partial<Pick<PaymentRow, 'date' | 'type' | 'method' | 'amount' | 'note'>>,
): Promise<PaymentRow> {
  const { data, error } = await supabase.from('payments').update(patch).eq('id', id).select().single();
  return must(data, error);
}

export async function deletePayment(id: number): Promise<void> {
  const { error } = await supabase.from('payments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------
export async function fetchExpensesForMonth(monthKey: string): Promise<ExpenseRow[]> {
  const { start, endExclusive } = monthBounds(monthKey);
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .gte('date', start)
    .lt('date', endExclusive)
    .order('date', { ascending: false });
  return must(data, error);
}

export type NewExpense = Pick<ExpenseRow, 'date' | 'category' | 'description' | 'method' | 'amount'>;

export async function insertExpense(x: NewExpense): Promise<ExpenseRow> {
  const expense_code = await nextCode('expenses', 'expense_code', 'EX');
  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...x, expense_code })
    .select()
    .single();
  return must(data, error);
}

// ---------------------------------------------------------------------
// Settings (key/value)
// ---------------------------------------------------------------------
export async function fetchSettings(): Promise<SettingRow[]> {
  const { data, error } = await supabase.from('settings').select('*');
  return must(data, error);
}

export async function upsertSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase.from('settings').upsert({ key, value });
  if (error) throw new Error(error.message);
}
