import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { compute, type Computed, type Enrollment as EngineEnrollment } from './engine';
import * as api from './api';
import type { EnrollmentRow, EnrollmentTotalRow } from './types';

// ---------------------------------------------------------------------
// Query keys (one place so invalidation is consistent).
// ---------------------------------------------------------------------
export const qk = {
  courses: ['courses'] as const,
  enrollments: ['enrollments'] as const,
  enrollmentTotals: ['enrollment_totals'] as const,
  enrollment: (id: number) => ['enrollment', id] as const,
  paymentsForEnrollment: (id: number) => ['payments', 'enrollment', id] as const,
  paymentsForMonth: (m: string) => ['payments', 'month', m] as const,
  recentPayments: (limit: number) => ['payments', 'recent', limit] as const,
  expensesForMonth: (m: string) => ['expenses', 'month', m] as const,
  settings: ['settings'] as const,
};

// A computed enrollment = the DB row + paid totals + every engine-derived value.
export type ComputedEnrollment = EnrollmentRow & {
  monthly_paid: number;
  admission_paid: number;
  computed: Computed;
};

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

// ---------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------
export function useCourses() {
  return useQuery({ queryKey: qk.courses, queryFn: api.fetchCourses });
}

// ---------------------------------------------------------------------
// Enrollments (raw + computed). We fetch enrollments and the paid-totals view
// once, merge them, and run the pure engine per row — compute on read.
// ---------------------------------------------------------------------
export function useComputedEnrollments() {
  const enrollmentsQ = useQuery({ queryKey: qk.enrollments, queryFn: api.fetchEnrollments });
  const totalsQ = useQuery({ queryKey: qk.enrollmentTotals, queryFn: api.fetchEnrollmentTotals });

  const totalsById = new Map<number, EnrollmentTotalRow>(
    (totalsQ.data ?? []).map((t) => [t.enrollment_id, t]),
  );

  const data: ComputedEnrollment[] = (enrollmentsQ.data ?? []).map((e) => {
    const t = totalsById.get(e.id);
    const monthly_paid = Number(t?.monthly_paid ?? 0);
    const admission_paid = Number(t?.admission_paid ?? 0);
    return {
      ...e,
      monthly_paid,
      admission_paid,
      computed: compute(toEngine(e), { monthly_paid, admission_paid }),
    };
  });

  return {
    data,
    isLoading: enrollmentsQ.isLoading || totalsQ.isLoading,
    isError: enrollmentsQ.isError || totalsQ.isError,
    error: enrollmentsQ.error ?? totalsQ.error,
    refetch: () => {
      enrollmentsQ.refetch();
      totalsQ.refetch();
    },
  };
}

export function useEnrollment(id: number) {
  return useQuery({ queryKey: qk.enrollment(id), queryFn: () => api.fetchEnrollment(id) });
}

export function usePaymentsForEnrollment(id: number) {
  return useQuery({
    queryKey: qk.paymentsForEnrollment(id),
    queryFn: () => api.fetchPaymentsForEnrollment(id),
  });
}

export function usePaymentsForMonth(monthKey: string) {
  return useQuery({
    queryKey: qk.paymentsForMonth(monthKey),
    queryFn: () => api.fetchPaymentsForMonth(monthKey),
  });
}

export function useRecentPayments(limit = 12) {
  return useQuery({
    queryKey: qk.recentPayments(limit),
    queryFn: () => api.fetchRecentPayments(limit),
  });
}

export function useExpensesForMonth(monthKey: string) {
  return useQuery({
    queryKey: qk.expensesForMonth(monthKey),
    queryFn: () => api.fetchExpensesForMonth(monthKey),
  });
}

export function useSettings() {
  return useQuery({ queryKey: qk.settings, queryFn: api.fetchSettings });
}

// ---------------------------------------------------------------------
// Mutations — every one invalidates the data that derived numbers depend on,
// so balances/flags reflect immediately after a save.
// ---------------------------------------------------------------------
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.enrollments });
    qc.invalidateQueries({ queryKey: qk.enrollmentTotals });
    qc.invalidateQueries({ queryKey: ['payments'] });
    qc.invalidateQueries({ queryKey: ['enrollment'] });
  };
}

export function useAddEnrollment() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: api.insertEnrollment, onSuccess: invalidate });
}

export function useUpdateEnrollment() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (vars: { id: number; patch: Parameters<typeof api.updateEnrollment>[1] }) =>
      api.updateEnrollment(vars.id, vars.patch),
    onSuccess: invalidate,
  });
}

export function useAddPayment() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: api.insertPayment, onSuccess: invalidate });
}

export function useUpdatePayment() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (vars: { id: number; patch: Parameters<typeof api.updatePayment>[1] }) =>
      api.updatePayment(vars.id, vars.patch),
    onSuccess: invalidate,
  });
}

export function useDeletePayment() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: number) => api.deletePayment(id), onSuccess: invalidate });
}

export function useDeleteEnrollment() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: number) => api.deleteEnrollment(id), onSuccess: invalidate });
}

export function useAddExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.insertExpense,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });
}

export function useAddCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.insertCourse,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.courses }),
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; patch: Parameters<typeof api.updateCourse>[1] }) =>
      api.updateCourse(vars.id, vars.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.courses }),
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { key: string; value: string }) => api.upsertSetting(vars.key, vars.value),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.settings }),
  });
}
