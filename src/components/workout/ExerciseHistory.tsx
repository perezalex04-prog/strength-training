import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';

interface ExerciseHistoryProps {
  exerciseId: string;
  exerciseName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ExerciseHistory({ exerciseId, exerciseName, isOpen, onClose }: ExerciseHistoryProps) {
  const history = useLiveQuery(
    async () => {
      if (!isOpen || !exerciseId) return [];

      const sets = await db.sets
        .where('exerciseId')
        .equals(exerciseId)
        .toArray();

      // Only completed sets with actual data
      const completed = sets.filter(
        (s) => s.actualWeight != null && s.actualReps != null,
      );

      // Group by session, then look up session dates
      const bySession = new Map<string, typeof completed>();
      for (const s of completed) {
        if (!bySession.has(s.sessionId)) bySession.set(s.sessionId, []);
        bySession.get(s.sessionId)!.push(s);
      }

      const sessionIds = [...bySession.keys()];
      const sessions = await Promise.all(
        sessionIds.map((id) => db.sessions.get(id)),
      );

      // Build date-grouped entries sorted by most recent first
      const entries: { date: string; sets: { weight: number; reps: number; rpe: number | null; e1rm: number | null; setType: string }[] }[] = [];
      for (let i = 0; i < sessionIds.length; i++) {
        const sess = sessions[i];
        if (!sess) continue;
        const sessionSets = bySession.get(sessionIds[i])!;
        entries.push({
          date: sess.date,
          sets: sessionSets
            .sort((a, b) => a.setNumber - b.setNumber)
            .map((s) => ({
              weight: s.actualWeight!,
              reps: s.actualReps!,
              rpe: s.actualRPE,
              e1rm: s.e1rm,
              setType: s.setType,
            })),
        });
      }

      return entries.sort((a, b) => b.date.localeCompare(a.date));
    },
    [isOpen, exerciseId],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="w-full max-h-[70vh] bg-slate-900 border-t border-slate-700 rounded-t-xl safe-bottom flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2 border-b border-slate-800 flex-shrink-0">
          <h3 className="text-sm font-semibold text-slate-200 truncate">{exerciseName}</h3>
          <span className="text-[10px] text-slate-500">Full History</span>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-2 space-y-3">
          {(!history || history.length === 0) && (
            <p className="text-sm text-slate-600 text-center py-6">No history yet</p>
          )}
          {history?.map((entry) => (
            <div key={entry.date} className="space-y-1">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                })}
              </span>
              {entry.sets.map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-xs text-slate-300 pl-2">
                  <span className="text-[10px] text-slate-600 w-6 uppercase">{s.setType.slice(0, 3)}</span>
                  <span className="font-semibold tabular-nums">
                    {s.weight}×{s.reps}
                    {s.rpe != null && <span className="text-slate-500"> @{s.rpe}</span>}
                  </span>
                  {s.e1rm != null && (
                    <span className="text-[10px] text-slate-600">e1RM {s.e1rm}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="px-4 py-3 flex-shrink-0">
          <button onClick={onClose} className="w-full py-3 rounded-lg text-slate-400 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
