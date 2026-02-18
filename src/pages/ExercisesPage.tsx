import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { clsx } from 'clsx';
import { db } from '@/db/database';
import { Header } from '@/components/layout/Header';
import type { ExerciseCategory } from '@/db/types';

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  'squat-primary': 'Squat Primary',
  'squat-secondary': 'Squat Secondary',
  'bench-primary': 'Bench Primary',
  'bench-secondary': 'Bench Secondary',
  'deadlift-primary': 'Deadlift Primary',
  'deadlift-secondary': 'Deadlift Secondary',
  'horizontal-row': 'Horizontal Row',
  'vertical-pull': 'Vertical Pull',
  'quad-accessory': 'Quad Accessories',
  'posterior-chain': 'Posterior Chain',
  'triceps': 'Triceps',
  'biceps': 'Biceps',
  'core': 'Core',
  'shoulders-press': 'Shoulders — Press',
  'shoulders-isolation': 'Shoulders — Isolation',
  'chest-accessory': 'Chest Accessories',
  'calves-misc': 'Calves / Misc',
  'explosive': 'Explosive',
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as ExerciseCategory[];

export function ExercisesPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<ExerciseCategory>('squat-primary');

  const exercises = useLiveQuery(
    async () => {
      if (selectedCategory) {
        return db.exercises.where('category').equals(selectedCategory).toArray();
      }
      return db.exercises.orderBy('name').toArray();
    },
    [selectedCategory],
  );

  const exercisePRs = useLiveQuery(() => db.exercisePRs.toArray());

  const filtered = (exercises ?? []).filter(
    (e) => !search || e.name.toLowerCase().includes(search.toLowerCase()),
  );

  const prMap = new Map((exercisePRs ?? []).map((pr) => [pr.exerciseId, pr]));

  const handleAddExercise = async () => {
    if (!newName.trim()) return;
    // Check for duplicate
    const existing = await db.exercises.where('name').equals(newName.trim()).first();
    if (existing) {
      alert('An exercise with this name already exists.');
      return;
    }
    await db.exercises.add({
      id: crypto.randomUUID(),
      name: newName.trim(),
      category: newCategory,
    });
    setNewName('');
    setShowAddModal(false);
  };

  return (
    <div>
      <Header title="Exercises" subtitle={`${filtered.length} exercises`} />
      <div className="px-4 py-3 space-y-3 pb-24">
        {/* Search */}
        <input
          type="text"
          placeholder="Search exercises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600"
        />

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap',
              !selectedCategory ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400',
            )}
          >
            All
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap',
                selectedCategory === cat ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400',
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <div className="space-y-1.5">
          {filtered.map((exercise) => {
            const pr = prMap.get(exercise.id);
            return (
              <div
                key={exercise.id}
                className="flex items-center justify-between px-3 py-2.5 bg-slate-800/50 rounded-lg"
              >
                <div>
                  <div className="text-sm text-slate-200">{exercise.name}</div>
                  <div className="text-xs text-slate-600">{CATEGORY_LABELS[exercise.category]}</div>
                </div>
                {pr && (
                  <div className="text-right">
                    <div className="text-xs text-slate-400 tabular-nums">
                      Best: {pr.bestWeight} × {pr.bestReps}
                    </div>
                    <div className="text-xs text-amber-400 tabular-nums">
                      E1RM: {pr.bestE1RM}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Exercise FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-lg text-2xl active:bg-amber-700"
      >
        +
      </button>

      {/* Add Exercise Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setShowAddModal(false)}>
          <div
            className="w-full bg-slate-900 border-t border-slate-700 rounded-t-xl safe-bottom p-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-200">Add Exercise</h3>

            <div>
              <label className="text-xs text-slate-500 block mb-1">Exercise Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Seated Cable Row"
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ExerciseCategory)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200"
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-lg bg-slate-800 text-slate-400 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddExercise}
                disabled={!newName.trim()}
                className={clsx(
                  'flex-1 py-3 rounded-lg text-sm font-semibold',
                  newName.trim()
                    ? 'bg-amber-600 text-white active:bg-amber-700'
                    : 'bg-slate-700 text-slate-500',
                )}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
