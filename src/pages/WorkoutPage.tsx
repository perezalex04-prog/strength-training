import { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { Header } from '@/components/layout/Header';
import { SetGroup } from '@/components/workout/SetGroup';
import { ProgramPreview } from '@/components/workout/ProgramPreview';
import { RestTimer } from '@/components/workout/RestTimer';
import { useSettings } from '@/hooks/useSettings';
import { useActiveWorkout, type OneRMUpdate } from '@/hooks/useActiveWorkout';
import { useRestTimer } from '@/hooks/useRestTimer';
import { BLOCK_LABELS, BLOCK_TYPES, BLOCK_MAX_WEEKS, getDayConfigForBlock } from '@/db/types';
import type { SetType, DayNumber, WorkoutSet, BlockType, ExerciseCategory } from '@/db/types';

function usePersistedState<T>(key: string, defaultValue: T, parse: (v: string) => T, serialize: (v: T) => string = String as any, storage: Storage = sessionStorage): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = storage.getItem(key);
      return stored !== null ? parse(stored) : defaultValue;
    } catch { return defaultValue; }
  });
  const set = useCallback((v: T) => {
    setValue(v);
    try { storage.setItem(key, serialize(v)); } catch {}
  }, [key, serialize, storage]);
  return [value, set];
}

const SET_TYPE_ORDER: SetType[] = ['top', 'backoff', 'volume', 'secondary', 'accessory', 'optional'];

/** Conjugate lower days allow swapping between squat and deadlift variations */
const CONJ_LOWER_CATEGORIES: ExerciseCategory[] = [
  'squat-primary', 'squat-secondary', 'deadlift-primary', 'deadlift-secondary',
];
const SET_TYPE_LABELS: Record<SetType, string> = {
  top: 'Top Sets',
  backoff: 'Back-off Sets',
  volume: 'Volume Sets',
  secondary: 'Secondary',
  accessory: 'Accessories',
  optional: 'Optional',
};

/**
 * Group sets by setType AND exerciseName so each exercise block is its own group.
 */
function groupSets(sets: WorkoutSet[]) {
  const groups: { key: string; label: string; sets: WorkoutSet[] }[] = [];

  for (const type of SET_TYPE_ORDER) {
    const ofType = sets.filter((s) => s.setType === type);
    if (ofType.length === 0) continue;

    // For top/backoff/volume: single group
    if (type === 'top' || type === 'backoff' || type === 'volume') {
      groups.push({ key: type, label: SET_TYPE_LABELS[type], sets: ofType });
    } else {
      // For secondary/accessory/optional: group by exerciseName
      const byExercise = new Map<string, WorkoutSet[]>();
      for (const s of ofType) {
        const name = s.exerciseName;
        if (!byExercise.has(name)) byExercise.set(name, []);
        byExercise.get(name)!.push(s);
      }
      let idx = 0;
      for (const [_name, exSets] of byExercise) {
        groups.push({
          key: `${type}-${idx++}`,
          label: SET_TYPE_LABELS[type],
          sets: exSets,
        });
      }
    }
  }

  return groups;
}

