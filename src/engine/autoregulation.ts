import { db } from '@/db/database';
import { calculateE1RM, calculateGoalWeight, roundTo5 } from './e1rm';

/**
 * Look up the last weight used for an exercise from PR history.
 * Returns 0 if no history exists (lifter picks their own weight).
 */
export async function getLastWeight(exerciseId: string): Promise<number> {
  if (!exerciseId) return 0;
  const pr = await db.exercisePRs.get(exerciseId);
  return pr?.lastWeight ?? 0;
}

/**
 * Calculate autoregulated backoff weight based on actual top set performance.
 * Instead of a flat 90% of prescribed top weight, we derive backoff from
 * the actual e1RM the lifter demonstrated.
 *
 * This is the core RTS-style autoregulation:
 * - Lifter hits top set → we know their actual e1RM that day
 * - Back-calculate appropriate backoff weight for target reps/RPE
 */
export function calculateAutoregulatedBackoff(
  actualTopWeight: number,
  actualTopReps: number,
  actualTopRPE: number,
  targetBackoffReps: number,
  targetBackoffRPE: number,
  microPlates: boolean = false,
): number {
  const actualE1RM = calculateE1RM(actualTopWeight, actualTopReps, actualTopRPE);
  if (!actualE1RM) return roundTo5(actualTopWeight * 0.9, microPlates);

  // Use the actual e1RM as a live training max to calculate backoff
  return calculateGoalWeight(actualE1RM, targetBackoffReps, targetBackoffRPE, microPlates);
}

/**
 * Analyze RPE drift across completed sessions in the current block/week.
 * Returns a fatigue multiplier:
 *   - 1.0 = on track
 *   - < 1.0 = fatigued, reduce loads
 *   - > 1.0 = fresh, can push harder
 *
 * Looks at top and backoff sets only (primary lift performance).
 */
export async function calculateFatigueMultiplier(
  blockType: string,
  weekNumber: number,
): Promise<number> {
  const sessions = await db.sessions
    .where({ blockType, weekNumber })
    .filter((s) => s.completed)
    .toArray();

  if (sessions.length === 0) return 1.0;

  const sessionIds = sessions.map((s) => s.id);
  const sets = await db.sets
    .where('sessionId')
    .anyOf(sessionIds)
    .toArray();

  // Only look at primary lift sets (top/backoff/volume) with both goal and actual RPE
  const rpeSets = sets.filter(
    (s) =>
      (s.setType === 'top' || s.setType === 'backoff' || s.setType === 'volume') &&
      s.goalRPE > 0 &&
      s.actualRPE != null &&
      s.actualWeight != null,
  );

  if (rpeSets.length < 3) return 1.0; // Need enough data

  let totalDrift = 0;
  for (const s of rpeSets) {
    totalDrift += (s.actualRPE! - s.goalRPE);
  }
  const avgDrift = totalDrift / rpeSets.length;

  // Graduated response:
  // avgDrift > 0.5 → reduce by 2% per 0.5 RPE overshoot
  // avgDrift < -0.5 → increase by 1% per 0.5 RPE undershoot
  // Clamp between 0.92 and 1.04 (max 8% reduction, 4% increase)
  if (avgDrift > 0.5) {
    const reduction = Math.min((avgDrift - 0.5) * 0.04, 0.08);
    return Math.max(1.0 - reduction, 0.92);
  } else if (avgDrift < -0.5) {
    const increase = Math.min((-avgDrift - 0.5) * 0.02, 0.04);
    return Math.min(1.0 + increase, 1.04);
  }

  return 1.0;
}

/**
 * Calculate volume adjustment based on previous week's RPE performance.
 * Returns a delta to add to the template's backoff set count.
 *   - -1 if consistently overshooting RPE (fatigued → less volume)
 *   - +1 if consistently undershooting RPE (fresh → more volume)
 *   - 0 otherwise
 */
export async function calculateVolumeAdjustment(
  blockType: string,
  weekNumber: number,
): Promise<number> {
  if (weekNumber <= 1) return 0;

  const prevWeek = weekNumber - 1;
  const sessions = await db.sessions
    .where({ blockType, weekNumber: prevWeek })
    .filter((s) => s.completed)
    .toArray();

  if (sessions.length === 0) return 0;

  const sessionIds = sessions.map((s) => s.id);
  const sets = await db.sets
    .where('sessionId')
    .anyOf(sessionIds)
    .toArray();

  const topSets = sets.filter(
    (s) =>
      s.setType === 'top' &&
      s.goalRPE > 0 &&
      s.actualRPE != null,
  );

  if (topSets.length === 0) return 0;

  let totalDrift = 0;
  for (const s of topSets) {
    totalDrift += (s.actualRPE! - s.goalRPE);
  }
  const avgDrift = totalDrift / topSets.length;

  if (avgDrift >= 1.0) return -1; // Consistently hard → cut a set
  if (avgDrift <= -1.0) return 1; // Consistently easy → add a set
  return 0;
}

/**
 * Check if the lifter's actual e1RM exceeds their stored 1RM.
 * Returns the new 1RM if it should be updated, or null if no update needed.
 */
export function checkForNewPR(
  actualWeight: number,
  actualReps: number,
  actualRPE: number,
  current1RM: number,
): number | null {
  const e1rm = calculateE1RM(actualWeight, actualReps, actualRPE);
  if (e1rm && e1rm > current1RM) return e1rm;
  return null;
}
