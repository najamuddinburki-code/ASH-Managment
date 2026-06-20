// Database row shapes (mirror supabase_schema.sql). Numerics come back as
// JS numbers via supabase-js; dates as ISO 'YYYY-MM-DD' strings.

export type Status = 'Active' | 'Completed' | 'Dropped';
export type PaymentType = 'Admission' | 'Monthly';
export type Method = 'Cash' | 'Online';
export type ExpenseCategory =
  | 'Rent'
  | 'Salaries'
  | 'Utilities'
  | 'Supplies'
  | 'Marketing'
  | 'Other';

export interface CourseRow {
  id: number;
  name: string;
  instructor: string | null;
  typical_admission: number;
  typical_monthly: number;
  active: boolean;
  created_at: string;
}

export interface EnrollmentRow {
  id: number;
  enroll_code: string | null;
  student_name: string;
  phone: string | null;
  course_id: number | null;
  course_name: string | null;
  join_date: string;
  due_day: number;
  admission_fee: number;
  monthly_fee: number;
  discount: number;
  status: Status;
  notes: string | null;
  created_at: string;
}

export interface PaymentRow {
  id: number;
  receipt_code: string | null;
  enrollment_id: number;
  date: string;
  type: PaymentType;
  method: Method;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface ExpenseRow {
  id: number;
  expense_code: string | null;
  date: string;
  category: ExpenseCategory | null;
  description: string | null;
  method: Method | null;
  amount: number;
  created_at: string;
}

export interface EnrollmentTotalRow {
  enrollment_id: number;
  monthly_paid: number;
  admission_paid: number;
}

export interface SettingRow {
  key: string;
  value: string | null;
}
