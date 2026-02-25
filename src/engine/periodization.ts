import { db } from '@/db/database';
import type {
  BlockType,
  DayNumber,
  PrimaryLift,
  WorkoutSet,
  ExerciseCategory,
} from '@/db/types';
import { calculateGoalWeight, roundTo5 } from './e1rm';
import { getLastWeight, calculateFatigueMultiplier, calculateVolumeAdjustment } from './autoregulation';

interface SlotDef {
  name: string;
  category: ExerciseCategory;
}

const DAY_EXERCISE_DEFAULTS: Record<DayNumber, { secondaries: SlotDef[]; accessories: SlotDef[] }> = {
  1: {
    secondaries: [
      { name: 'Incline Bench', category: 'bench-secondary' },
      { name: 'Barbell Row', category: 'horizontal-row' },
    ],
    accessories: [
      { name: 'Tricep Pushdown (rope)', category: 'triceps' },
      { name: 'Face Pull', category: 'shoulders-isolation' },
      { name: 'Spider Curl', category: 'biceps' },
    ],
  },
  2: {
    secondaries: [
      { name: 'Deficit Deadlift (1")', category: 'deadlift-secondary' },
    ],
    accessories: [
      { name: 'Leg Press', category: 'quad-accessory' },
      { name: 'Nordic Curl', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
    ],
  },
  3: {
    secondaries: [
      { name: 'Overhead Press', category: 'shoulders-press' },
      { name: 'Weighted Pull-up', category: 'vertical-pull' },
    ],
    accessories: [
      { name: 'Cable Row', category: 'horizontal-row' },
      { name: 'Lateral Raise', category: 'shoulders-isolation' },
      { name: 'DB Curl', category: 'biceps' },
    ],
  },
  4: {
    secondaries: [
      { name: 'Banded Box Squat', category: 'squat-secondary' },
    ],
    accessories: [
      { name: 'Reverse Hyper', category: 'posterior-chain' },
      { name: 'Leg Press', category: 'quad-accessory' },
      { name: 'GHR', category: 'posterior-chain' },
    ],
  },
  5: {
    secondaries: [
      { name: 'DB Shoulder Press', category: 'shoulders-press' },
    ],
    accessories: [
      { name: 'Overhead Tricep Ext (cable)', category: 'triceps' },
      { name: 'Cable Fly (low)', category: 'chest-accessory' },
      { name: 'Cable Curl', category: 'biceps' },
    ],
  },
};

const PRIMARY_EXERCISES: Record<DayNumber, { name: string; category: ExerciseCategory }> = {
  1: { name: 'Competition Bench', category: 'bench-primary' },
  2: { name: 'Competition Back Squat', category: 'squat-primary' },
  3: { name: 'Competition Bench', category: 'bench-primary' },
  4: { name: 'Competition Deadlift', category: 'deadlift-primary' },
  5: { name: 'Banded Bench', category: 'bench-primary' },
};

// Westside Conjugate 4-day exercise maps
const CONJ_PRIMARY_EXERCISES: Partial<Record<DayNumber, { name: string; category: ExerciseCategory }>> = {
  1: { name: 'Competition Bench', category: 'bench-primary' },       // ME Upper
  2: { name: 'Competition Back Squat', category: 'squat-primary' },  // ME Lower
  3: { name: 'Banded Bench', category: 'bench-primary' },            // DE Upper
  4: { name: 'Banded Box Squat', category: 'squat-secondary' },      // DE Lower
};

const CONJ_DAY_EXERCISE_DEFAULTS: Partial<Record<DayNumber, { secondaries: SlotDef[]; accessories: SlotDef[] }>> = {
  1: { // ME Upper
    secondaries: [
      { name: 'Incline Bench', category: 'bench-secondary' },
      { name: 'Barbell Row', category: 'horizontal-row' },
    ],
    accessories: [
      { name: 'Tricep Pushdown (rope)', category: 'triceps' },
      { name: 'Face Pull', category: 'shoulders-isolation' },
      { name: 'Spider Curl', category: 'biceps' },
    ],
  },
  2: { // ME Lower
    secondaries: [
      { name: 'Deficit Deadlift (1")', category: 'deadlift-secondary' },
    ],
    accessories: [
      { name: 'Reverse Hyper', category: 'posterior-chain' },
      { name: 'Leg Press', category: 'quad-accessory' },
      { name: 'GHR', category: 'posterior-chain' },
    ],
  },
  3: { // DE Upper
    secondaries: [
      { name: 'Overhead Press', category: 'shoulders-press' },
      { name: 'Weighted Pull-up', category: 'vertical-pull' },
    ],
    accessories: [
      { name: 'Overhead Tricep Ext (cable)', category: 'triceps' },
      { name: 'Cable Fly (low)', category: 'chest-accessory' },
      { name: 'Cable Curl', category: 'biceps' },
    ],
  },
  4: { // DE Lower
    secondaries: [
      { name: 'Speed Deadlift', category: 'explosive' },
    ],
    accessories: [
      { name: 'Leg Press', category: 'quad-accessory' },
      { name: 'Nordic Curl', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
    ],
  },
};

async function findExercise(name: string, category: ExerciseCategory) {
  const found = await db.exercises.where('name').equals(name).first();
  if (found) return { id: found.id, name: found.name };
  const fallback = await db.exercises.where('category').equals(category).first();
  if (fallback) return { id: fallback.id, name: fallback.name };
  return { id: '', name };
}

export async function generateWorkoutSets(
  blockType: BlockType,
  weekNumber: number,
  dayNumber: DayNumber,
  _primaryLift: PrimaryLift,
  isVolume: boolean,
  oneRM: number,
  trainingMaxPercent: number,
): Promise<Omit<WorkoutSet, 'id' | 'sessionId'>[]> {
  const template = await db.templates.where({ blockType, weekNumber }).first();
  if (!template) return [];

  const trainingMax = Math.round(oneRM * trainingMaxPercent);
  const sets: Omit<WorkoutSet, 'id' | 'sessionId'>[] = [];
  let setNum = 0;

  const primaryDef = (blockType === 'conj-4' ? CONJ_PRIMARY_EXERCISES[dayNumber] : null) ?? PRIMARY_EXERCISES[dayNumber];
  const primary = await findExercise(primaryDef.name, primaryDef.category);
  const dayDefaults = (blockType === 'conj-4' ? CONJ_DAY_EXERCISE_DEFAULTS[dayNumber] : null) ?? DAY_EXERCISE_DEFAULTS[dayNumber];

  // === AUTOREGULATION: Fatigue multiplier from completed sessions this week ===
  const fatigueMult = await calculateFatigueMultiplier(blockType, weekNumber);

  // === AUTOREGULATION: Volume adjustment from previous week's RPE performance ===
  const volumeAdj = await calculateVolumeAdjustment(blockType, weekNumber);

  // === PRIMARY LIFT ===
  if (isVolume) {
    // Top sets for volume days (DE speed work on conjugate, gauge set on DUP)
    if (template.volumeTopSets) {
      const vTopReps = template.volumeTopReps ?? template.topReps;
      const vTopRPE = template.volumeTopRPE ?? template.topRPE;
      const vTopWeight = roundTo5(calculateGoalWeight(trainingMax, vTopReps, vTopRPE) * fatigueMult);
      for (let i = 0; i < template.volumeTopSets; i++) {
        sets.push(makeSet({
          exerciseId: primary.id, exerciseName: primary.name, setType: 'top',
          setNumber: ++setNum, goalWeight: vTopWeight,
          goalReps: vTopReps, goalRPE: vTopRPE, category: primaryDef.category,
        }));
      }
    }

    // Volume/supplemental sets
    const volReps = template.volumeBackoffReps ?? template.backoffReps;
    const volRPE = template.volumeBackoffRPE ?? template.backoffRPE;
    const volSets = template.volumeBackoffSets ?? 4;
    const volWeight = roundTo5(calculateGoalWeight(trainingMax, volReps, volRPE) * fatigueMult);
    for (let i = 0; i < volSets; i++) {
      sets.push(makeSet({
        exerciseId: primary.id, exerciseName: primary.name, setType: 'volume',
        setNumber: ++setNum, goalWeight: volWeight,
        goalReps: volReps, goalRPE: volRPE, category: primaryDef.category,
      }));
    }
  } else {
    const topGoalWeight = roundTo5(calculateGoalWeight(trainingMax, template.topReps, template.topRPE) * fatigueMult);
    for (let i = 0; i < template.topSets; i++) {
      sets.push(makeSet({
        exerciseId: primary.id, exerciseName: primary.name, setType: 'top',
        setNumber: ++setNum, goalWeight: topGoalWeight,
        goalReps: template.topReps, goalRPE: template.topRPE, category: primaryDef.category,
      }));
    }

    // Backoff: RPE-based calculation instead of flat 90%
    const backoffGoalWeight = roundTo5(calculateGoalWeight(trainingMax, template.backoffReps, template.backoffRPE) * fatigueMult);

    // Volume-adjusted backoff set count (clamped to at least 1)
    const adjustedBackoffSets = Math.max(1, template.backoffSets + volumeAdj);
    for (let i = 0; i < adjustedBackoffSets; i++) {
      sets.push(makeSet({
        exerciseId: primary.id, exerciseName: primary.name, setType: 'backoff',
        setNumber: ++setNum, goalWeight: backoffGoalWeight,
        goalReps: template.backoffReps, goalRPE: template.backoffRPE, category: primaryDef.category,
      }));
    }
  }

  // === SECONDARIES (auto-weight from PR history) ===
  for (const sec of dayDefaults.secondaries) {
    const exercise = await findExercise(sec.name, sec.category);
    const lastWeight = await getLastWeight(exercise.id);
    for (let i = 0; i < template.secondarySets; i++) {
      sets.push(makeSet({
        exerciseId: exercise.id, exerciseName: exercise.name, setType: 'secondary',
        setNumber: ++setNum, goalWeight: lastWeight,
        goalReps: template.secondaryReps, goalRPE: template.secondaryRPE, category: sec.category,
      }));
    }
  }

  // === ACCESSORIES (auto-weight from PR history) ===
  for (const acc of dayDefaults.accessories) {
    const exercise = await findExercise(acc.name, acc.category);
    const lastWeight = await getLastWeight(exercise.id);
    for (let i = 0; i < template.accessorySets; i++) {
      sets.push(makeSet({
        exerciseId: exercise.id, exerciseName: exercise.name, setType: 'accessory',
        setNumber: ++setNum, goalWeight: lastWeight,
        goalReps: template.accessoryReps, goalRPE: template.accessoryRPE, category: acc.category,
      }));
    }
  }

  // === 3 OPTIONAL SLOTS (each slot is an independent exercise) ===
  for (let slot = 0; slot < 3; slot++) {
    for (let i = 0; i < template.accessorySets; i++) {
      sets.push(makeSet({
        exerciseId: '', exerciseName: `(Optional ${slot + 1})`, setType: 'optional',
        setNumber: ++setNum, goalWeight: 0,
        goalReps: template.accessoryReps, goalRPE: template.accessoryRPE, category: null,
      }));
    }
  }

  return sets;
}

function makeSet(
  partial: Pick<WorkoutSet, 'exerciseId' | 'exerciseName' | 'setType' | 'setNumber' | 'goalWeight' | 'goalReps' | 'goalRPE'>
    & { category?: ExerciseCategory | null },
): Omit<WorkoutSet, 'id' | 'sessionId'> {
  return {
    ...partial,
    actualWeight: null,
    actualReps: null,
    actualRPE: null,
    e1rm: null,
    percentOfTM: null,
    tonnage: null,
    category: partial.category ?? null,
  };
}
