import { useState } from 'react';
import { clsx } from 'clsx';
import type { WorkoutSet, SetType } from '@/db/types';
import { useSettings } from '@/hooks/useSettings';
import { NumberPad } from './NumberPad';
import { RPESelector } from './RPESelector';

interface SetRowProps {
  set: WorkoutSet;
  onUpdate: (setId: string, updates: { actualWeight?: number | null; actualReps?: number | null; actualRPE?: number | null }) => void;
  showExerciseName?: boolean;
}

const setTypeColors: Record<SetType, string> = {
  top: 'border-l-red-500',
  backoff: 'border-l-orange-500',
  volume: 'border-l-cyan-500',
  secondary: 'border-l-amber-500',
  accessory: 'border-l-purple-500',
  optional: 'border-l-slate-600',
};

const setTypeLabels: Record<SetType, string> = {
  top: 'TOP',
  backoff: 'B/O',
  volume: 'VOL',
  secondary: 'SEC',
  accessory: 'ACC',
  optional: 'OPT',
};

export function SetRow({ set, onUpdate, showExerciseName = false }: SetRowProps) {
  const { settings } = useSettings();
  const [editField, setEditField] = useState<'weight' | 'reps' | 'rpe' | null>(null);

  const isComplete = set.actualWeight != null && set.actualReps != null && set.actualRPE != null;
  const isPlaceholder = set.exerciseId === '' && set.setType === 'optional';

  // Don't render input buttons for unassigned optional slots
  if (isPlaceholder) return null;

  return (
    <>
      <div
        className={clsx(
          'flex items-center gap-2 px-3 py-2.5 border-l-4 rounded-lg bg-slate-800/50',
          setTypeColors[set.setType],
          isComplete && 'opacity-80',
        )}
      >
        <span className="text-[10px] font-bold text-slate-500 w-7 text-center">
          {setTypeLabels[set.setType]}
        </span>

        <div className="flex-1 min-w-0">
          {showExerciseName && (
            <div className="text-xs text-slate-500 truncate mb-0.5">{set.exerciseName}</div>
          )}
          <div className="text-xs text-slate-500/80">
            {set.goalWeight > 0 && <>{set.goalWeight} × {set.goalReps} @{set.goalRPE}</>}
            {set.goalWeight === 0 && <>{set.goalReps} reps @{set.goalRPE}</>}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setEditField('weight')}
            className={clsx(
              'min-w-[52px] px-2 py-1.5 rounded text-center text-sm font-semibold',
              set.actualWeight ? 'bg-yellow-500/20 text-yellow-300' : 'bg-slate-700 text-slate-500',
            )}
          >
            {set.actualWeight ?? '—'}
          </button>
          <span className="text-slate-600 text-xs">×</span>
          <button
            onClick={() => setEditField('reps')}
            className={clsx(
              'min-w-[36px] px-2 py-1.5 rounded text-center text-sm font-semibold',
              set.actualReps ? 'bg-yellow-500/20 text-yellow-300' : 'bg-slate-700 text-slate-500',
            )}
          >
            {set.actualReps ?? '—'}
          </button>
          <span className="text-slate-600 text-xs">@</span>
          <button
            onClick={() => setEditField('rpe')}
            className={clsx(
              'min-w-[36px] px-2 py-1.5 rounded text-center text-sm font-semibold',
              set.actualRPE ? 'bg-yellow-500/20 text-yellow-300' : 'bg-slate-700 text-slate-500',
            )}
          >
            {set.actualRPE ?? '—'}
          </button>
        </div>

        <div className="w-12 text-right">
          {set.e1rm ? (
            <span className="text-xs font-semibold text-slate-300">{set.e1rm}</span>
          ) : (
            <span className="text-xs text-slate-600">—</span>
          )}
        </div>
      </div>

      <NumberPad
        isOpen={editField === 'weight'}
        onClose={() => setEditField(null)}
        onConfirm={(v) => onUpdate(set.id, { actualWeight: v })}
        initialValue={set.actualWeight ?? set.goalWeight}
        mode="weight"
        label={`${set.exerciseName} — Weight`}
        microPlates={!!settings?.microPlates}
      />
      <NumberPad
        isOpen={editField === 'reps'}
        onClose={() => setEditField(null)}
        onConfirm={(v) => onUpdate(set.id, { actualReps: v })}
        initialValue={set.actualReps ?? set.goalReps}
        mode="reps"
        label={`${set.exerciseName} — Reps`}
      />
      <RPESelector
        isOpen={editField === 'rpe'}
        onClose={() => setEditField(null)}
        onSelect={(v) => onUpdate(set.id, { actualRPE: v })}
        currentValue={set.actualRPE}
      />
    </>
  );
}
