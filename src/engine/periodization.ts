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

// === 5/3/1 (Wendler) constants ===
const WENDLER_SETS: Record<number, { percent: number; reps: number }[]> = {
  1: [{ percent: 0.65, reps: 5 }, { percent: 0.75, reps: 5 }, { percent: 0.85, reps: 5 }],   // 5s week
  2: [{ percent: 0.70, reps: 3 }, { percent: 0.80, reps: 3 }, { percent: 0.90, reps: 3 }],   // 3s week
  3: [{ percent: 0.75, reps: 5 }, { percent: 0.85, reps: 3 }, { percent: 0.95, reps: 1 }],   // 5/3/1 week
  4: [{ percent: 0.40, reps: 5 }, { percent: 0.50, reps: 5 }, { percent: 0.60, reps: 5 }],   // deload
};
const OHP_TM_MULTIPLIER = 0.65;
const BBB_PERCENT = 0.55;

// 5/3/1 4-day exercise maps
const WENDLER_PRIMARY_EXERCISES: Partial<Record<DayNumber, { name: string; category: ExerciseCategory }>> = {
  1: { name: 'Competition Back Squat', category: 'squat-primary' },
  2: { name: 'Competition Bench', category: 'bench-primary' },
  3: { name: 'Competition Deadlift', category: 'deadlift-primary' },
  4: { name: 'Overhead Press', category: 'shoulders-press' },
};

