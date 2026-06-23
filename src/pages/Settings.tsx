import { useRef, useState, type FormEvent } from 'react';
import { BookOpen, Plus, Pencil, RotateCcw, Archive, ImagePlus, X } from 'lucide-react';
import { pkr } from '../lib/engine';
import { useAddCourse, useCourses, useUpdateCourse } from '../lib/hooks';
import type { CourseRow } from '../lib/types';
import {
  Button,
  Card,
  CourseAvatar,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Spinner,
} from '../components/ui';

// Read an image file, downscale it to a small square-ish JPEG data URL so it
// stays tiny in the database, and return the data URL.
function fileToDataUrl(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Image not supported on this device.'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

export default function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl tracking-tight text-navy">Settings</h1>
      <CourseCatalogue />
    </div>
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
        per-student. A course photo is shown as its icon across the app.
      </p>

      {adding && <CourseForm onClose={() => setAdding(false)} onDone={() => setAdding(false)} />}

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
        <div className="min-w-0 flex items-center gap-3">
          <CourseAvatar name={c.name} imageUrl={c.image_url} />
          <div className="min-w-0">
            <p className="font-semibold text-navy truncate">{c.name}</p>
            <p className="text-xs text-slate-500 truncate">
              {c.instructor ? `${c.instructor} · ` : ''}
              Admission {pkr(Number(c.typical_admission))} · {pkr(Number(c.typical_monthly))}/mo
            </p>
          </div>
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
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(course?.name ?? '');
  const [instructor, setInstructor] = useState(course?.instructor ?? '');
  const [admission, setAdmission] = useState(String(Number(course?.typical_admission ?? 0)));
  const [monthly, setMonthly] = useState(String(Number(course?.typical_monthly ?? 0)));
  const [image, setImage] = useState<string | null>(course?.image_url ?? null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setError(null);
    try {
      setImage(await fileToDataUrl(file));
    } catch (err) {
      setError((err as Error).message);
    }
  }

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
      image_url: image,
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
        {/* Photo */}
        <Field label="Course photo" hint="Optional — used as the course icon across the app.">
          <div className="flex items-center gap-3">
            <CourseAvatar name={name || 'New'} imageUrl={image} size="lg" />
            <div className="flex flex-col gap-1.5">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
              <Button type="button" variant="ghost" className="!py-2 text-sm" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="w-4 h-4" />
                {image ? 'Change photo' : 'Upload photo'}
              </Button>
              {image && (
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                >
                  <X className="w-3.5 h-3.5" />
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </Field>

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
          <Button type="submit" loading={addCourse.isPending || updateCourse.isPending} className="flex-1">
            {editing ? 'Save Course' : 'Add Course'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
