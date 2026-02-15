import Dexie, { type Table } from 'dexie';
import type {
  UserSettings,
  Exercise,
  PeriodizationTemplate,
  WorkoutSession,
  WorkoutSet,
  ProgressionEntry,
  ExercisePR,
} from './types';

export class StrengthDB extends Dexie {
  settings!: Table<UserSettings, string>;
  exercises!: Table<Exercise, string>;
  templates!: Table<PeriodizationTemplate, string>;
  sessions!: Table<WorkoutSession, string>;
  sets!: Table<WorkoutSet, string>;
  progression!: Table<ProgressionEntry, string>;
  exercisePRs!: Table<ExercisePR, string>;

  constructor() {
    super('StrengthTracker');
    this.version(1).stores({
      settings: 'id',
      exercises: 'id, name, category',
      templates: 'id, [blockType+weekNumber]',
      sessions: 'id, date, [blockType+weekNumber], dayNumber, completed',
      sets: 'id, sessionId, exerciseId, setType',
      progression: 'id, date, weekNumber',
      exercisePRs: 'id, exerciseId, exerciseName',
    });
  }
}

export const db = new StrengthDB();
