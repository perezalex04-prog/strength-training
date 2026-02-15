import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { Card } from '@/components/shared/Card';
import { Badge } from '@/components/shared/Badge';
import type { UserSettings, PrimaryLift } from '@/db/types';
import { LIFT_LABELS } from '@/db/types';

interface WeeklyBestsProps {
  settings: UserSettings;
}

const lifts: PrimaryLift[] = ['squat', 'bench', 'deadlift'];

export function WeeklyBests({ settings }: WeeklyBestsProps) {
  const sessions = useLiveQuery(
    () =>
      db.sessions
        .where({ blockType: settings.currentBlockType, weekNumber: settings.currentWeek })
        .toArray(),
    [settings.currentBlockType, settings.currentWeek],
  );

  const allSets = useLiveQuery(
    async () => {
      if (!sessions || sessions.length === 0) return [];
      const ids = sessions.map((s) => s.id);
      return db.sets.where('sessionId').anyOf(ids).toArray();
    },
    [sessions],
  );

  return (
    <Card title="Weekly Best Sets">
      <div className="space-y-3">
        {lifts.map((lift) => {
          // Find ALL sessions for this lift (e.g. bench has D1, D3, D5)
          const liftSessions = sessions?.filter((s) => s.primaryLift === lift) ?? [];
          const liftSessionIds = new Set(liftSessions.map((s) => s.id));
          const sets = (allSets ?? []).filter(
            (s) =>
              liftSessionIds.has(s.sessionId) &&
              (s.setType === 'top' || s.setType === 'backoff' || s.setType === 'volume'),
          );

          let best = sets.length > 0 ? sets[0] : null;
          for (const s of sets) {
            if (s.e1rm && (!best?.e1rm || s.e1rm > best.e1rm)) best = s;
          }

          const goal = settings[`${lift}Goal` as keyof UserSettings] as number;
          const current = settings[`${lift}1RM` as keyof UserSettings] as number;

          let status: { label: string; variant: 'success' | 'warning' | 'muted' } = {
            label: '—',
            variant: 'muted',
          };
          if (best?.e1rm) {
            if (best.e1rm >= goal) status = { label: 'GOAL', variant: 'success' };
            else if (best.e1rm >= current) status = { label: 'PR', variant: 'warning' };
            else status = { label: 'Building', variant: 'muted' };
          }

          return (
            <div key={lift} className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300 w-16">{LIFT_LABELS[lift]}</span>
              {best?.e1rm ? (
                <>
                  <span className="text-sm tabular-nums text-slate-300">
                    {best.actualWeight} × {best.actualReps} @{best.actualRPE}
                  </span>
                  <span className="text-sm tabular-nums font-semibold text-slate-200">
                    E1RM: {best.e1rm}
                  </span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </>
              ) : (
                <span className="text-sm text-slate-600">No data yet</span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
