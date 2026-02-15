export type BlockType = 'linear-6' | 'linear-8' | 'linear-4' | 'dup-6' | 'wave-6';

export type Phase = 'accumulation' | 'transmutation' | 'realization' | 'deload';

export type SetType = 'top' | 'backoff' | 'volume' | 'secondary' | 'accessory' | 'optional';

export type DayNumber = 1 | 2 | 3 | 4 | 5;

export type PrimaryLift = 'squat' | 'bench' | 'deadlift';

export type ExerciseCategory =
  | 'squat-primary' | 'squat-secondary'
  | 'bench-primary' | 'bench-secondary'
  | 'deadlift-primary' | 'deadlift-secondary'
  | 'horizontal-row' | 'vertical-pull'
  | 'quad-accessory' | 'posterior-chain'
  | 'triceps' | 'biceps'
  | 'core' | 'shoulders-press' | 'shoulders-isolation'
  | 'chest-accessory' | 'calves-misc' | 'explosive';

export interface UserSettings {
  id: string;
  squat1RM: number;
  bench1RM: number;
  deadlift1RM: number;
  squatGoal: number;
  benchGoal: number;
  deadliftGoal: number;
  trainingMaxPercent: number;
  currentBlockType: BlockType;
  currentWeek: number;
  barWeight: number;
  availablePlates: number[];
  theme: 'dark' | 'light' | 'system';
  restTimerDefault: number;
}

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
}

export interface PeriodizationTemplate {
  id: string;
  blockType: BlockType;
  weekNumber: number;
  phase: Phase;
  topSets: number;
  topReps: number;
  topRPE: number;
  backoffSets: number;
  backoffReps: number;
  backoffRPE: number;
  secondarySets: number;
  secondaryReps: number;
  secondaryRPE: number;
  accessorySets: number;
  accessoryReps: number;
  accessoryRPE: number;
}

export interface WorkoutSession {
  id: string;
  date: string;
  blockType: BlockType;
  weekNumber: number;
  phase: Phase;
  dayNumber: DayNumber;
  primaryLift: PrimaryLift;
  completed: boolean;
  notes?: string;
}

export interface WorkoutSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  setType: SetType;
  setNumber: number;
  goalWeight: number;
  goalReps: number;
  goalRPE: number;
  actualWeight: number | null;
  actualReps: number | null;
  actualRPE: number | null;
  e1rm: number | null;
  percentOfTM: number | null;
  tonnage: number | null;
  /** Category hint for ExercisePicker filtering when swapping */
  category?: ExerciseCategory | null;
  /** User notes for this exercise group */
  notes?: string;
}

export interface ProgressionEntry {
  id: string;
  date: string;
  weekNumber: number;
  blockType: BlockType;
  phase: Phase;
  squatWeight: number | null;
  squatReps: number | null;
  squatRPE: number | null;
  squatE1RM: number | null;
  benchWeight: number | null;
  benchReps: number | null;
  benchRPE: number | null;
  benchE1RM: number | null;
  deadliftWeight: number | null;
  deadliftReps: number | null;
  deadliftRPE: number | null;
  deadliftE1RM: number | null;
  totalE1RM: number | null;
}

export interface ExercisePR {
  id: string;
  exerciseId: string;
  exerciseName: string;
  bestWeight: number;
  bestReps: number;
  bestRPE: number;
  bestTonnage: number;
  bestE1RM: number;
  bestDate: string;
  lastWeight: number;
  lastReps: number;
  lastRPE: number;
  lastTonnage: number;
  lastDate: string;
}

export const BLOCK_MAX_WEEKS: Record<BlockType, number> = {
  'linear-8': 8,
  'linear-6': 6,
  'linear-4': 4,
  'dup-6': 6,
  'wave-6': 6,
};

export const BLOCK_TYPES: BlockType[] = ['linear-8', 'linear-6', 'linear-4', 'dup-6', 'wave-6'];

export const BLOCK_LABELS: Record<BlockType, string> = {
  'linear-6': 'Linear 6-Week',
  'linear-8': 'Linear 8-Week',
  'linear-4': 'Linear 4-Week',
  'dup-6': 'DUP 6-Week',
  'wave-6': 'Wave 6-Week',
};

export const PHASE_LABELS: Record<Phase, string> = {
  accumulation: 'Accumulation',
  transmutation: 'Transmutation',
  realization: 'Realization',
  deload: 'Deload',
};

export const LIFT_LABELS: Record<PrimaryLift, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
};

export interface DayConfig {
  dayNumber: DayNumber;
  label: string;
  shortLabel: string;
  primaryLift: PrimaryLift;
  isVolume: boolean;
}

export const DAY_CONFIG: DayConfig[] = [
  { dayNumber: 1, label: 'Day 1 — Bench',    shortLabel: 'D1 Bench', primaryLift: 'bench',    isVolume: false },
  { dayNumber: 2, label: 'Day 2 — Squat',    shortLabel: 'D2 Squat', primaryLift: 'squat',    isVolume: false },
  { dayNumber: 3, label: 'Day 3 — Upper Vol', shortLabel: 'D3 Upper', primaryLift: 'bench',    isVolume: true },
  { dayNumber: 4, label: 'Day 4 — Deadlift', shortLabel: 'D4 Dead',  primaryLift: 'deadlift', isVolume: false },
  { dayNumber: 5, label: 'Day 5 — Upper',    shortLabel: 'D5 Upper', primaryLift: 'bench',    isVolume: true },
];
