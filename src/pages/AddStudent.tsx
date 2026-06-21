import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { todayISO } from '../lib/dates';
import { useAddEnrollment, useCourses } from '../lib/hooks';
import { Button, Card, Field, Input, Select } from '../components/ui';

export default function AddStudent() {
  const navigate = useNavigate();
  const { data: courses } = useCourses();
  const addEnrollment = useAddEnrollment();

  const activeCourses = (courses ?? []).filter((c) => c.active);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [courseId, setCourseId] = useState<string>('');
  const [joinDate, setJoinDate] = useState(todayISO());
  const [admissionFee, setAdmissionFee] = useState('0');
  const [monthlyFee, setMonthlyFee] = useState('0');
  const [error, setError] = useState<string | null>(null);

  // Selecting a course pre-fills its suggested fees (owner can still override).
  function onCourseChange(value: string) {
    setCourseId(value);
    const c = activeCourses.find((x) => String(x.id) === value);
    if (c) {
      setAdmissionFee(String(Number(c.typical_admission)));
      setMonthlyFee(String(Number(c.typical_monthly)));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!joinDate) {
      setError('Please pick a join date.');
      return;
    }
    const course = activeCourses.find((c) => String(c.id) === courseId);

    try {
      const created = await addEnrollment.mutateAsync({
        student_name: name.trim(),
        phone: phone.trim() || null,
        course_id: course?.id ?? null,
        course_name: course?.name ?? null,
        join_date: joinDate,
        // The monthly fee falls due on the join day-of-month, every month.
        due_day: Number(joinDate.slice(8, 10)) || 1,
        admission_fee: Number(admissionFee) || 0,
        monthly_fee: Number(monthlyFee) || 0,
        discount: 0,
      });
      navigate(`/students/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/students" className="text-slate-500 hover:text-navy">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-display text-2xl tracking-tight text-navy">Add Student</h1>
      </div>

      {/* Domain hint: typing a fee ≠ receiving money */}
      <div className="rounded-xl bg-cyan/10 ring-1 ring-cyan/30 p-3 flex gap-2.5 text-sm text-navy">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-cyan-dark" />
        <p>
          Setting fees only defines what's <strong>expected</strong>. The new student is{' '}
          <strong>due from day one</strong> — they'll show a balance and appear overdue straight
          away. It only clears once you <strong>log a payment</strong>.
        </p>
      </div>

      <Card className="p-4 sm:p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Student name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </Field>

          <Field label="Phone" hint="Optional — handy for the chase list.">
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03xx-xxxxxxx"
            />
          </Field>

          <Field label="Course" hint="Picking a course pre-fills its suggested fees — you can change them.">
            <Select value={courseId} onChange={(e) => onCourseChange(e.target.value)}>
              <option value="">— Select a course —</option>
              {activeCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Join date"
            hint="The monthly fee falls due on this day each month (e.g. join on the 20th → due the 20th every month)."
          >
            <Input type="date" required value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Admission fee (PKR)">
              <Input
                type="number"
                min={0}
                value={admissionFee}
                onChange={(e) => setAdmissionFee(e.target.value)}
              />
            </Field>
            <Field label="Monthly fee (PKR)">
              <Input
                type="number"
                min={0}
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value)}
              />
            </Field>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Link to="/students" className="flex-1">
              <Button type="button" variant="ghost" className="w-full">
                Cancel
              </Button>
            </Link>
            <Button type="submit" loading={addEnrollment.isPending} className="flex-1">
              Save student
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
