/**
 * Calculate Estimated 1 Rep Max using the RPE-adjusted Epley formula.
 * Formula: weight * 36 / (37 - (reps + (10 - rpe)))
 */
export function calculateE1RM(
  weight: number,
  reps: number,
  rpe: number,
): number | null {
  if (!weight || !reps || !rpe) return null;
  const effectiveReps = reps + (10 - rpe);
  if (effectiveReps >= 37) return null;
  return Math.round(weight * (36 / (37 - effectiveReps)));
}

export function calculateTonnage(weight: number, reps: number): number {
  return weight * reps;
}

/**
 * Back-calculate goal weight from training max and target reps/RPE.
 * Inverse of E1RM: weight = trainingMax * (37 - effectiveReps) / 36
 */
export function calculateGoalWeight(
  trainingMax: number,
  targetReps: number,
  targetRPE: number,
): number {
  const effectiveReps = targetReps + (10 - targetRPE);
  const raw = trainingMax * (37 - effectiveReps) / 36;
  return roundTo5(raw);
}

export function roundTo5(value: number): number {
  return Math.round(value / 5) * 5;
}

export function calculatePercentOfTM(weight: number, trainingMax: number): string {
  if (!weight || !trainingMax) return '';
  return (weight / trainingMax * 100).toFixed(1) + '%';
}
