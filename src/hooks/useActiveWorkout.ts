import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { generateWorkoutSets } from '@/engine/periodization';
import { computeSetDerived, updateExercisePRs, findBestSet, createProgressionSnapshot } from '@/engine/progression';
import { calculateAutoregulatedBackoff, checkForNewPR, getLastWeight } from '@/engine/autoregulation';
import { calculateGoalWeight, roundTo5 } from '@/engine/e1rm';
import type { UserSettings, WorkoutSession, WorkoutSet, DayNumber, PrimaryLift, BlockType } from '@/db/types';
import { getDayConfigForBlock } from '@/db/types';

export interface OneRMUpdate {
  lift: string;
  old: number;
  new: number;
}

/**
 * Query previous week's best e1RM from completed top/backoff/volume sets
 * for the same day number and primary lift.
 */
async function getPrevWeekBestE1RM(
  blockType: BlockType,
  weekNumber: number,
  dayNumber: DayNumber,
  primaryLift: PrimaryLift,
): Promise<number | null> {
  if (weekNumber <= 1) return null;

  const prevWeek = weekNumber - 1;
  const prevSessions = await db.sessions
    .where({ blockType, weekNumber: prevWeek })
    .filter((s) => s.dayNumber === dayNumber && s.primaryLift === primaryLift && s.completed)
    .toArray();

  if (prevSessions.length === 0) return null;

  const prevSessionIds = prevSessions.map((s) => s.id);
  const prevSets = await db.sets
    .where('sessionId')
    .anyOf(prevSessionIds)
    .toArray();

  // Find the set with the highest stored e1RM
  const completedSets = prevSets.filter(
    (s) =>
      (s.setType === 'top' || s.setType === 'backoff' || s.setType === 'volume') &&
      s.actualWeight != null &&
      s.actualReps != null &&
      s.actualRPE != null &&
      s.e1rm != null,
  );

  if (completedSets.length === 0) return null;

  let bestE1RM = 0;
  for (const s of completedSets) {
    if (s.e1rm! > bestE1RM) bestE1RM = s.e1rm!;
  }

  return bestE1RM > 0 ? bestE1RM : null;
}

