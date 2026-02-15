import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { ExerciseCategory } from '@/db/types';

interface ExercisePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exerciseId: string, exerciseName: string) => void;
  /** If provided, filter to this category. If null, show all exercises. */
  category: ExerciseCategory | null;
}

export function ExercisePicker({ isOpen, onClose, onSelect, category }: ExercisePickerProps) {
  const [search, setSearch] = useState('');

  const exercises = useLiveQuery(
    async () => {
      if (!isOpen) return [];
      if (category) {
        return db.exercises.where('category').equals(category).toArray();
      }
      return db.exercises.orderBy('name').toArray();
    },
    [isOpen, category],
  );

  if (!isOpen) return null;

  const filtered = (exercises ?? []).filter(
    (e) => !search || e.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95" onClick={onClose}>
      <div
        className="flex-1 flex flex-col max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-300">
              {category ? 'Select Exercise' : 'All Exercises'}
            </span>
            <button onClick={onClose} className="text-slate-500 text-sm px-2 py-1">
              Cancel
            </button>
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600"
          />
        </div>

        {/* Exercise list */}
        <div className="flex-1 overflow-y-auto px-4 py-2 safe-bottom">
          {filtered.length === 0 && (
            <div className="text-center py-8 text-slate-600 text-sm">No exercises found</div>
          )}
          {filtered.map((exercise) => (
            <button
              key={exercise.id}
              onClick={() => {
                onSelect(exercise.id, exercise.name);
                onClose();
                setSearch('');
              }}
              className="w-full text-left px-3 py-3 border-b border-slate-800/50 active:bg-slate-800 transition-colors"
            >
              <div className="text-sm text-slate-200">{exercise.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
