import { useState } from 'react';
import type { WorkoutSet, ExerciseCategory } from '@/db/types';
import { SetRow } from './SetRow';
import { ExercisePicker } from './ExercisePicker';

interface SetGroupProps {
  label: string;
  sets: WorkoutSet[];
  onUpdate: (setId: string, updates: { actualWeight?: number | null; actualReps?: number | null; actualRPE?: number | null }) => void;
  onSwapExercise?: (setIds: string[], exerciseId: string, exerciseName: string) => void;
}

export function SetGroup({ label, sets, onUpdate, onSwapExercise }: SetGroupProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (sets.length === 0) return null;

  const exerciseName = sets[0].exerciseName;
  const isMultiExercise = new Set(sets.map((s) => s.exerciseName)).size > 1;
  const isPlaceholder = sets[0].exerciseId === '' && sets[0].setType === 'optional';

  // Determine category for the picker
  const category: ExerciseCategory | null = sets[0].category ?? null;

  const handleSwap = (exerciseId: string, newName: string) => {
    if (onSwapExercise) {
      onSwapExercise(sets.map((s) => s.id), exerciseId, newName);
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
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {label}
          </h4>
          {!isMultiExercise && onSwapExercise && (
            <button
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1 text-xs text-blue-400 active:text-blue-300 px-1 py-0.5"
            >
              <span className="truncate max-w-[140px]">{exerciseName}</span>
              <span>⇄</span>
            </button>
          )}
          {!isMultiExercise && !onSwapExercise && (
            <span className="text-xs text-slate-400 truncate max-w-[160px]">{exerciseName}</span>
          )}
        </div>
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
      />
    </>
  );
}
