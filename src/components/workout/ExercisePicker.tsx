import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { ExerciseCategory } from '@/db/types';

interface ExercisePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exerciseId: string, exerciseName: string) => void;
  /** If provided, filter to this category's muscle group. If null, show all exercises. */
  category: ExerciseCategory | null;
  /** If provided, overrides category filtering with explicit list of categories. */
  filterCategories?: ExerciseCategory[];
}

const MUSCLE_GROUPS: { label: string; categories: ExerciseCategory[] }[] = [
  { label: 'SQUAT', categories: ['squat-primary', 'squat-secondary'] },
  { label: 'BENCH & CHEST', categories: ['bench-primary', 'bench-secondary', 'chest-accessory'] },
  { label: 'DEADLIFT', categories: ['deadlift-primary', 'deadlift-secondary'] },
  { label: 'BACK', categories: ['horizontal-row', 'vertical-pull'] },
  { label: 'LEGS', categories: ['quad-accessory', 'posterior-chain'] },
  { label: 'SHOULDERS', categories: ['shoulders-press', 'shoulders-isolation'] },
  { label: 'ARMS', categories: ['triceps', 'biceps'] },
  { label: 'CORE', categories: ['core'] },
  { label: 'OTHER', categories: ['calves-misc', 'explosive'] },
];

const CATEGORY_LABELS: { cat: ExerciseCategory; label: string }[] = [
  { cat: 'squat-primary', label: 'Squat' },
  { cat: 'squat-secondary', label: 'Squat Variation' },
  { cat: 'bench-primary', label: 'Bench' },
  { cat: 'bench-secondary', label: 'Bench Variation' },
  { cat: 'chest-accessory', label: 'Chest' },
  { cat: 'deadlift-primary', label: 'Deadlift' },
  { cat: 'deadlift-secondary', label: 'Deadlift Variation' },
  { cat: 'horizontal-row', label: 'Row' },
  { cat: 'vertical-pull', label: 'Pull-up/Lat' },
  { cat: 'quad-accessory', label: 'Quads' },
  { cat: 'posterior-chain', label: 'Hamstrings/Glutes' },
  { cat: 'shoulders-press', label: 'Shoulder Press' },
  { cat: 'shoulders-isolation', label: 'Shoulder Isolation' },
  { cat: 'triceps', label: 'Triceps' },
  { cat: 'biceps', label: 'Biceps' },
  { cat: 'core', label: 'Core' },
  { cat: 'calves-misc', label: 'Calves/Other' },
  { cat: 'explosive', label: 'Explosive' },
];

function getGroupCategories(cat: ExerciseCategory): ExerciseCategory[] {
  const group = MUSCLE_GROUPS.find((g) => g.categories.includes(cat));
  return group ? group.categories : [cat];
}

export function ExercisePicker({ isOpen, onClose, onSelect, category, filterCategories }: ExercisePickerProps) {
  const [search, setSearch] = useState('');
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track visual viewport height for iOS keyboard handling
  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      setViewportHeight(vv.height);
    };
    handleResize();
    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, [isOpen]);

  const targetCategories = filterCategories ?? (category ? getGroupCategories(category) : null);

  const exercises = useLiveQuery(
    async () => {
      if (!isOpen) return [];
      if (targetCategories) {
        return db.exercises.where('category').anyOf(targetCategories).toArray();
      }
      return db.exercises.orderBy('name').toArray();
    },
    [isOpen, category, filterCategories],
  );

  if (!isOpen) return null;

  const filtered = (exercises ?? []).filter(
    (e) => !search || e.name.toLowerCase().includes(search.toLowerCase()),
  );

  // Group filtered exercises by muscle group
  const grouped = MUSCLE_GROUPS.map((group) => ({
    label: group.label,
    exercises: filtered.filter((e) => group.categories.includes(e.category)),
  })).filter((g) => g.exercises.length > 0);

  const handleClose = () => {
    onClose();
    setSearch('');
    setShowCreateCategory(false);
  };

  const handleCreate = async (cat: ExerciseCategory) => {
    const name = search.trim();
    if (!name) return;
    const id = `custom-${Date.now()}`;
    await db.exercises.add({ id, name, category: cat });
    onSelect(id, name);
    handleClose();
  };

  // Determine available categories for new exercise creation
  const createCategories = targetCategories
    ? CATEGORY_LABELS.filter((c) => targetCategories.includes(c.cat))
    : CATEGORY_LABELS;

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 top-0 z-[60] flex flex-col bg-slate-950"
      style={{
        height: viewportHeight ? `${viewportHeight}px` : '100dvh',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            {category ? 'Swap Exercise' : 'All Exercises'}
          </span>
          <button
            onClick={handleClose}
            className="text-amber-400 text-sm font-bold px-3 py-1 uppercase tracking-wider"
          >
            Close
          </button>
        </div>
        <input
          type="text"
          placeholder="Search or type new exercise name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowCreateCategory(false); }}
          className="w-full bg-slate-800 border border-slate-700 rounded px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* Exercise list or category picker */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4 overscroll-contain">
        {showCreateCategory ? (
          /* Full-screen category picker */
          <div className="py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">
                Category for "{search.trim()}"
              </span>
              <button
                onClick={() => setShowCreateCategory(false)}
                className="text-xs text-slate-500 active:text-slate-300"
              >
                Back
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {createCategories.map((c) => (
                <button
                  key={c.cat}
                  onClick={() => handleCreate(c.cat)}
                  className="px-3 py-3 rounded-lg bg-slate-800 text-sm text-slate-200 active:bg-amber-500/20 active:text-amber-400 text-left"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Add new exercise button */}
            {search.trim().length > 1 && (
              <div className="pt-3 pb-1">
                <button
                  onClick={() => setShowCreateCategory(true)}
                  className="w-full text-left px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 active:bg-amber-500/20"
                >
                  <span className="text-sm text-amber-400">+ Add "{search.trim()}"</span>
                </button>
              </div>
            )}

            {filtered.length === 0 && !search.trim() && (
              <div className="text-center py-8 text-slate-600 text-sm">No exercises found</div>
            )}
            {grouped.map((group) => (
              <div key={group.label}>
                <div className="sticky top-0 bg-slate-950 pt-3 pb-1 z-10">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>
                {group.exercises.map((exercise) => (
                  <button
                    key={exercise.id}
                    onClick={() => {
                      onSelect(exercise.id, exercise.name);
                      handleClose();
                    }}
                    className="w-full text-left px-3 py-2.5 border-b border-slate-800/50 active:bg-slate-800 transition-colors"
                  >
                    <div className="text-sm text-slate-200">{exercise.name}</div>
                  </button>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
