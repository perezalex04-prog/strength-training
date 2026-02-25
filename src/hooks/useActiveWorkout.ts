import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { generateWorkoutSets } from '@/engine/periodization';
import { computeSetDerived, updateExercisePRs, findBestSet, createProgressionSnapshot } from '@/engine/progression';
import { calculateAutoregulatedBackoff, checkForNewPR } from '@/engine/autoregulation';
import type { UserSettings, WorkoutSession, WorkoutSet, DayNumber, PrimaryLift } from '@/db/types';
import { getDayConfigForBlock } from '@/db/types';

export interface OneRMUpdate {
  lift: string;
  old: number;
  new: number;
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

  async function swapExercise(setIds: string[], exerciseId: string, exerciseName: string) {
    await Promise.all(
      setIds.map((id) => db.sets.update(id, { exerciseId, exerciseName })),
    );
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
    updateSet,
    updateNotes,
    swapExercise,
    completeSession,
    getSetsForDay,
    findBestSet,
  };
}
