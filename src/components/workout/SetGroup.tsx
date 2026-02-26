import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { WorkoutSet, ExerciseCategory } from '@/db/types';
import { db } from '@/db/database';
import { SetRow } from './SetRow';
import { ExercisePicker } from './ExercisePicker';

interface SetGroupProps {
  label: string;
  sets: WorkoutSet[];
  onUpdate: (setId: string, updates: { actualWeight?: number | null; actualReps?: number | null; actualRPE?: number | null }) => void;
  onSwapExercise?: (setIds: string[], exerciseId: string, exerciseName: string) => void;
  onUpdateNotes?: (setId: string, notes: string) => void;
  prevWeekBest?: { weight: number; reps: number; rpe: number; e1rm: number };
  /** Override categories for the exercise picker (e.g. conjugate lower shows squat + deadlift) */
  filterCategories?: ExerciseCategory[];
}

export function SetGroup({ label, sets, onUpdate, onSwapExercise, onUpdateNotes, prevWeekBest, filterCategories }: SetGroupProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  if (sets.length === 0) return null;

  const exerciseName = sets[0].exerciseName;
  const isMultiExercise = new Set(sets.map((s) => s.exerciseName)).size > 1;
  const isPlaceholder = sets[0].exerciseId === '' && sets[0].setType === 'optional' && sets[0].exerciseName.startsWith('(Optional');

  // Notes are stored on the first set of the group
  const notesSetId = sets[0].id;
  const currentNotes = sets[0].notes ?? '';

  // Determine category for the picker
  const category: ExerciseCategory | null = sets[0].category ?? null;

  // Fetch last performance for this exercise
  const exerciseId = sets[0].exerciseId;
  const pr = useLiveQuery(
    () => (exerciseId ? db.exercisePRs.get(exerciseId) : undefined),
    [exerciseId],
  );

  const handleSwap = (exerciseId: string, newName: string) => {
    if (onSwapExercise) {
      onSwapExercise(sets.map((s) => s.id), exerciseId, newName);
    }
  };

  const handleNotesBlur = () => {
    if (onUpdateNotes && notesRef.current) {
      const val = notesRef.current.value.trim();
      if (val !== currentNotes) {
        onUpdateNotes(notesSetId, val);
      }
    }
  };

  // Optional placeholder — show as a tappable "add" button
  if (isPlaceholder) {
    return (
      <>
        <button
          onClick={() => setPickerOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-3 border border-dashed border-slate-700 rounded-lg text-slate-500 active:bg-slate-800/50"
        >
          <span className="text-lg">+</span>
          <span className="text-sm">Add Exercise (Optional)</span>
        </button>
        <ExercisePicker
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handleSwap}
          category={null}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {label}
            </h4>
            {/* Notes toggle button */}
            <button
              onClick={() => setNotesOpen(!notesOpen)}
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                currentNotes
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-slate-800 text-slate-600'
              }`}
              title="Notes"
            >
              NOTE
            </button>
          </div>
          {!isMultiExercise && onSwapExercise && (
            <button
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1 text-xs text-amber-400 active:text-amber-300 px-1 py-0.5"
            >
              <span className="truncate max-w-[140px]">{exerciseName}</span>
              <span>⇄</span>
            </button>
          )}
          {!isMultiExercise && !onSwapExercise && (
            <span className="text-xs text-slate-400 truncate max-w-[160px]">{exerciseName}</span>
          )}
        </div>

        {/* Performance history: Last session + All-time best */}
        {pr && pr.lastWeight > 0 && (
          <div className="px-1 -mt-0.5 space-y-0.5">
            {/* Most recent session */}
            <div>
              <span className="text-[10px] text-slate-500">
                Last: {pr.lastWeight}×{pr.lastReps} @{pr.lastRPE}
              </span>
            </div>
            {/* All-time best (only show if different from last) */}
            {pr.bestE1RM > 0 && (pr.bestWeight !== pr.lastWeight || pr.bestReps !== pr.lastReps) && (
              <div>
                <span className="text-[10px] text-amber-500 font-semibold">
                  Best: {pr.bestWeight}×{pr.bestReps} @{pr.bestRPE}
                  <span className="text-slate-500 font-normal"> · e1RM {pr.bestE1RM}</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Previous week's top set (only on top sets group) */}
        {prevWeekBest && (
          <div className="px-1 -mt-0.5">
            <span className="text-[10px] text-amber-500 font-semibold">
              Last Wk: {prevWeekBest.weight}×{prevWeekBest.reps} @{prevWeekBest.rpe}
              {prevWeekBest.e1rm > 0 && <span className="text-slate-500 font-normal"> · e1RM {prevWeekBest.e1rm}</span>}
            </span>
          </div>
        )}

        {/* Collapsible notes area */}
        {notesOpen && (
          <textarea
            ref={notesRef}
            defaultValue={currentNotes}
            onBlur={handleNotesBlur}
            placeholder="Add notes (form cues, felt heavy, etc.)"
            rows={2}
            className="w-full px-3 py-2 text-xs bg-slate-800/60 border border-slate-700 rounded text-slate-300 placeholder:text-slate-600 resize-none focus:outline-none focus:border-amber-500/50"
          />
        )}

        {sets.map((set) => (
          <SetRow
            key={set.id}
            set={set}
            onUpdate={onUpdate}
            showExerciseName={isMultiExercise}
          />
        ))}
      </div>

      <ExercisePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSwap}
        category={category}
        filterCategories={filterCategories}
      />
    </>
  );
}
