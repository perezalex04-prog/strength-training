import { db } from './database';
import type {
  UserSettings,
  PeriodizationTemplate,
  WorkoutSession,
  WorkoutSet,
  BlockType,
  PrimaryLift,
  ExerciseCategory,
} from './types';

export async function getSettings(): Promise<UserSettings | undefined> {
  return db.settings.get('singleton');
}

export async function updateSettings(updates: Partial<UserSettings>) {
  await db.settings.update('singleton', updates);
}

export async function getTemplate(
  blockType: BlockType,
  weekNumber: number,
): Promise<PeriodizationTemplate | undefined> {
  return db.templates.where({ blockType, weekNumber }).first();
}

export async function getSessionsForWeek(
  blockType: BlockType,
  weekNumber: number,
): Promise<WorkoutSession[]> {
  return db.sessions.where({ blockType, weekNumber }).toArray();
}

export async function getSetsForSession(sessionId: string): Promise<WorkoutSet[]> {
  return db.sets.where('sessionId').equals(sessionId).toArray();
}

export async function getExercisesByCategory(category: ExerciseCategory) {
  return db.exercises.where('category').equals(category).toArray();
}

export async function getDefaultExercise(category: ExerciseCategory) {
  return db.exercises.where('category').equals(category).first();
}

export function getLiftCategories(lift: PrimaryLift): {
  primary: ExerciseCategory;
  secondary: ExerciseCategory;
  accessories: ExerciseCategory[];
} {
  switch (lift) {
    case 'bench':
      return {
        primary: 'bench-primary',
        secondary: 'bench-secondary',
        accessories: ['triceps', 'chest-accessory', 'shoulders-press'],
      };
    case 'squat':
      return {
        primary: 'squat-primary',
        secondary: 'squat-secondary',
        accessories: ['quad-accessory', 'posterior-chain', 'core'],
      };
    case 'deadlift':
      return {
        primary: 'deadlift-primary',
        secondary: 'deadlift-secondary',
        accessories: ['horizontal-row', 'vertical-pull', 'biceps'],
      };
  }
}
