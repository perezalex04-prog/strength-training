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
    const newBlockTypes = ['conj-4', 'peak-8', 'texas-4', 'block-12'];
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

    // Migrate: always keep conj-4 templates in sync with latest data
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

    // One-time: delete stale conj-4 sessions with RPE-based DE weights
    // Uses a version flag so this only runs once per device
    const conjWeek1 = await db.templates.where({ blockType: 'conj-4', weekNumber: 1 }).first();
    if (conjWeek1 && !(conjWeek1 as any)._wsV2) {
      await db.templates.update(conjWeek1.id, { _wsV2: true } as any);
      const staleSessions = await db.sessions
        .where('blockType').equals('conj-4')
        .filter((s) => !s.completed)
        .toArray();
      if (staleSessions.length > 0) {
        const staleIds = staleSessions.map((s) => s.id);
        await db.sets.where('sessionId').anyOf(staleIds).delete();
        await db.sessions.bulkDelete(staleIds);
      }
    }

    // V3: Regenerate conj-4 sessions for authentic Westside exercise defaults + DE rep fixes
    if (conjWeek1 && !(conjWeek1 as any)._wsV3) {
      await db.templates.update(conjWeek1.id, { _wsV3: true } as any);
      const staleSessions = await db.sessions
        .where('blockType').equals('conj-4')
        .filter((s) => !s.completed)
        .toArray();
      if (staleSessions.length > 0) {
        const staleIds = staleSessions.map((s) => s.id);
        await db.sets.where('sessionId').anyOf(staleIds).delete();
        await db.sessions.bulkDelete(staleIds);
      }
    }

    // V5: Remove backoff sets from conjugate (true Westside: ME hits max, DE does speed work, no backoffs)
    if (conjWeek1 && !(conjWeek1 as any)._wsV5) {
      await db.templates.update(conjWeek1.id, { _wsV5: true } as any);
      const staleSessions = await db.sessions
        .where('blockType').equals('conj-4')
        .filter((s) => !s.completed)
        .toArray();
      if (staleSessions.length > 0) {
        const staleIds = staleSessions.map((s) => s.id);
        await db.sets.where('sessionId').anyOf(staleIds).delete();
        await db.sessions.bulkDelete(staleIds);
      }
    }

    // V6: Speed pulls as percentage-based singles on DE Lower + reduce secondary reps to 5-6 range
    if (conjWeek1 && !(conjWeek1 as any)._wsV6) {
      await db.templates.update(conjWeek1.id, { _wsV6: true } as any);
      const staleSessions = await db.sessions
        .where('blockType').equals('conj-4')
        .filter((s) => !s.completed)
        .toArray();
      if (staleSessions.length > 0) {
        const staleIds = staleSessions.map((s) => s.id);
        await db.sets.where('sessionId').anyOf(staleIds).delete();
        await db.sessions.bulkDelete(staleIds);
      }
    }

    // V7: Retroactively update secondary rep counts on ALL conj-4 sessions (including completed)
    if (conjWeek1 && !(conjWeek1 as any)._wsV7) {
      await db.templates.update(conjWeek1.id, { _wsV7: true } as any);
      const CONJ_SEC_REPS: Record<number, number> = { 1: 6, 2: 5, 3: 5, 4: 8 };
      const allConjSessions = await db.sessions
        .where('blockType').equals('conj-4')
        .toArray();
      for (const sess of allConjSessions) {
        const targetReps = CONJ_SEC_REPS[sess.weekNumber];
        if (!targetReps) continue;
        const sessionSets = await db.sets.where('sessionId').equals(sess.id).toArray();
        const secondarySets = sessionSets.filter((s: any) => s.setType === 'secondary');
        for (const s of secondarySets) {
          if (s.goalReps !== targetReps) {
            await db.sets.update(s.id, { goalReps: targetReps });
          }
        }
      }
    }

    // Migrate: always keep linear-4 (5/3/1) templates in sync with latest data
    const wendlerTemplates = (templateData as any[]).filter((t) => t.blockType === 'linear-4');
    for (const tpl of wendlerTemplates) {
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
      });
    }

    // V4: Regenerate stale linear-4 sessions (day structure changed from 5→4 for 5/3/1)
    const wendlerWeek1 = await db.templates.where({ blockType: 'linear-4', weekNumber: 1 }).first();
    if (wendlerWeek1 && !(wendlerWeek1 as any)._wsV4) {
      await db.templates.update(wendlerWeek1.id, { _wsV4: true } as any);
      const staleSessions = await db.sessions
        .where('blockType').equals('linear-4')
        .filter((s) => !s.completed)
        .toArray();
      if (staleSessions.length > 0) {
        const staleIds = staleSessions.map((s) => s.id);
        await db.sets.where('sessionId').anyOf(staleIds).delete();
        await db.sessions.bulkDelete(staleIds);
      }
    }
  }
}
