import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/shared/Card';
import { DAY_CONFIG, BLOCK_LABELS, PHASE_LABELS } from '@/db/types';
import type { PrimaryLift, WorkoutSet } from '@/db/types';
import { findBestSet } from '@/engine/progression';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const LIFT_COLORS: Record<PrimaryLift, string> = {
  squat: '#3b82f6',
  bench: '#eab308',
  deadlift: '#ef4444',
};

/**
 * Group sets by exerciseName and find the best set (highest E1RM) for each exercise.
 */
function getBestSetPerExercise(sets: WorkoutSet[]) {
  const byExercise = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    if (!s.actualWeight || !s.actualReps || !s.actualRPE) continue;
    if (!byExercise.has(s.exerciseName)) byExercise.set(s.exerciseName, []);
    byExercise.get(s.exerciseName)!.push(s);
  }

  const results: { exerciseName: string; setType: string; best: WorkoutSet }[] = [];
  for (const [name, exSets] of byExercise) {
    const best = findBestSet(exSets);
    if (best) {
      results.push({ exerciseName: name, setType: best.setType, best });
    }
  }
  return results;
}

const SET_TYPE_COLORS: Record<string, string> = {
  top: 'text-red-400',
  backoff: 'text-orange-400',
  volume: 'text-cyan-400',
  secondary: 'text-blue-400',
  accessory: 'text-purple-400',
  optional: 'text-slate-400',
};

export function HistoryPage() {
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const progression = useLiveQuery(() =>
    db.progression.orderBy('date').toArray(),
  );

  // Load ALL completed sessions
  const completedSessions = useLiveQuery(async () => {
    const allSessions = await db.sessions.toArray();
    return allSessions
      .filter((s) => s.completed)
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  // Load sets for all completed sessions
  const sessionSets = useLiveQuery(async () => {
    if (!completedSessions || completedSessions.length === 0) return {};
    const ids = completedSessions.map((s) => s.id);
    const sets = await db.sets.where('sessionId').anyOf(ids).toArray();
    const bySession: Record<string, WorkoutSet[]> = {};
    for (const s of sets) {
      if (!bySession[s.sessionId]) bySession[s.sessionId] = [];
      bySession[s.sessionId].push(s);
    }
    return bySession;
  }, [completedSessions]);

  const chartData = (progression ?? []).map((entry) => ({
    week: `W${entry.weekNumber}`,
    date: entry.date,
    Squat: entry.squatE1RM,
    Bench: entry.benchE1RM,
    Deadlift: entry.deadliftE1RM,
    Total: entry.totalE1RM,
  }));

  return (
    <div>
      <Header title="History" subtitle="Training Log" />
      <div className="px-4 py-4 space-y-4 pb-20">

        {/* E1RM Chart */}
        {chartData.length > 0 && (
          <Card title="E1RM Trends">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="Squat" stroke={LIFT_COLORS.squat} strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Bench" stroke={LIFT_COLORS.bench} strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Deadlift" stroke={LIFT_COLORS.deadlift} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Completed Workouts — expandable with all lifts */}
        <Card title="Completed Workouts">
          {completedSessions && completedSessions.length > 0 ? (
            <div className="space-y-1">
              {completedSessions.map((session) => {
                const sets = sessionSets?.[session.id] ?? [];
                const bestPerExercise = getBestSetPerExercise(sets);
                const dayConfig = DAY_CONFIG.find((d) => d.dayNumber === session.dayNumber);
                const isExpanded = expandedSession === session.id;
                const blockLabel = BLOCK_LABELS[session.blockType] ?? session.blockType;
                const phaseLabel = PHASE_LABELS[session.phase] ?? session.phase;

                return (
                  <div key={session.id} className="border-b border-slate-800/50 last:border-0">
                    {/* Session header — tappable to expand */}
                    <button
                      onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                      className="w-full flex items-center justify-between py-3 text-left active:bg-slate-800/30 rounded-lg px-1"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-200">
                          {dayConfig?.shortLabel ?? `Day ${session.dayNumber}`}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </div>
                        <div className="text-[10px] text-slate-600 mt-0.5">
                          {blockLabel} · W{session.weekNumber} · {phaseLabel}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-xs text-slate-500">
                            {bestPerExercise.length} lift{bestPerExercise.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <span className="text-slate-600 text-sm">
                          {isExpanded ? '▾' : '›'}
                        </span>
                      </div>
                    </button>

                    {/* Expanded: all lifts with best set */}
                    {isExpanded && bestPerExercise.length > 0 && (
                      <div className="pb-3 pl-2 pr-1 space-y-1.5">
                        {bestPerExercise.map(({ exerciseName, setType, best }) => (
                          <div
                            key={exerciseName}
                            className="flex items-center justify-between py-1.5 px-2 rounded bg-slate-800/40"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-slate-300 truncate">
                                {exerciseName}
                              </div>
                              <div className={`text-[10px] font-semibold uppercase ${SET_TYPE_COLORS[setType] ?? 'text-slate-500'}`}>
                                {setType}
                              </div>
                            </div>
                            <div className="text-right ml-3 flex-shrink-0">
                              <div className="text-sm tabular-nums font-semibold text-slate-200">
                                {best.actualWeight} × {best.actualReps} @{best.actualRPE}
                              </div>
                              {best.e1rm && (
                                <div className="text-[10px] tabular-nums text-slate-500">
                                  E1RM: {best.e1rm}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isExpanded && bestPerExercise.length === 0 && (
                      <div className="pb-3 pl-2">
                        <span className="text-xs text-slate-600">No completed sets recorded</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-600">
              <p className="text-sm">Complete workouts to see your history here</p>
            </div>
          )}
        </Card>

        {/* Weekly progression table */}
        {chartData.length > 0 && (
          <Card title="Weekly Progression">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="py-2 text-left">Wk</th>
                    <th className="py-2 text-right">SQ E1RM</th>
                    <th className="py-2 text-right">BP E1RM</th>
                    <th className="py-2 text-right">DL E1RM</th>
                    <th className="py-2 text-right font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(progression ?? []).map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-800/50">
                      <td className="py-2 text-slate-400">{entry.weekNumber}</td>
                      <td className="py-2 text-right tabular-nums text-slate-300">{entry.squatE1RM ?? '—'}</td>
                      <td className="py-2 text-right tabular-nums text-slate-300">{entry.benchE1RM ?? '—'}</td>
                      <td className="py-2 text-right tabular-nums text-slate-300">{entry.deadliftE1RM ?? '—'}</td>
                      <td className="py-2 text-right tabular-nums font-semibold text-slate-200">
                        {entry.totalE1RM ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {!chartData.length && (!completedSessions || completedSessions.length === 0) && (
          <div className="text-center py-16 text-slate-600">
            <p className="text-lg mb-2">No history yet</p>
            <p className="text-sm">Complete workouts to see your trends here</p>
          </div>
        )}
      </div>
    </div>
  );
}