export function WorkoutPage() {
  const { settings, updateSettings } = useSettings();
  const [selectedDate, setSelectedDate] = usePersistedState(
    'workoutDate',
    new Date().toISOString().split('T')[0],
    (v) => v,
    (v) => v,
  );
  const workout = useActiveWorkout(settings, selectedDate);
  const timer = useRestTimer(settings?.restTimerDefault ?? 180);
  const [activeDay, setActiveDay] = usePersistedState<DayNumber>(
    'activeDay',
    1,
    (v) => Number(v) as DayNumber,
    (v) => String(v),
    localStorage,
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [rmUpdates, setRmUpdates] = useState<OneRMUpdate[]>([]);
  const dateRef = useRef<HTMLInputElement>(null);
  const initRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!settings) return;
    // Guard: only call getOrCreateSession once per day per mount
    if (initRef.current.has(activeDay)) return;
    initRef.current.add(activeDay);
    // getOrCreateSession checks IndexedDB directly, then recalculateGoalWeights
    // auto-updates top set goals based on previous week's actual performance
    (async () => {
      const session = await workout.getOrCreateSession(activeDay, selectedDate);
      await workout.recalculateGoalWeights(session.id);
    })();
  }, [settings, activeDay]);

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-slate-500">Loading...</span>
      </div>
    );
  }

  const sets = workout.getSetsForDay(activeDay);
  const session = workout.sessions.find((s) => s.dayNumber === activeDay);
  const groups = groupSets(sets);

  // For progress, only count sets that have an assigned exercise
  const assignedSets = sets.filter((s) => s.exerciseId !== '');
  const completedSets = assignedSets.filter(
    (s) => s.actualWeight != null && s.actualReps != null && s.actualRPE != null,
  ).length;

  // Show Complete button once at least one primary set is filled in
  // (don't require every accessory to be filled)
  const hasAnyCompletedSet = assignedSets.some(
    (s) => s.actualWeight != null && s.actualReps != null && s.actualRPE != null,
  );

  return (
    <div>
      <Header title="Workout" />

      {/* Program & Week selectors */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 border-b border-slate-800">
        <select
          value={settings.currentBlockType}
          onChange={(e) => {
            const newBlock = e.target.value as BlockType;
            const maxWeek = BLOCK_MAX_WEEKS[newBlock];
            const updates: { currentBlockType: BlockType; currentWeek?: number } = { currentBlockType: newBlock };
            if (settings.currentWeek > maxWeek) updates.currentWeek = 1;
            // Clamp activeDay if new block has fewer days
            const newDays = getDayConfigForBlock(newBlock);
            if (activeDay > newDays.length) setActiveDay(1);
            initRef.current.clear();
            updateSettings(updates);
          }}
          className="flex-1 bg-slate-800 text-slate-200 text-sm font-medium px-3 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-amber-500/50"
        >
          {BLOCK_TYPES.map((bt) => (
            <option key={bt} value={bt}>{BLOCK_LABELS[bt]}</option>
          ))}
        </select>

        <select
          value={settings.currentWeek}
          onChange={(e) => {
            initRef.current.clear();
            updateSettings({ currentWeek: Number(e.target.value) });
          }}
          className="bg-slate-800 text-slate-200 text-sm font-medium px-3 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-amber-500/50"
        >
          {Array.from({ length: BLOCK_MAX_WEEKS[settings.currentBlockType] }, (_, i) => (
            <option key={i + 1} value={i + 1}>Wk {i + 1}</option>
          ))}
        </select>

        <span className="text-xs text-slate-500 font-medium">{session?.phase ?? '...'}</span>
        <button
          onClick={() => setPreviewOpen(true)}
          className="text-slate-500 text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded bg-slate-800 active:bg-slate-700 border border-slate-700"
          title="Preview program"
        >
          VIEW
        </button>
      </div>

      {/* Date picker */}
      <div className="flex items-center justify-center gap-2 py-2 bg-slate-950 border-b border-slate-800">
        <button
          onClick={() => dateRef.current?.showPicker?.()}
          className="text-sm text-amber-400 font-medium px-3 py-1 rounded bg-slate-800 active:bg-slate-700"
        >
          {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
          })}
        </button>
        <input
          ref={dateRef}
          type="date"
          value={selectedDate}
          onChange={(e) => {
            if (e.target.value) {
              setSelectedDate(e.target.value);
            }
          }}
          className="absolute opacity-0 w-0 h-0"
        />
        {selectedDate !== new Date().toISOString().split('T')[0] && (
          <button
            onClick={() => {
              setSelectedDate(new Date().toISOString().split('T')[0]);
            }}
            className="text-xs text-slate-500 px-2 py-1"
          >
            Today
          </button>
        )}
      </div>

      {/* Day tabs — block-aware day count */}
      <div className="flex border-b border-slate-800 bg-slate-950 sticky top-[57px] z-30 overflow-x-auto">
        {getDayConfigForBlock(settings.currentBlockType).map((day) => (
          <button
            key={day.dayNumber}
            onClick={() => setActiveDay(day.dayNumber)}
            className={clsx(
              'flex-shrink-0 px-3 py-3 text-xs font-semibold transition-colors whitespace-nowrap',
              activeDay === day.dayNumber
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-500',
            )}
          >
            {day.shortLabel}
          </button>
        ))}
      </div>

      {/* Progress indicator + tonnage */}
      {assignedSets.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>{completedSets} / {assignedSets.length} sets</span>
            <span>{Math.round((completedSets / assignedSets.length) * 100)}%</span>
          </div>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${(completedSets / assignedSets.length) * 100}%` }}
            />
          </div>
          {(() => {
            const totalTonnage = sets.reduce((sum, s) => sum + (s.tonnage ?? 0), 0);
            return totalTonnage > 0 ? (
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-slate-600">Total Tonnage</span>
                <span className="text-xs font-semibold text-slate-400 tabular-nums">
                  {totalTonnage.toLocaleString()} lbs
                </span>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Sets */}
      <div className="px-4 py-3 space-y-4 pb-24">
        {groups.map((group) => {
          // Conjugate lower days: expand picker to show both squat + deadlift for primary groups
          const isPrimaryGroup = group.key === 'top' || group.key === 'backoff' || group.key === 'volume';
          const isConjLower = settings.currentBlockType === 'conj-4' && (activeDay === 2 || activeDay === 4);
          const overrideCategories = isPrimaryGroup && isConjLower ? CONJ_LOWER_CATEGORIES : undefined;

          return (
            <SetGroup
              key={group.key}
              label={group.label}
              sets={group.sets}
              onUpdate={workout.updateSet}
              onSwapExercise={workout.swapExercise}
              onUpdateNotes={workout.updateNotes}
              prevWeekBest={group.key === 'top' ? workout.prevWeekBests[activeDay] : undefined}
              filterCategories={overrideCategories}
            />
          );
        })}

        {sets.length === 0 && (
          <div className="text-center py-12 text-slate-600">
            <p className="text-lg mb-2">No sets yet</p>
            <p className="text-sm">Generating workout...</p>
          </div>
        )}

        {session && !session.completed && hasAnyCompletedSet && (
          <button
            onClick={async () => {
              const updates = await workout.completeSession(session.id);
              if (updates.length > 0) setRmUpdates(updates);
            }}
            className="w-full py-4 bg-amber-600 text-white font-bold rounded-lg text-lg uppercase tracking-wide active:bg-amber-700"
          >
            Complete Workout{completedSets < assignedSets.length ? ` (${completedSets}/${assignedSets.length})` : ''}
          </button>
        )}

        {session?.completed && (
          <div className="text-center py-4 space-y-2">
            <span className="text-amber-400 font-bold text-lg uppercase tracking-wide block">Workout Complete</span>
            {rmUpdates.length > 0 && (
              <div className="space-y-1">
                {rmUpdates.map((u) => (
                  <div key={u.lift} className="text-sm text-amber-300 font-semibold">
                    {u.lift.toUpperCase()} 1RM: {u.old} → {u.new} lbs
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ProgramPreview
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        currentBlockType={settings.currentBlockType}
        currentWeek={settings.currentWeek}
        onSwitchProgram={(blockType) => {
          const maxWeek = BLOCK_MAX_WEEKS[blockType];
          const updates: { currentBlockType: BlockType; currentWeek?: number } = { currentBlockType: blockType };
          if (settings.currentWeek > maxWeek) updates.currentWeek = 1;
          const newDays = getDayConfigForBlock(blockType);
          if (activeDay > newDays.length) setActiveDay(1);
          initRef.current.clear();
          updateSettings(updates);
        }}
      />

      <RestTimer
        isRunning={timer.isRunning}
        formattedTime={timer.formattedTime}
        secondsLeft={timer.secondsLeft}
        onStart={timer.start}
        onStop={timer.stop}
        defaultSeconds={settings.restTimerDefault}
      />
    </div>
  );
}
