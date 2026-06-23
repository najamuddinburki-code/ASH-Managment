import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus,
  Users,
  Search,
  CheckSquare,
  Square,
  ListChecks,
  X,
  ChevronDown,
  ChevronRight,
  ReceiptText,
} from 'lucide-react';
import { pkr, type Computed } from '../lib/engine';
import { todayISO } from '../lib/dates';
import {
  useBulkUpdateEnrollments,
  useComputedEnrollments,
  useCourses,
  type ComputedEnrollment,
} from '../lib/hooks';
import { groupEnrollmentsByCourse } from '../lib/metrics';
import {
  Avatar,
  Button,
  Card,
  CourseAvatar,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Spinner,
  StatusBadge,
} from '../components/ui';

type FilterKey = 'all' | 'overdue' | 'up_to_date' | 'closed';
type ViewMode = 'course' | 'all';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'up_to_date', label: 'Up to date' },
  { key: 'closed', label: 'Closed' },
];

const PREVIEW = 5; // students shown per course before "View all".

function rowTone(flag: Computed['flag']): string {
  switch (flag) {
    case 'overdue':
      return 'border-l-red-500 bg-red-50/40';
    case 'up_to_date':
      return 'border-l-emerald-500 bg-emerald-50/30';
    case 'closed':
      return 'border-l-slate-300 bg-slate-50/60';
  }
}

// Suggest the type + amount that clears the most relevant debt for a quick pay.
function quickPayHref(id: number, c: Computed): string {
  const owesAdmission = c.admission_owed > 0;
  const type = owesAdmission ? 'Admission' : 'Monthly';
  const amount = Math.round(owesAdmission ? c.admission_owed : c.monthly_owed);
  return `/pay?enrollment=${id}&type=${type}&amount=${amount}`;
}

