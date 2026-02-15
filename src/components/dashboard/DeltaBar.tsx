import { clsx } from 'clsx';

interface DeltaBarProps {
  label: string;
  current: number;
  goal: number;
}

export function DeltaBar({ label, current, goal }: DeltaBarProps) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const isGoalReached = current >= goal;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={clsx('tabular-nums font-semibold', isGoalReached ? 'text-green-400' : 'text-slate-300')}>
          {current} / {goal}
        </span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500',
            isGoalReached ? 'bg-green-500' : 'bg-blue-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
