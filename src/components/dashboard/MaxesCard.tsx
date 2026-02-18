import { Card } from '@/components/shared/Card';
import type { UserSettings, PrimaryLift } from '@/db/types';
import { LIFT_LABELS } from '@/db/types';

interface MaxesCardProps {
  settings: UserSettings;
}

const lifts: PrimaryLift[] = ['squat', 'bench', 'deadlift'];

export function MaxesCard({ settings }: MaxesCardProps) {
  return (
    <Card title="Current Maxes & Goals">
      <div className="space-y-3">
        <div className="grid grid-cols-6 gap-2 text-xs text-slate-500 font-semibold">
          <span>Lift</span>
          <span className="text-right">1RM</span>
          <span className="text-right">Goal</span>
          <span className="text-right">TM</span>
          <span className="text-right">Delta</span>
          <span className="text-right">%</span>
        </div>
        {lifts.map((lift) => {
          const current = settings[`${lift}1RM` as keyof UserSettings] as number;
          const goal = settings[`${lift}Goal` as keyof UserSettings] as number;
          const tm = Math.round(current * settings.trainingMaxPercent);
          const delta = goal - current;
          const pct = current > 0 ? ((delta / current) * 100).toFixed(0) : '—';

          return (
            <div key={lift} className="grid grid-cols-6 gap-2 items-center">
              <span className="text-sm font-semibold text-slate-200">
                {LIFT_LABELS[lift]}
              </span>
              <span className="text-right text-sm tabular-nums text-slate-300">{current}</span>
              <span className="text-right text-sm tabular-nums text-amber-400">{goal}</span>
              <span className="text-right text-sm tabular-nums text-slate-500">{tm}</span>
              <span className="text-right text-sm tabular-nums text-amber-500">+{delta}</span>
              <span className="text-right text-xs tabular-nums text-slate-500">{pct}%</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
