import { db } from './database';
import type { UserSettings } from './types';
import exerciseData from './data/exercises.json';
import templateData from './data/periodization-templates.json';

const DEFAULT_SETTINGS: UserSettings = {
  id: 'singleton',
  squat1RM: 455,
  bench1RM: 325,
  deadlift1RM: 500,
  squatGoal: 500,
  benchGoal: 400,
  deadliftGoal: 600,
  trainingMaxPercent: 1.0,
  currentBlockType: 'linear-8',
  currentWeek: 2,
  barWeight: 45,
  availablePlates: [45, 35, 25, 10, 5, 2.5],
  theme: 'dark',
  restTimerDefault: 180,
};

export async function seedDatabase() {
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.put(DEFAULT_SETTINGS);
  }

  const exerciseCount = await db.exercises.count();
  if (exerciseCount === 0) {
    await db.exercises.bulkAdd(exerciseData as any);
  }

  const templateCount = await db.templates.count();
  if (templateCount === 0) {
    await db.templates.bulkAdd(templateData as any);
  } else {
    // Migrate: add new block types for existing users
    const hasConj = await db.templates.where({ blockType: 'conj-4', weekNumber: 1 }).count();
    if (hasConj === 0) {
      const conjTemplates = (templateData as any[]).filter((t) => t.blockType === 'conj-4');
      if (conjTemplates.length > 0) {
        await db.templates.bulkAdd(conjTemplates);
      }
    }
  }
}
