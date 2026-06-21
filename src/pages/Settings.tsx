import { useEffect, useState, type FormEvent } from 'react';
import { BookOpen, Check, Plus, Pencil, RotateCcw, Archive } from 'lucide-react';
import { pkr } from '../lib/engine';
import {
  useAddCourse,
  useCourses,
  useSettings,
  useUpdateCourse,
  useUpdateSetting,
} from '../lib/hooks';
import type { CourseRow } from '../lib/types';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Spinner,
} from '../components/ui';

export default function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl tracking-tight text-navy">Settings</h1>
      <AcademyNameSection />
      <CourseCatalogue />
    </div>
  );
}

// ---------------------------------------------------------------------
// Academy name
// ---------------------------------------------------------------------
function AcademyNameSection() {
  const { data: settings, isLoading } = useSettings();
  const updateSetting = useUpdateSetting();
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  const current = settings?.find((s) => s.key === 'academy_name')?.value ?? '';
  useEffect(() => {
    setName(current);
  }, [current]);

  async function save(ev: FormEvent) {
    ev.preventDefault();
    await updateSetting.mutateAsync({ key: 'academy_name', value: name.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <section>
      <h2 className="font-label text-sm font-bold text-navy uppercase tracking-[0.16em] mb-2 px-1">Academy</h2>
      <Card className="p-4 sm:p-5">
        {isLoading ? (
          <Spinner />
        ) : (
          <form onSubmit={save} className="space-y-3">
            <Field label="Academy name" hint="Shown in the header on every screen.">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button type="submit" loading={updateSetting.isPending}>
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : (
                'Save name'
              )}
            </Button>
          </form>
        )}
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------
// Course catalogue
// ---------------------------------------------------------------------
function CourseCatalogue() {
  const { data: courses, isLoading, isError, error } = useCourses();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const active = (courses ?? []).filter((c) => c.active);
  const retired = (courses ?? []).filter((c) => !c.active);

  return (
    <section>
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="font-label text-sm font-bold text-navy uppercase tracking-[0.16em]">Course Catalogue</h2>
        <Button
          variant="ghost"
          onClick={() => {
            setAdding((v) => !v);
            setEditingId(null);
          }}
          className="!py-2 !px-3 text-xs"
        >
          <Plus className="w-4 h-4" />
          Add Course
        </Button>
      </div>

      <p className="text-xs text-slate-500 px-1 mb-2">
        Courses only <strong>suggest</strong> default fees when adding a student — actual fees stay
        per-student.
      </p>

      {adding && (
        <CourseForm
          onClose={() => setAdding(false)}
          onDone={() => setAdding(false)}
        />
      )}

      {isError ? (
        <ErrorState message={(error as Error)?.message} />
      ) : isLoading ? (
        <Card>
          <Spinner />
        </Card>
      ) : (courses ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen className="w-9 h-9" />}
            title="No courses yet"
            message="Add courses to speed up student entry with suggested fees."
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {active.map((c) =>
            editingId === c.id ? (
              <CourseForm key={c.id} course={c} onClose={() => setEditingId(null)} onDone={() => setEditingId(null)} />
            ) : (
              <CourseRowView key={c.id} course={c} onEdit={() => setEditingId(c.id)} />
            ),
          )}

          {retired.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide pt-3 px-1">
                Retired
              </p>
              {retired.map((c) => (
                <CourseRowView key={c.id} course={c} onEdit={() => setEditingId(c.id)} retired />
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function CourseRowView({
  course: c,
  onEdit,
  retired,
}: {
  course: CourseRow;
  onEdit: () => void;
  retired?: boolean;
}) {
  const updateCourse = useUpdateCourse();
  return (
    <Card className={`px-4 py-3 ${retired ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-navy truncate">{c.name}</p>
          <p className="text-xs text-slate-500 truncate">
            {c.instructor ? `${c.instructor} · ` : ''}
            Admission {pkr(Number(c.typical_admission))} · {pkr(Number(c.typical_monthly))}/mo
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-navy"
            aria-label="Edit course"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => updateCourse.mutate({ id: c.id, patch: { active: !c.active } })}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-navy"
            aria-label={c.active ? 'Retire course' : 'Restore course'}
            title={c.active ? 'Retire' : 'Restore'}
          >
            {c.active ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </Card>
  );
}

function CourseForm({
  course,
  onClose,
  onDone,
}: {
  course?: CourseRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const addCourse = useAddCourse();
  const updateCourse = useUpdateCourse();
  const editing = !!course;

  const [name, setName] = useState(course?.name ?? '');
  const [instructor, setInstructor] = useState(course?.instructor ?? '');
  const [admission, setAdmission] = useState(String(Number(course?.typical_admission ?? 0)));
  const [monthly, setMonthly] = useState(String(Number(course?.typical_monthly ?? 0)));
  const [error, setError] = useState<string | null>(null);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Course name is required.');
      return;
    }
    const payload = {
      name: name.trim(),
      instructor: instructor.trim() || null,
      typical_admission: Number(admission) || 0,
      typical_monthly: Number(monthly) || 0,
    };
    try {
      if (editing) await updateCourse.mutateAsync({ id: course!.id, patch: payload });
      else await addCourse.mutateAsync(payload);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Card className="p-4 mb-2">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Course name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spoken English" />
        </Field>
        <Field label="Instructor" hint="Label only — no effect on fees.">
          <Input value={instructor} onChange={(e) => setInstructor(e.target.value)} placeholder="Optional" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Suggested admission (PKR)">
            <Input type="number" min={0} value={admission} onChange={(e) => setAdmission(e.target.value)} />
          </Field>
          <Field label="Suggested monthly (PKR)">
            <Input type="number" min={0} value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          </Field>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="flex gap-3">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={addCourse.isPending || updateCourse.isPending}
            className="flex-1"
          >
            {editing ? 'Save course' : 'Add course'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
