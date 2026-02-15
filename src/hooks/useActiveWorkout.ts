import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { generateWorkoutSets } from '@/engine/periodization';
import { computeSetDerived, updateExercisePRs, findBestSet, createProgressionSnapshot } from '@/engine/progression';
import type { UserSettings, WorkoutSession, WorkoutSet, DayNumber, PrimaryLift } from '@/db/types';
import { DAY_CONFIG } from '@/db/types';

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
    const day = DAY_CONFIG.find((d) => d.dayNumber === dayNumber)!;

    // Check IndexedDB DIRECTLY — not the stale React sessions array
    // This prevents the race condition where remounting overwrites existing data
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
  }

  async function swapExercise(setIds: string[], exerciseId: string, exerciseName: string) {
    await Promise.all(
      setIds.map((id) => db.sets.update(id, { exerciseId, exerciseName })),
    );
  }

  async function completeSession(sessionId: string) {
    const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
    const session = await db.sessions.get(sessionId);
    if (!session || !settings) return;

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
  }

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
    getOrCreateSession,
    updateSet,
    swapExercise,
    completeSession,
    getSetsForDay,
    findBestSet,
  };
}