export default function Students() {
  const { data, isLoading, isError, error } = useComputedEnrollments();
  const { data: courses } = useCourses();
  const courseImg = new Map((courses ?? []).map((c) => [c.name, c.image_url]));
  const bulkUpdate = useBulkUpdateEnrollments();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [view, setView] = useState<ViewMode>('course');

  const [openCourses, setOpenCourses] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState<Set<string>>(new Set());

  // Bulk-edit selection state.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDate, setBulkDate] = useState(todayISO());
  const [confirming, setConfirming] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filter + sort (overdue first, then biggest balance, then name).
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const order = { overdue: 0, up_to_date: 1, closed: 2 } as const;
    return data
      .filter((e) => (filter === 'all' ? true : e.computed.flag === filter))
      .filter(
        (e) =>
          !q ||
          e.student_name.toLowerCase().includes(q) ||
          (e.course_name ?? '').toLowerCase().includes(q) ||
          (e.enroll_code ?? '').toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          order[a.computed.flag] - order[b.computed.flag] ||
          b.computed.balance - a.computed.balance ||
          a.student_name.localeCompare(b.student_name),
      );
  }, [data, search, filter]);

  const groups = useMemo(
    () => groupEnrollmentsByCourse(rows, (e) => e.course_name || 'No course'),
    [rows],
  );
  const searching = search.trim() !== '';

  function toggleCourse(course: string) {
    setOpenCourses((prev) => {
      const next = new Set(prev);
      if (next.has(course)) next.delete(course);
      else next.add(course);
      return next;
    });
  }

  function toggleSelect(id: number) {
    setNotice(null);
    setConfirming(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
    setConfirming(false);
    setBulkError(null);
  }

  async function applyBulkJoinDate() {
    setBulkError(null);
    if (selected.size === 0) {
      setBulkError('Select at least one student.');
      return;
    }
    if (!bulkDate) {
      setBulkError('Pick a join date.');
      return;
    }
    try {
      const count = selected.size;
      await bulkUpdate.mutateAsync({
        ids: [...selected],
        patch: { join_date: bulkDate, due_day: Number(bulkDate.slice(8, 10)) || 1 },
      });
      exitSelectMode();
      setNotice(`Updated join date for ${count} student${count === 1 ? '' : 's'}.`);
    } catch (err) {
      setBulkError((err as Error).message);
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-tight text-navy">Students</h1>
        <div className="flex items-center gap-2">
          {!selectMode ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setNotice(null);
                  setSelectMode(true);
                }}
                disabled={data.length === 0}
              >
                <ListChecks className="w-4 h-4" />
                Select
              </Button>
              <Link to="/students/new">
                <Button variant="primary">
                  <UserPlus className="w-4 h-4" />
                  Add
                </Button>
              </Link>
            </>
          ) : (
            <Button variant="ghost" onClick={exitSelectMode}>
              <X className="w-4 h-4" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Bulk-edit panel */}
      {selectMode && (
        <Card className="p-4 ring-2 ring-cyan/40">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="font-semibold text-navy text-sm">{selected.size} selected</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setSelected(new Set(rows.map((e) => e.id)));
                }}
                className="text-xs font-semibold text-cyan-dark hover:underline"
              >
                Select all ({rows.length})
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setSelected(new Set());
                }}
                className="text-xs font-semibold text-slate-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          <Field label="Set join date for selected" hint="Also re-anchors each student's monthly due day to this date.">
            <Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
          </Field>

          {bulkError && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">
              {bulkError}
            </p>
          )}

          {!confirming ? (
            <Button
              className="w-full mt-3"
              disabled={selected.size === 0}
              onClick={() => {
                setBulkError(null);
                setConfirming(true);
              }}
            >
              Apply join date
            </Button>
          ) : (
            <div className="mt-3 rounded-xl bg-cyan/10 ring-1 ring-cyan/30 p-3">
              <p className="text-sm text-navy">
                Set join date of <strong>{selected.size}</strong> student
                {selected.size === 1 ? '' : 's'} to <strong>{bulkDate}</strong>? This recalculates
                their due dates and balances.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button loading={bulkUpdate.isPending} onClick={applyBulkJoinDate}>
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {notice && (
        <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-3 py-2 text-sm text-emerald-700 flex items-center justify-between gap-3">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, course, or code…"
          className="pl-10"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ${
              filter === f.key
                ? 'bg-navy text-white ring-navy'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* View toggle: All Students / By Course */}
      {!selectMode && (
        <div className="grid grid-cols-2 gap-1 rounded-full bg-white ring-1 ring-slate-200 p-1">
          {(['all', 'course'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full py-2 text-sm font-semibold transition ${
                view === v ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {v === 'all' ? 'All Students' : 'By Course'}
            </button>
          ))}
        </div>
      )}

      {isError ? (
        <ErrorState message={(error as Error)?.message} />
      ) : isLoading ? (
        <Card>
          <Spinner label="Loading students…" />
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="w-10 h-10" />}
            title="No students yet"
            message="Add your first student to start tracking fees and payments."
            action={
              <Link to="/students/new">
                <Button>
                  <UserPlus className="w-4 h-4" />
                  Add Student
                </Button>
              </Link>
            }
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title="No students found" message="Try a different name, course, or filter." />
        </Card>
      ) : selectMode ? (
        // Bulk-select: flat checkbox list.
        <div className="space-y-2">
          {rows.map((e) => {
            const checked = selected.has(e.id);
            return (
              <button key={e.id} type="button" onClick={() => toggleSelect(e.id)} className="block w-full text-left">
                <Card className={`border-l-4 ${rowTone(e.computed.flag)} px-4 py-3 ${checked ? 'ring-2 ring-cyan' : ''}`}>
                  <div className="flex items-center gap-3">
                    {checked ? (
                      <CheckSquare className="w-5 h-5 text-cyan-dark shrink-0" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300 shrink-0" />
                    )}
                    <Avatar name={e.student_name} tone="brand" size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-navy truncate">{e.student_name}</p>
                        <StatusBadge status={e.status} />
                      </div>
                      <p className="text-xs text-slate-500 truncate">{e.course_name || 'No course'}</p>
                    </div>
                    <p className={`font-bold shrink-0 ${e.computed.flag === 'overdue' ? 'text-red-600' : 'text-navy'}`}>
                      {pkr(e.computed.balance)}
                    </p>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      ) : view === 'all' ? (
        // Flat list of all students.
        <div className="space-y-2">
          {rows.map((e) => (
            <Link key={e.id} to={`/students/${e.id}`}>
              <Card className={`border-l-4 ${rowTone(e.computed.flag)} hover:shadow-md transition px-4 py-3`}>
                <StudentRow e={e} />
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        // Grouped by course.
        <div className="space-y-3">
          {groups.map((g) => {
            const open = searching || openCourses.has(g.course);
            const all = showAll.has(g.course);
            const visible = all ? g.students : g.students.slice(0, PREVIEW);
            return (
              <Card key={g.course} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleCourse(g.course)}
                  className="w-full text-left px-4 py-3.5 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <CourseAvatar name={g.course} imageUrl={courseImg.get(g.course)} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-navy truncate">{g.course}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {g.studentCount} student{g.studentCount === 1 ? '' : 's'}
                        {g.overdueCount > 0 && (
                          <span className="text-red-600 font-semibold"> · {g.overdueCount} overdue</span>
                        )}
                        {g.totalOwed > 0 && (
                          <span> · <span className="font-semibold text-navy">{pkr(g.totalOwed)}</span> owed</span>
                        )}
                      </p>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 shrink-0 transition ${open ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {open && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {visible.map((e) => (
                      <CourseStudentRow key={e.id} e={e} />
                    ))}
                    {g.students.length > PREVIEW && !all && (
                      <button
                        type="button"
                        onClick={() => setShowAll((prev) => new Set(prev).add(g.course))}
                        className="w-full flex items-center justify-center gap-1 px-4 py-3 text-sm font-semibold text-cyan-dark hover:bg-slate-50"
                      >
                        View all {g.studentCount} students
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Flat-list row (All Students view).
function StudentRow({ e }: { e: ComputedEnrollment }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={e.student_name} tone="brand" size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-navy truncate">{e.student_name}</p>
          <StatusBadge status={e.status} />
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">
          {e.course_name || 'No course'} · {pkr(Number(e.monthly_fee))}/mo
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[10px] uppercase tracking-wide text-slate-400 leading-none">Owes</p>
        <p className={`font-bold leading-tight ${e.computed.flag === 'overdue' ? 'text-red-600' : 'text-navy'}`}>
          {pkr(e.computed.balance)}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">Paid {pkr(e.computed.total_paid)}</p>
      </div>
    </div>
  );
}

// By-Course row: essential info only (no payment history here). Tapping the name
// opens the full student profile; "Record Payment" jumps to the payment screen.
function CourseStudentRow({ e }: { e: ComputedEnrollment }) {
  const c = e.computed;
  const owes = c.balance > 0;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-l-4 ${rowTone(c.flag)}`}>
      <Avatar name={e.student_name} tone="brand" size="sm" />
      <Link to={`/students/${e.id}`} className="min-w-0 flex-1 group">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-navy truncate group-hover:text-cyan-dark">{e.student_name}</p>
          <StatusBadge status={e.status} />
        </div>
        {e.enroll_code && <p className="text-xs text-slate-400 truncate">Student ID: {e.enroll_code}</p>}
      </Link>
      <div className="text-right shrink-0">
        <p className="text-[10px] uppercase tracking-wide text-slate-400 leading-none">Owes</p>
        <p className={`text-sm font-bold leading-tight ${owes ? 'text-red-600' : 'text-emerald-600'}`}>
          {pkr(c.balance)}
        </p>
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        <p className="text-[10px] uppercase tracking-wide text-slate-400 leading-none">Paid</p>
        <p className="text-sm font-bold text-navy leading-tight">{pkr(c.total_paid)}</p>
      </div>
      <Link to={quickPayHref(e.id, c)} className="shrink-0">
        <Button variant="primary" className="!py-1.5 !px-2.5 text-xs">
          <ReceiptText className="w-3.5 h-3.5" />
          Pay
        </Button>
      </Link>
    </div>
  );
}