export function useActiveWorkout(settings: UserSettings | undefined, selectedDate?: string) {
  const today = selectedDate ?? new Date().toISOString().split('T')[0];

  const sessions = useLiveQuery(
    async () => {
      if (!settings) return [];
      return db.sessions
        .where({ blockType: settings.currentBlockType, weekNumber: settings.currentWeek })
        .toArray();
    },
    [settings?.currentBlockType, settings?.currentWeek],
  );

  const allSets = useLiveQuery(
    async () => {
      if (!sessions || sessions.length === 0) return [];
      const sessionIds = sessions.map((s) => s.id);
      return db.sets.where('sessionId').anyOf(sessionIds).toArray();
    },
    [sessions],
  );

  async function getOrCreateSession(dayNumber: DayNumber, date?: string): Promise<WorkoutSession> {
    if (!settings) throw new Error('Settings not loaded');

    const sessionDate = date ?? today;
    const day = getDayConfigForBlock(settings.currentBlockType).find((d) => d.dayNumber === dayNumber)!;

    // Check IndexedDB DIRECTLY — not the stale React sessions array
    const sessionId = `session-${settings.currentBlockType}-w${settings.currentWeek}-d${dayNumber}-${sessionDate}`;
    const existingById = await db.sessions.get(sessionId);
    if (existingById) return existingById;

    // Also check if ANY session exists for this day in this block/week (different date)
    const existingByDay = await db.sessions
      .where({ blockType: settings.currentBlockType, weekNumber: settings.currentWeek })
      .filter((s) => s.dayNumber === dayNumber)
      .first();
    if (existingByDay) return existingByDay;

    // No existing session — safe to create new one
    const template = await db.templates
      .where({ blockType: settings.currentBlockType, weekNumber: settings.currentWeek })
      .first();

    const session: WorkoutSession = {
      id: sessionId,
      date: sessionDate,
      blockType: settings.currentBlockType,
      weekNumber: settings.currentWeek,
      phase: template?.phase ?? 'accumulation',
      dayNumber,
      primaryLift: day.primaryLift,
      completed: false,
    };

    await db.sessions.put(session);

    const oneRM = settings[`${day.primaryLift}1RM` as keyof UserSettings] as number;
    const goalSets = await generateWorkoutSets(
      settings.currentBlockType,
      settings.currentWeek,
      dayNumber,
      day.primaryLift,
      day.isVolume,
      oneRM,
      settings.trainingMaxPercent,
    );

    const setsWithIds: WorkoutSet[] = goalSets.map((s, i) => ({
      ...s,
      id: `${session.id}-set-${i + 1}`,
      sessionId: session.id,
    }));

    await db.sets.bulkPut(setsWithIds);
    return session;
  }

  async function updateSet(
    setId: string,
    updates: { actualWeight?: number | null; actualReps?: number | null; actualRPE?: number | null },
  ) {
    if (!settings) return;

    const set = await db.sets.get(setId);
    if (!set) return;

    const merged = { ...set, ...updates };
    const lift = sessions?.find((s) => s.id === set.sessionId)?.primaryLift;
    const oneRM = lift ? (settings[`${lift}1RM` as keyof UserSettings] as number) : 0;
    const trainingMax = Math.round(oneRM * settings.trainingMaxPercent);

    const derived = computeSetDerived(merged, trainingMax);
    await db.sets.update(setId, { ...updates, ...derived });

    // === INTRA-SESSION AUTOREGULATION ===
    // When a top set is fully logged, recalculate backoff weights in real-time
    if (
      set.setType === 'top' &&
      merged.actualWeight != null &&
      merged.actualReps != null &&
      merged.actualRPE != null
    ) {
      const sessionSets = await db.sets.where('sessionId').equals(set.sessionId).toArray();
      const template = await db.templates
        .where({ blockType: settings.currentBlockType, weekNumber: settings.currentWeek })
        .first();

      if (template) {
        const uncompletedBackoffs = sessionSets.filter(
          (s) => s.setType === 'backoff' && s.actualWeight == null,
        );

        if (uncompletedBackoffs.length > 0) {
          const newBackoffWeight = calculateAutoregulatedBackoff(
            merged.actualWeight,
            merged.actualReps,
            merged.actualRPE,
            template.backoffReps,
            template.backoffRPE,
          );

          await Promise.all(
            uncompletedBackoffs.map((s) =>
              db.sets.update(s.id, { goalWeight: newBackoffWeight }),
            ),
          );
        }
      }
    }
  }

  async function updateNotes(setId: string, notes: string) {
    await db.sets.update(setId, { notes });
  }

  /** Add an extra set that copies the last set in a group */
  async function addSet(templateSetId: string): Promise<void> {
    const templateSet = await db.sets.get(templateSetId);
    if (!templateSet) return;

    // Find the highest set number in this session to generate a unique ID
    const sessionSets = await db.sets.where('sessionId').equals(templateSet.sessionId).toArray();
    const maxSetNum = Math.max(...sessionSets.map((s) => s.setNumber));

    const newSet: WorkoutSet = {
      ...templateSet,
      id: `${templateSet.sessionId}-set-${maxSetNum + 1}`,
      setNumber: maxSetNum + 1,
      actualWeight: null,
      actualReps: null,
      actualRPE: null,
      e1rm: null,
      percentOfTM: null,
      tonnage: null,
      notes: undefined,
    };

    await db.sets.add(newSet);
  }

  async function swapExercise(setIds: string[], exerciseId: string, exerciseName: string) {
    await Promise.all(
      setIds.map((id) => db.sets.update(id, { exerciseId, exerciseName })),
    );

    if (setIds.length === 0) return;

    // For non-primary sets (secondary/accessory/optional): update goal weight from new exercise's PR history
    const swappedSet = await db.sets.get(setIds[0]);
    if (!swappedSet) return;

    if (swappedSet.setType !== 'top' && swappedSet.setType !== 'backoff' && swappedSet.setType !== 'volume') {
      const lastWeight = await getLastWeight(exerciseId);
      for (const id of setIds) {
        const s = await db.sets.get(id);
        if (s && s.actualWeight == null) {
          await db.sets.update(id, { goalWeight: lastWeight });
        }
      }
      return;
    }

    // Conjugate: recalculate primary lift weights when swapping to a different lift category
    if (!settings || settings.currentBlockType !== 'conj-4') return;

    const exercise = await db.exercises.get(exerciseId);
    if (!exercise) return;

    // Determine which 1RM the new exercise maps to
    let newLift: PrimaryLift | null = null;
    if (exercise.category.startsWith('deadlift')) newLift = 'deadlift';
    else if (exercise.category.startsWith('squat')) newLift = 'squat';
    else if (exercise.category.startsWith('bench')) newLift = 'bench';
    if (!newLift) return;

    const session = await db.sessions.get(swappedSet.sessionId);
    if (!session || session.primaryLift === newLift) return;

    // Update session's primary lift
    await db.sessions.update(session.id, { primaryLift: newLift });

    // Recalculate goal weights for all primary sets using new 1RM
    const newOneRM = settings[`${newLift}1RM` as keyof UserSettings] as number;
    const trainingMax = Math.round(newOneRM * settings.trainingMaxPercent);
    const template = await db.templates
      .where({ blockType: settings.currentBlockType, weekNumber: settings.currentWeek })
      .first();
    if (!template) return;

    const allSessionSets = await db.sets.where('sessionId').equals(session.id).toArray();
    const primarySets = allSessionSets.filter(
      (s) => s.setType === 'top' || s.setType === 'backoff' || s.setType === 'volume',
    );

    const dayConfig = getDayConfigForBlock(settings.currentBlockType).find((d) => d.dayNumber === session.dayNumber);
    const fatigueMult = 1.0; // Don't re-query fatigue on swap

    for (const s of primarySets) {
      let newWeight: number;
      if (s.setType === 'top' && dayConfig?.isVolume && template.volumeTopPercent) {
        newWeight = roundTo5(trainingMax * template.volumeTopPercent * fatigueMult);
      } else if (s.setType === 'top') {
        newWeight = roundTo5(calculateGoalWeight(trainingMax, s.goalReps, s.goalRPE));
      } else if (s.setType === 'backoff') {
        newWeight = roundTo5(calculateGoalWeight(trainingMax, s.goalReps, s.goalRPE));
      } else {
        newWeight = roundTo5(calculateGoalWeight(trainingMax, s.goalReps, s.goalRPE));
      }
      if (s.actualWeight == null) {
        await db.sets.update(s.id, { goalWeight: newWeight });
      }
    }
  }

  async function completeSession(sessionId: string): Promise<OneRMUpdate[]> {
    const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
    const session = await db.sessions.get(sessionId);
    if (!session || !settings) return [];

    await updateExercisePRs(sets, session.date);
    await db.sessions.update(sessionId, { completed: true });

    // Build progression snapshot from ALL sessions in this block/week
    const weekSessions = await db.sessions
      .where({ blockType: settings.currentBlockType, weekNumber: settings.currentWeek })
      .toArray();
    const weekSessionIds = weekSessions.map((s) => s.id);
    const allWeekSets = await db.sets.where('sessionId').anyOf(weekSessionIds).toArray();

    const lifts: PrimaryLift[] = ['squat', 'bench', 'deadlift'];
    const liftBests: Record<PrimaryLift, WorkoutSet | null> = {
      squat: null, bench: null, deadlift: null,
    };

    for (const lift of lifts) {
      const liftSessionIds = weekSessions
        .filter((s) => s.primaryLift === lift)
        .map((s) => s.id);
      const liftSets = allWeekSets.filter(
        (s) => liftSessionIds.includes(s.sessionId) &&
          (s.setType === 'top' || s.setType === 'backoff' || s.setType === 'volume'),
      );
      liftBests[lift] = findBestSet(liftSets);
    }

    await createProgressionSnapshot(
      settings.currentWeek,
      settings.currentBlockType,
      session.phase,
      liftBests,
    );

    // === AUTO 1RM UPDATES ===
    const rmUpdates: OneRMUpdate[] = [];
    for (const lift of lifts) {
      const best = liftBests[lift];
      if (!best?.actualWeight || !best?.actualReps || !best?.actualRPE) continue;

      const current1RM = settings[`${lift}1RM` as keyof UserSettings] as number;
      const newRM = checkForNewPR(best.actualWeight, best.actualReps, best.actualRPE, current1RM);
      if (newRM) {
        await db.settings.update('user', { [`${lift}1RM`]: newRM });
        rmUpdates.push({ lift, old: current1RM, new: newRM });
      }
    }

    return rmUpdates;
  }

  // === CROSS-WEEK AUTOREGULATION ===
  // Recalculate goal weights for unstarted sessions based on previous week's actual performance
  async function recalculateGoalWeights(sessionId: string): Promise<void> {
    if (!settings) return;

    const session = await db.sessions.get(sessionId);
    if (!session || session.completed) return;

    const sets = await db.sets.where('sessionId').equals(sessionId).toArray();

    // Guard: only recalculate unstarted sessions (no actual data logged)
    const isUnstarted = sets.every((s) => s.actualWeight == null);
    if (!isUnstarted) return;

    // Guard: skip volume/DE days (percentage-based speed work)
    const dayConfig = getDayConfigForBlock(session.blockType).find(
      (d) => d.dayNumber === session.dayNumber,
    );
    if (dayConfig?.isVolume) return;

    // Determine current training max from settings
    const liftKey = `${session.primaryLift}1RM` as keyof UserSettings;
    const currentOneRM = settings[liftKey] as number;
    const currentTM = Math.round(currentOneRM * settings.trainingMaxPercent);

    // Lookup previous week's best e1RM for same day + same lift
    const prevE1RM = await getPrevWeekBestE1RM(
      session.blockType,
      session.weekNumber,
      session.dayNumber,
      session.primaryLift,
    );

    // Use the higher of prev week e1RM and current settings TM
    // This ensures a bad week doesn't lower future goals
    const liveTM = prevE1RM ? Math.max(prevE1RM, currentTM) : currentTM;

    // Recalculate RPE-based top and backoff sets
    const updates: { id: string; goalWeight: number }[] = [];
    for (const set of sets) {
      if (
        (set.setType === 'top' || set.setType === 'backoff') &&
        set.goalRPE > 0
      ) {
        const newGoalWeight = calculateGoalWeight(liveTM, set.goalReps, set.goalRPE);
        if (newGoalWeight !== set.goalWeight) {
          updates.push({ id: set.id, goalWeight: newGoalWeight });
        }
      }
    }

    // Batch write only changed sets
    if (updates.length > 0) {
      await Promise.all(
        updates.map((u) => db.sets.update(u.id, { goalWeight: u.goalWeight })),
      );
    }
  }

  // Query previous week's best top set for each primary lift day
  const prevWeekBests = useLiveQuery(
    async () => {
      if (!settings || settings.currentWeek <= 1) return {};
      const prevWeek = settings.currentWeek - 1;
      const prevSessions = await db.sessions
        .where({ blockType: settings.currentBlockType, weekNumber: prevWeek })
        .toArray();
      if (prevSessions.length === 0) return {};

      const prevSessionIds = prevSessions.map((s) => s.id);
      const prevSets = await db.sets.where('sessionId').anyOf(prevSessionIds).toArray();

      const bests: Record<number, { weight: number; reps: number; rpe: number; e1rm: number }> = {};
      for (const sess of prevSessions) {
        const topSets = prevSets.filter(
          (s) => s.sessionId === sess.id &&
            (s.setType === 'top' || s.setType === 'backoff' || s.setType === 'volume') &&
            s.actualWeight != null && s.actualReps != null && s.actualRPE != null,
        );
        const best = findBestSet(topSets);
        if (best && best.actualWeight && best.actualReps && best.actualRPE) {
          bests[sess.dayNumber] = {
            weight: best.actualWeight,
            reps: best.actualReps,
            rpe: best.actualRPE,
            e1rm: best.e1rm ?? 0,
          };
        }
      }
      return bests;
    },
    [settings?.currentBlockType, settings?.currentWeek],
  );

  function getSetsForDay(dayNumber: DayNumber): WorkoutSet[] {
    if (!sessions || !allSets) return [];
    const session = sessions.find((s) => s.dayNumber === dayNumber);
    if (!session) return [];
    return allSets
      .filter((s) => s.sessionId === session.id)
      .sort((a, b) => a.setNumber - b.setNumber);
  }

  return {
    sessions: sessions ?? [],
    allSets: allSets ?? [],
    prevWeekBests: prevWeekBests ?? {},
    getOrCreateSession,
    recalculateGoalWeights,
    updateSet,
    updateNotes,
    addSet,
    swapExercise,
    completeSession,
    getSetsForDay,
    findBestSet,
  };
}
