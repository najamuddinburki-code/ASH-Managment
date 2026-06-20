import { Wrench } from 'lucide-react';
import { Card, EmptyState } from '../components/ui';

// Temporary stand-in used by routes whose screen is built in a later phase.
export default function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-navy">{title}</h1>
      <Card>
        <EmptyState
          icon={<Wrench className="w-10 h-10" />}
          title={`Coming in ${phase}`}
          message="This screen is part of an upcoming build phase."
        />
      </Card>
    </div>
  );
}
