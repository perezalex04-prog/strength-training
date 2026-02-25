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
    const newBlockTypes = ['conj-4', 'peak-8'];
    for (const bt of newBlockTypes) {
      const count = await db.templates.where({ blockType: bt, weekNumber: 1 }).count();
      if (count === 0) {
        const newTemplates = (templateData as any[]).filter((t) => t.blockType === bt);
        if (newTemplates.length > 0) {
          await db.templates.bulkAdd(newTemplates);
        }
      }
    }

    // Migrate: update existing DUP templates with volume-day fields
    const dupTemplates = (templateData as any[]).filter((t) => t.blockType === 'dup-6');
    for (const tpl of dupTemplates) {
      if (tpl.volumeBackoffReps) {
        await db.templates.update(tpl.id, {
          phase: tpl.phase,
          topReps: tpl.topReps,
          topRPE: tpl.topRPE,
          backoffSets: tpl.backoffSets,
          backoffReps: tpl.backoffReps,
          backoffRPE: tpl.backoffRPE,
          volumeTopSets: tpl.volumeTopSets,
          volumeTopReps: tpl.volumeTopReps,
          volumeTopRPE: tpl.volumeTopRPE,
          volumeBackoffSets: tpl.volumeBackoffSets,
          volumeBackoffReps: tpl.volumeBackoffReps,
          volumeBackoffRPE: tpl.volumeBackoffRPE,
        });
      }
    }

    // Migrate: update existing conj-4 templates to Westside prescriptions
    const conjTemplates = (templateData as any[]).filter((t) => t.blockType === 'conj-4');
    for (const tpl of conjTemplates) {
      await db.templates.update(tpl.id, {
        phase: tpl.phase,
        topSets: tpl.topSets,
        topReps: tpl.topReps,
        topRPE: tpl.topRPE,
        backoffSets: tpl.backoffSets,
        backoffReps: tpl.backoffReps,
        backoffRPE: tpl.backoffRPE,
        secondarySets: tpl.secondarySets,
        secondaryReps: tpl.secondaryReps,
        secondaryRPE: tpl.secondaryRPE,
        accessorySets: tpl.accessorySets,
        accessoryReps: tpl.accessoryReps,
        accessoryRPE: tpl.accessoryRPE,
        volumeTopSets: tpl.volumeTopSets,
        volumeTopReps: tpl.volumeTopReps,
        volumeTopRPE: tpl.volumeTopRPE,
        volumeTopPercent: tpl.volumeTopPercent,
        volumeBackoffSets: tpl.volumeBackoffSets,
        volumeBackoffReps: tpl.volumeBackoffReps,
        volumeBackoffRPE: tpl.volumeBackoffRPE,
      });
    }
  }
}
