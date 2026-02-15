import { db } from '@/db/database';

interface ExportPayload {
  version: 1;
  exportedAt: string;
  settings: any;
  sessions: any[];
  sets: any[];
  progression: any[];
  exercisePRs: any[];
}

export async function exportAllData(): Promise<string> {
  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: await db.settings.get('singleton'),
    sessions: await db.sessions.toArray(),
    sets: await db.sets.toArray(),
    progression: await db.progression.toArray(),
    exercisePRs: await db.exercisePRs.toArray(),
  };
  return JSON.stringify(payload, null, 2);
}

export async function importAllData(json: string): Promise<void> {
  const payload: ExportPayload = JSON.parse(json);
  if (payload.version !== 1) {
    throw new Error(`Unsupported export version: ${payload.version}`);
  }

  await db.transaction(
    'rw',
    [db.settings, db.sessions, db.sets, db.progression, db.exercisePRs],
    async () => {
      if (payload.settings) await db.settings.put(payload.settings);
      if (payload.sessions?.length) await db.sessions.bulkPut(payload.sessions);
      if (payload.sets?.length) await db.sets.bulkPut(payload.sets);
      if (payload.progression?.length) await db.progression.bulkPut(payload.progression);
      if (payload.exercisePRs?.length) await db.exercisePRs.bulkPut(payload.exercisePRs);
    },
  );
}
