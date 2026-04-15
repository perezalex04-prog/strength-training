import { db } from '@/db/database';
import { calculateE1RM, calculateTonnage } from './e1rm';
import { getLocalDate } from '@/utils/formatters';
import type { WorkoutSet, PrimaryLift, ProgressionEntry, ExercisePR } from '@/db/types';

/**
 * After updating a set's actuals, recompute derived fields.
 */
export function computeSetDerived(
  set: WorkoutSet,
  trainingMax: number,
): Partial<WorkoutSet> {
  const updates: Partial<WorkoutSet> = {};

  if (set.actualWeight && set.actualReps && set.actualRPE) {
    updates.e1rm = calculateE1RM(set.actualWeight, set.actualReps, set.actualRPE);
    updates.tonnage = calculateTonnage(set.actualWeight, set.actualReps);
    updates.percentOfTM = trainingMax > 0
      ? Math.round(set.actualWeight / trainingMax * 1000) / 10
      : null;
  }

  return updates;
}

/**
 * Find the best set (highest E1RM) for a given lift from a list of sets.
 */
export function findBestSet(
  sets: WorkoutSet[],
): WorkoutSet | null {
  let best: WorkoutSet | null = null;
  for (const set of sets) {
    if (set.e1rm && (!best || (best.e1rm ?? 0) < set.e1rm)) {
      best = set;
    }
  }
  return best;
}

/**
 * Update exercise PR records after completing a workout.
 */
export async function updateExercisePRs(sets: WorkoutSet[], date: string) {
  for (const set of sets) {
    if (!set.actualWeight || !set.actualReps || !set.actualRPE) continue;

    const e1rm = calculateE1RM(set.actualWeight, set.actualReps, set.actualRPE);
    const tonnage = calculateTonnage(set.actualWeight, set.actualReps);
    const existing = await db.exercisePRs.get(set.exerciseId);

    if (!existing) {
      await db.exercisePRs.put({
        id: set.exerciseId,
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseName,
        bestWeight: set.actualWeight,
        bestReps: set.actualReps,
        bestRPE: set.actualRPE,
        bestTonnage: tonnage,
        bestE1RM: e1rm ?? 0,
        bestDate: date,
        lastWeight: set.actualWeight,
        lastReps: set.actualReps,
        lastRPE: set.actualRPE,
        lastTonnage: tonnage,
        lastDate: date,
      });
    } else {
      const updates: Partial<ExercisePR> = {
        lastWeight: set.actualWeight,
        lastReps: set.actualReps,
        lastRPE: set.actualRPE,
        lastTonnage: tonnage,
        lastDate: date,
      };

      if (e1rm && e1rm > existing.bestE1RM) {
        updates.bestWeight = set.actualWeight;
        updates.bestReps = set.actualReps;
        updates.bestRPE = set.actualRPE;
        updates.bestTonnage = tonnage;
        updates.bestE1RM = e1rm;
        updates.bestDate = date;
      }

      await db.exercisePRs.update(set.exerciseId, updates);
    }
  }
}

/**
 * Create a weekly progression snapshot.
 */
export async function createProgressionSnapshot(
  weekNumber: number,
  blockType: string,
  phase: string,
  liftBests: Record<PrimaryLift, WorkoutSet | null>,
): Promise<void> {
  const date = getLocalDate();
  const id = `prog-${blockType}-w${weekNumber}`;

  const entry: ProgressionEntry = {
    id,
    date,
    weekNumber,
    blockType: blockType as any,
    phase: phase as any,
    squatWeight: liftBests.squat?.actualWeight ?? null,
    squatReps: liftBests.squat?.actualReps ?? null,
    squatRPE: liftBests.squat?.actualRPE ?? null,
    squatE1RM: liftBests.squat?.e1rm ?? null,
    benchWeight: liftBests.bench?.actualWeight ?? null,
    benchReps: liftBests.bench?.actualReps ?? null,
    benchRPE: liftBests.bench?.actualRPE ?? null,
    benchE1RM: liftBests.bench?.e1rm ?? null,
    deadliftWeight: liftBests.deadlift?.actualWeight ?? null,
    deadliftReps: liftBests.deadlift?.actualReps ?? null,
    deadliftRPE: liftBests.deadlift?.actualRPE ?? null,
    deadliftE1RM: liftBests.deadlift?.e1rm ?? null,
    totalE1RM: null,
  };

  const total = (entry.squatE1RM ?? 0) + (entry.benchE1RM ?? 0) + (entry.deadliftE1RM ?? 0);
  entry.totalE1RM = total > 0 ? total : null;

  await db.progression.put(entry);
}