const WENDLER_DAY_EXERCISE_DEFAULTS: Partial<Record<DayNumber, { secondaries: SlotDef[]; accessories: SlotDef[] }>> = {
  1: { // Squat day — push/pull/legs assistance
    secondaries: [
      { name: 'Leg Press', category: 'quad-accessory' },
    ],
    accessories: [
      { name: 'Nordic Curl', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
      { name: 'DB Curl', category: 'biceps' },
    ],
  },
  2: { // Bench day — push/pull assistance
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
  3: { // Deadlift day — posterior chain assistance
    secondaries: [
      { name: 'Good Morning', category: 'posterior-chain' },
    ],
    accessories: [
      { name: 'GHR', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
      { name: 'Leg Press', category: 'quad-accessory' },
    ],
  },
  4: { // OHP day — shoulder/upper assistance
    secondaries: [
      { name: 'DB Shoulder Press', category: 'shoulders-press' },
      { name: 'Weighted Pull-up', category: 'vertical-pull' },
    ],
    accessories: [
      { name: 'Lateral Raise', category: 'shoulders-isolation' },
      { name: 'Overhead Tricep Ext (cable)', category: 'triceps' },
      { name: 'Cable Curl', category: 'biceps' },
    ],
  },
};

// Texas Method 3-day exercise maps
const TEXAS_PRIMARY_EXERCISES: Partial<Record<DayNumber, { name: string; category: ExerciseCategory }>> = {
  1: { name: 'Competition Back Squat', category: 'squat-primary' },   // Volume
  2: { name: 'Competition Bench', category: 'bench-primary' },        // Recovery
  3: { name: 'Competition Deadlift', category: 'deadlift-primary' },  // Intensity
};

const TEXAS_DAY_EXERCISE_DEFAULTS: Partial<Record<DayNumber, { secondaries: SlotDef[]; accessories: SlotDef[] }>> = {
  1: { // Volume day — heavy squats + bench volume
    secondaries: [
      { name: 'Competition Bench', category: 'bench-primary' },
      { name: 'Barbell Row', category: 'horizontal-row' },
    ],
    accessories: [
      { name: 'Leg Press', category: 'quad-accessory' },
      { name: 'GHR', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
    ],
  },
  2: { // Recovery day — light bench + OHP + pulls
    secondaries: [
      { name: 'Overhead Press', category: 'shoulders-press' },
      { name: 'Weighted Pull-up', category: 'vertical-pull' },
    ],
    accessories: [
      { name: 'Face Pull', category: 'shoulders-isolation' },
      { name: 'Tricep Pushdown (rope)', category: 'triceps' },
      { name: 'DB Curl', category: 'biceps' },
    ],
  },
  3: { // Intensity day — heavy deadlift + heavy squat
    secondaries: [
      { name: 'Competition Back Squat', category: 'squat-primary' },
    ],
    accessories: [
      { name: 'Reverse Hyper', category: 'posterior-chain' },
      { name: 'Nordic Curl', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
    ],
  },
};

// Westside DE Lower speed pull config — explosive singles at % of deadlift TM
const CONJ_SPEED_PULL: Record<number, { sets: number; reps: number; percent: number }> = {
  1: { sets: 6, reps: 1, percent: 0.60 },
  2: { sets: 6, reps: 1, percent: 0.65 },
  3: { sets: 8, reps: 1, percent: 0.70 },
  4: { sets: 4, reps: 1, percent: 0.50 },  // deload
};

// Westside Conjugate 4-day exercise maps
const CONJ_PRIMARY_EXERCISES: Partial<Record<DayNumber, { name: string; category: ExerciseCategory }>> = {
  1: { name: 'Competition Bench', category: 'bench-primary' },       // ME Upper
  2: { name: 'Competition Back Squat', category: 'squat-primary' },  // ME Lower
  3: { name: 'Banded Bench', category: 'bench-primary' },            // DE Upper
  4: { name: 'Banded Squat', category: 'squat-primary' },              // DE Lower
};

const CONJ_DAY_EXERCISE_DEFAULTS: Partial<Record<DayNumber, { secondaries: SlotDef[]; accessories: SlotDef[] }>> = {
  1: { // ME Upper — heavy supplemental bench + rows, tricep-heavy accessories
    secondaries: [
      { name: 'Close Grip Bench', category: 'bench-secondary' },
      { name: 'Barbell Row', category: 'horizontal-row' },
    ],
    accessories: [
      { name: 'JM Press', category: 'triceps' },
      { name: 'Face Pull', category: 'shoulders-isolation' },
      { name: 'Spider Curl', category: 'biceps' },
    ],
  },
  2: { // ME Lower — posterior chain supplemental, Reverse Hyper + GHR
    secondaries: [
      { name: 'Deficit Deadlift (1")', category: 'deadlift-secondary' },
    ],
    accessories: [
      { name: 'Reverse Hyper', category: 'posterior-chain' },
      { name: 'GHR', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
    ],
  },
  3: { // DE Upper — lockout supplemental, rows, tricep-heavy accessories
    secondaries: [
      { name: 'Floor Press', category: 'bench-secondary' },
      { name: 'Weighted Pull-up', category: 'vertical-pull' },
    ],
    accessories: [
      { name: 'Skull Crushers', category: 'triceps' },
      { name: 'Face Pull', category: 'shoulders-isolation' },
      { name: 'Cable Curl', category: 'biceps' },
    ],
  },
  4: { // DE Lower — speed pulls + Good Mornings, Reverse Hyper + GHR (the Westside staples)
    secondaries: [
      { name: 'Competition Deadlift', category: 'deadlift-primary' },
      { name: 'Good Morning', category: 'posterior-chain' },
    ],
    accessories: [
      { name: 'Reverse Hyper', category: 'posterior-chain' },
      { name: 'GHR', category: 'posterior-chain' },
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
  microPlates: boolean = false,
): Promise<Omit<WorkoutSet, 'id' | 'sessionId'>[]> {
  const template = await db.templates.where({ blockType, weekNumber }).first();
  if (!template) return [];

  const trainingMax = Math.round(oneRM * trainingMaxPercent);
  const sets: Omit<WorkoutSet, 'id' | 'sessionId'>[] = [];
  let setNum = 0;

  const primaryDef = (
    blockType === 'conj-4' ? CONJ_PRIMARY_EXERCISES[dayNumber] :
    blockType === 'linear-4' ? WENDLER_PRIMARY_EXERCISES[dayNumber] :
    blockType === 'texas-4' ? TEXAS_PRIMARY_EXERCISES[dayNumber] :
    null
  ) ?? PRIMARY_EXERCISES[dayNumber];
  const primary = await findExercise(primaryDef.name, primaryDef.category);
  const dayDefaults = (
    blockType === 'conj-4' ? CONJ_DAY_EXERCISE_DEFAULTS[dayNumber] :
    blockType === 'linear-4' ? WENDLER_DAY_EXERCISE_DEFAULTS[dayNumber] :
    blockType === 'texas-4' ? TEXAS_DAY_EXERCISE_DEFAULTS[dayNumber] :
    null
  ) ?? DAY_EXERCISE_DEFAULTS[dayNumber];

  // === AUTOREGULATION: Fatigue multiplier from completed sessions this week ===
  const fatigueMult = await calculateFatigueMultiplier(blockType, weekNumber);

  // === AUTOREGULATION: Volume adjustment from previous week's RPE performance ===
  const volumeAdj = await calculateVolumeAdjustment(blockType, weekNumber);

  // === PRIMARY LIFT ===
  if (blockType === 'linear-4') {
    // === 5/3/1 (WENDLER) — percentage-based ramping sets ===
    let wendlerTM = trainingMax;
    // Day 4 (OHP) uses bench 1RM with reduced multiplier
    if (dayNumber === 4) wendlerTM = roundTo5(trainingMax * OHP_TM_MULTIPLIER, microPlates);

    const wendlerSets = WENDLER_SETS[weekNumber] ?? WENDLER_SETS[1];
    for (const ws of wendlerSets) {
      const goalWeight = roundTo5(wendlerTM * ws.percent, microPlates);
      sets.push(makeSet({
        exerciseId: primary.id, exerciseName: primary.name, setType: 'top',
        setNumber: ++setNum, goalWeight,
        goalReps: ws.reps, goalRPE: 0, category: primaryDef.category,
      }));
    }

    // BBB supplemental: 5×10 at 55% of TM (skip on deload week)
    if (weekNumber !== 4 && template.backoffSets > 0) {
      const bbbWeight = roundTo5(wendlerTM * BBB_PERCENT, microPlates);
      for (let i = 0; i < template.backoffSets; i++) {
        sets.push(makeSet({
          exerciseId: primary.id, exerciseName: primary.name, setType: 'backoff',
          setNumber: ++setNum, goalWeight: bbbWeight,
          goalReps: template.backoffReps, goalRPE: template.backoffRPE, category: primaryDef.category,
        }));
      }
    }
  } else if (isVolume) {
    // Top sets for volume days (DE speed work on conjugate, gauge set on DUP)
    if (template.volumeTopSets) {
      let vTopReps = template.volumeTopReps ?? template.topReps;
      let vTopSets = template.volumeTopSets;
      const vTopRPE = template.volumeTopRPE ?? template.topRPE;

      // Westside DE overrides: speed bench is always triples, speed squat is always doubles
      if (blockType === 'conj-4' && dayNumber === 3) { vTopSets = 9; vTopReps = 3; }
      if (blockType === 'conj-4' && dayNumber === 4) { vTopSets = 12; vTopReps = 2; }

      // Use direct percentage for speed/DE work, otherwise RPE-based calculation
      let vTopPercent = template.volumeTopPercent;

      // Texas Method: Recovery day (Day 2) uses reduced percentage
      if (blockType === 'texas-4' && dayNumber === 2 && vTopPercent) {
        vTopPercent *= 0.80;
      }

      const vTopWeight = vTopPercent
        ? roundTo5(trainingMax * vTopPercent * fatigueMult, microPlates)
        : roundTo5(calculateGoalWeight(trainingMax, vTopReps, vTopRPE, microPlates) * fatigueMult, microPlates);
      for (let i = 0; i < vTopSets; i++) {
        sets.push(makeSet({
          exerciseId: primary.id, exerciseName: primary.name, setType: 'top',
          setNumber: ++setNum, goalWeight: vTopWeight,
          goalReps: vTopReps, goalRPE: vTopRPE, category: primaryDef.category,
        }));
      }
    }

    // Volume/supplemental sets — skip for Texas Recovery day (Day 2)
    if (!(blockType === 'texas-4' && dayNumber === 2)) {
      const volReps = template.volumeBackoffReps ?? template.backoffReps;
      const volRPE = template.volumeBackoffRPE ?? template.backoffRPE;
      const volSets = template.volumeBackoffSets ?? 4;
      const volWeight = roundTo5(calculateGoalWeight(trainingMax, volReps, volRPE, microPlates) * fatigueMult, microPlates);
      for (let i = 0; i < volSets; i++) {
        sets.push(makeSet({
          exerciseId: primary.id, exerciseName: primary.name, setType: 'volume',
          setNumber: ++setNum, goalWeight: volWeight,
          goalReps: volReps, goalRPE: volRPE, category: primaryDef.category,
        }));
      }
    }
  } else {
    const topGoalWeight = roundTo5(calculateGoalWeight(trainingMax, template.topReps, template.topRPE, microPlates) * fatigueMult, microPlates);
    for (let i = 0; i < template.topSets; i++) {
      sets.push(makeSet({
        exerciseId: primary.id, exerciseName: primary.name, setType: 'top',
        setNumber: ++setNum, goalWeight: topGoalWeight,
        goalReps: template.topReps, goalRPE: template.topRPE, category: primaryDef.category,
      }));
    }

    // Backoff sets (skip entirely when template prescribes 0, e.g. conjugate ME days)
    if (template.backoffSets > 0) {
      const backoffGoalWeight = roundTo5(calculateGoalWeight(trainingMax, template.backoffReps, template.backoffRPE, microPlates) * fatigueMult, microPlates);

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
  }

  // === SECONDARIES (auto-weight from PR history) ===
  for (const sec of dayDefaults.secondaries) {
    const exercise = await findExercise(sec.name, sec.category);

    // Conjugate DE Lower: speed pulls are percentage-based singles from deadlift 1RM
    const isSpeedPull = blockType === 'conj-4' && dayNumber === 4 && isVolume
      && (sec.category === 'deadlift-primary' || sec.category === 'deadlift-secondary');

    if (isSpeedPull) {
      const settings = await db.settings.get('singleton');
      if (settings) {
        const deadliftTM = Math.round(settings.deadlift1RM * settings.trainingMaxPercent);
        const pullCfg = CONJ_SPEED_PULL[weekNumber] ?? CONJ_SPEED_PULL[1];
        const pullWeight = roundTo5(deadliftTM * pullCfg.percent, microPlates);
        for (let i = 0; i < pullCfg.sets; i++) {
          sets.push(makeSet({
            exerciseId: exercise.id, exerciseName: exercise.name, setType: 'secondary',
            setNumber: ++setNum, goalWeight: pullWeight,
            goalReps: pullCfg.reps, goalRPE: 0, category: sec.category,
          }));
        }
      }
    } else {
      const lastWeight = await getLastWeight(exercise.id);
      for (let i = 0; i < template.secondarySets; i++) {
        sets.push(makeSet({
          exerciseId: exercise.id, exerciseName: exercise.name, setType: 'secondary',
          setNumber: ++setNum, goalWeight: lastWeight,
          goalReps: template.secondaryReps, goalRPE: template.secondaryRPE, category: sec.category,
        }));
      }
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
