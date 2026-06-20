import { GraduationCap } from 'lucide-react';

// Placeholder home for Phase 1. Real screens (auth, dashboard, students,
// payments, reports, settings) arrive in later phases.
export default function App() {
  return (
    <div className="min-h-screen bg-navy text-white flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gold/15 ring-1 ring-gold/40 flex items-center justify-center mb-6">
        <GraduationCap className="w-8 h-8 text-gold" />
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight">American Skill Hub</h1>
      <p className="text-gold font-semibold mt-1">Academy Management</p>
      <p className="text-white/60 mt-6 max-w-sm text-sm leading-relaxed">
        Project scaffold is ready. The dashboard, students, payments, and reports
        screens are built in the next phases.
      </p>
      <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-4 py-2 text-xs text-white/70">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        Phase 1 · Setup complete
      </div>
    </div>
  );
}
