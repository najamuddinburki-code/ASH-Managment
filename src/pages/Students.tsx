import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Users, Search } from 'lucide-react';
import { pkr } from '../lib/engine';
import { useComputedEnrollments, type ComputedEnrollment } from '../lib/hooks';
import { Button, Card, EmptyState, ErrorState, Input, Spinner, StatusBadge } from '../components/ui';

type FilterKey = 'all' | 'overdue' | 'up_to_date' | 'closed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'up_to_date', label: 'Up to date' },
  { key: 'closed', label: 'Closed' },
];

// Left accent + subtle background by flag.
function rowTone(flag: ComputedEnrollment['computed']['flag']): string {
  switch (flag) {
    case 'overdue':
      return 'border-l-red-500 bg-red-50/40';
    case 'up_to_date':
      return 'border-l-emerald-500 bg-emerald-50/30';
    case 'closed':
      return 'border-l-slate-300 bg-slate-50/60';
  }
}

export default function Students() {
  const { data, isLoading, isError, error } = useComputedEnrollments();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data
      .filter((e) => (filter === 'all' ? true : e.computed.flag === filter))
      .filter(
        (e) =>
          !q ||
          e.student_name.toLowerCase().includes(q) ||
          (e.course_name ?? '').toLowerCase().includes(q) ||
          (e.enroll_code ?? '').toLowerCase().includes(q),
      );
  }, [data, search, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-tight text-navy">Students</h1>
        <Link to="/students/new">
          <Button variant="primary">
            <UserPlus className="w-4 h-4" />
            Add
          </Button>
        </Link>
      </div>

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
          <EmptyState title="No matches" message="Try a different search or filter." />
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((e) => (
            <Link key={e.id} to={`/students/${e.id}`}>
              <Card
                className={`border-l-4 ${rowTone(
                  e.computed.flag,
                )} hover:shadow-md transition px-4 py-3`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-navy truncate">{e.student_name}</p>
                      <StatusBadge status={e.status} />
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {e.course_name || 'No course'} · {pkr(Number(e.monthly_fee))}/mo
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`font-bold ${
                        e.computed.flag === 'overdue' ? 'text-red-600' : 'text-navy'
                      }`}
                    >
                      {pkr(e.computed.balance)}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Paid {pkr(e.computed.total_paid)}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
