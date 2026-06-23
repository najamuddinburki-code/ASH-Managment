import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Users, Search, CheckSquare, Square, ListChecks, X } from 'lucide-react';
import { pkr } from '../lib/engine';
import { todayISO } from '../lib/dates';
import { useBulkUpdateEnrollments, useComputedEnrollments, type ComputedEnrollment } from '../lib/hooks';
import { Button, Card, EmptyState, ErrorState, Field, Input, Spinner, StatusBadge } from '../components/ui';

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

// The shared inner content of a student row (used by both link and select modes).
function RowBody({ e }: { e: ComputedEnrollment }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-1 min-w-0">
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
        <p className={`font-bold ${e.computed.flag === 'overdue' ? 'text-red-600' : 'text-navy'}`}>
          {pkr(e.computed.balance)}
        </p>
        <p className="text-[11px] text-slate-400">Paid {pkr(e.computed.total_paid)}</p>
      </div>
    </div>
  );
}

export default function Students() {
  const { data, isLoading, isError, error } = useComputedEnrollments();
  const bulkUpdate = useBulkUpdateEnrollments();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  // Bulk-edit selection state.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDate, setBulkDate] = useState(todayISO());
  const [confirming, setConfirming] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  function toggle(id: number) {
    setNotice(null);
    setConfirming(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setConfirming(false);
    setSelected(new Set(rows.map((e) => e.id)));
  }

  function clearSelection() {
    setConfirming(false);
    setSelected(new Set());
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
        // Keep the due day anchored to the (new) join day-of-month, like the rest of the app.
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
            <p className="font-semibold text-navy text-sm">
              {selected.size} selected
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllVisible}
                className="text-xs font-semibold text-cyan-dark hover:underline"
              >
                Select all ({rows.length})
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={clearSelection}
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

      {/* Success notice */}
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
          {rows.map((e) => {
            const checked = selected.has(e.id);
            if (selectMode) {
              return (
                <button key={e.id} type="button" onClick={() => toggle(e.id)} className="block w-full text-left">
                  <Card
                    className={`border-l-4 ${rowTone(e.computed.flag)} transition px-4 py-3 ${
                      checked ? 'ring-2 ring-cyan' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {checked ? (
                        <CheckSquare className="w-5 h-5 text-cyan-dark shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300 shrink-0" />
                      )}
                      <RowBody e={e} />
                    </div>
                  </Card>
                </button>
              );
            }
            return (
              <Link key={e.id} to={`/students/${e.id}`}>
                <Card className={`border-l-4 ${rowTone(e.computed.flag)} hover:shadow-md transition px-4 py-3`}>
                  <RowBody e={e} />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
