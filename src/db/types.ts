export type BlockType = 'linear-6' | 'linear-8' | 'linear-4' | 'dup-6' | 'wave-6' | 'conj-4' | 'peak-8' | 'texas-4' | 'block-12' | 'calgary-16' | 'sheiko-4' | 'gzcl-4' | 'rts-4' | 'bryant-6';

export type Phase = 'accumulation' | 'transmutation' | 'realization' | 'deload' | 'comp prep' | 'peak' | 'taper' | 'meet week';

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
  /** Cycle counter — incremented each time the user completes a block and resets to week 1 */
  blockCycle: number;
  barWeight: number;
  availablePlates: number[];
  theme: 'dark' | 'light' | 'system';
  restTimerDefault: number;
  microPlates?: boolean;
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
  /** Volume-day overrides (DUP/Conjugate) — if present, volume days use these instead */
  volumeTopSets?: number;
  volumeTopReps?: number;
  volumeTopRPE?: number;
  /** Direct percentage of training max for speed/DE work (e.g. 0.55 = 55%) */
  volumeTopPercent?: number;
  volumeBackoffSets?: number;
  volumeBackoffReps?: number;
  volumeBackoffRPE?: number;
}

export interface WorkoutSession {
  id: string;
  date: string;
  blockType: BlockType;
  weekNumber: number;
  /** Which cycle of this block (increments on "Complete Block") */
  blockCycle: number;
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
  'conj-4': 4,
  'peak-8': 8,
  'texas-4': 4,
  'block-12': 12,
  'calgary-16': 16,
  'sheiko-4': 4,
  'gzcl-4': 4,
  'rts-4': 4,
  'bryant-6': 6,
};

export const BLOCK_TYPES: BlockType[] = ['linear-8', 'linear-6', 'linear-4', 'dup-6', 'wave-6', 'conj-4', 'texas-4', 'block-12', 'peak-8', 'calgary-16', 'sheiko-4', 'gzcl-4', 'rts-4', 'bryant-6'];

export const BLOCK_LABELS: Record<BlockType, string> = {
  'linear-6': 'Linear 6-Week',
  'linear-8': 'Linear 8-Week',
  'linear-4': '5/3/1 (Wendler)',
  'dup-6': 'DUP 6-Week',
  'wave-6': 'Wave 6-Week',
  'conj-4': 'Westside 4-Week',
  'peak-8': 'Meet Peak 8-Week',
  'texas-4': 'Texas Method',
  'block-12': 'Block Periodization 12-Wk',
  'calgary-16': 'Calgary Barbell 16-Wk',
  'sheiko-4': 'Sheiko (4-Wk Meso)',
  'gzcl-4': 'GZCL Jacked & Tan',
  'rts-4': 'RTS Gen. Intermediate',
  'bryant-6': 'Bryant Powerbuilding 1-10-1',
};

export const PHASE_LABELS: Record<Phase, string> = {
  accumulation: 'Accumulation',
  transmutation: 'Transmutation',
  realization: 'Realization',
  deload: 'Deload',
  'comp prep': 'Comp Prep',
  peak: 'Peak',
  taper: 'Taper',
  'meet week': 'Meet Week',
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

const CONJ_DAY_CONFIG: DayConfig[] = [
  { dayNumber: 1, label: 'Day 1 — ME Upper', shortLabel: 'ME Upper', primaryLift: 'bench', isVolume: false },
  { dayNumber: 2, label: 'Day 2 — ME Lower', shortLabel: 'ME Lower', primaryLift: 'squat', isVolume: false },
  { dayNumber: 3, label: 'Day 3 — DE Upper', shortLabel: 'DE Upper', primaryLift: 'bench', isVolume: true },
  { dayNumber: 4, label: 'Day 4 — DE Lower', shortLabel: 'DE Lower', primaryLift: 'squat', isVolume: true },
];

const WENDLER_DAY_CONFIG: DayConfig[] = [
  { dayNumber: 1, label: 'Day 1 — Squat', shortLabel: 'D1 Squat', primaryLift: 'squat', isVolume: false },
  { dayNumber: 2, label: 'Day 2 — Bench', shortLabel: 'D2 Bench', primaryLift: 'bench', isVolume: false },
  { dayNumber: 3, label: 'Day 3 — Deadlift', shortLabel: 'D3 Dead', primaryLift: 'deadlift', isVolume: false },
  { dayNumber: 4, label: 'Day 4 — OHP', shortLabel: 'D4 OHP', primaryLift: 'bench', isVolume: false },
];

const TEXAS_DAY_CONFIG: DayConfig[] = [
  { dayNumber: 1, label: 'Day 1 — Volume', shortLabel: 'Volume', primaryLift: 'squat', isVolume: true },
  { dayNumber: 2, label: 'Day 2 — Recovery', shortLabel: 'Recovery', primaryLift: 'bench', isVolume: true },
  { dayNumber: 3, label: 'Day 3 — Intensity', shortLabel: 'Intensity', primaryLift: 'deadlift', isVolume: false },
];

const CALGARY_DAY_CONFIG: DayConfig[] = [
  { dayNumber: 1, label: 'Day 1 — SQ/BN', shortLabel: 'D1 SQ/BN', primaryLift: 'squat', isVolume: false },
  { dayNumber: 2, label: 'Day 2 — DL/BN', shortLabel: 'D2 DL/BN', primaryLift: 'deadlift', isVolume: false },
  { dayNumber: 3, label: 'Day 3 — Variation', shortLabel: 'D3 Var', primaryLift: 'squat', isVolume: false },
  { dayNumber: 4, label: 'Day 4 — Volume', shortLabel: 'D4 Vol', primaryLift: 'deadlift', isVolume: false },
];

const SHEIKO_DAY_CONFIG: DayConfig[] = [
  { dayNumber: 1, label: 'Day 1 — Squat/Bench', shortLabel: 'D1 SQ/BN', primaryLift: 'squat', isVolume: false },
  { dayNumber: 2, label: 'Day 2 — Bench/Dead', shortLabel: 'D2 BN/DL', primaryLift: 'bench', isVolume: false },
  { dayNumber: 3, label: 'Day 3 — Squat/Bench', shortLabel: 'D3 SQ/BN', primaryLift: 'squat', isVolume: true },
  { dayNumber: 4, label: 'Day 4 — Dead/Bench', shortLabel: 'D4 DL/BN', primaryLift: 'deadlift', isVolume: true },
];

const GZCL_DAY_CONFIG: DayConfig[] = [
  { dayNumber: 1, label: 'Day 1 — T1 Squat', shortLabel: 'T1 Squat', primaryLift: 'squat', isVolume: false },
  { dayNumber: 2, label: 'Day 2 — T1 Bench', shortLabel: 'T1 Bench', primaryLift: 'bench', isVolume: false },
  { dayNumber: 3, label: 'Day 3 — T1 Deadlift', shortLabel: 'T1 Dead', primaryLift: 'deadlift', isVolume: false },
  { dayNumber: 4, label: 'Day 4 — T1 OHP', shortLabel: 'T1 OHP', primaryLift: 'bench', isVolume: false },
];

const RTS_DAY_CONFIG: DayConfig[] = [
  { dayNumber: 1, label: 'Day 1 — Squat', shortLabel: 'D1 Squat', primaryLift: 'squat', isVolume: false },
  { dayNumber: 2, label: 'Day 2 — Bench', shortLabel: 'D2 Bench', primaryLift: 'bench', isVolume: false },
  { dayNumber: 3, label: 'Day 3 — Deadlift', shortLabel: 'D3 Dead', primaryLift: 'deadlift', isVolume: false },
  { dayNumber: 4, label: 'Day 4 — Bench 2', shortLabel: 'D4 Bench', primaryLift: 'bench', isVolume: false },
];

/** Bryant Powerbuilding 1-10-1 — 4 days (3 required + 1 optional conditioning).
 *  D1 Squat, D2 Bench, D3 Trap-Bar DL focus, D4 Conditioning (optional).
 *  Main lifts use ramping singles; accessories use Chuck Sipes pyramid (1→10→1 = 19 sets, 100 reps). */
const BRYANT_DAY_CONFIG: DayConfig[] = [
  { dayNumber: 1, label: 'Day 1 — Squat (Lower)', shortLabel: 'D1 Squat', primaryLift: 'squat', isVolume: false },
  { dayNumber: 2, label: 'Day 2 — Bench (Upper)', shortLabel: 'D2 Bench', primaryLift: 'bench', isVolume: false },
  { dayNumber: 3, label: 'Day 3 — Trap-Bar DL', shortLabel: 'D3 TBar', primaryLift: 'deadlift', isVolume: false },
  { dayNumber: 4, label: 'Day 4 — Conditioning', shortLabel: 'D4 Cond', primaryLift: 'deadlift', isVolume: true },
];

export function getDayConfigForBlock(blockType: BlockType): DayConfig[] {
  if (blockType === 'conj-4') return CONJ_DAY_CONFIG;
  if (blockType === 'linear-4') return WENDLER_DAY_CONFIG;
  if (blockType === 'texas-4') return TEXAS_DAY_CONFIG;
  if (blockType === 'calgary-16') return CALGARY_DAY_CONFIG;
  if (blockType === 'sheiko-4') return SHEIKO_DAY_CONFIG;
  if (blockType === 'gzcl-4') return GZCL_DAY_CONFIG;
  if (blockType === 'rts-4') return RTS_DAY_CONFIG;
  if (blockType === 'bryant-6') return BRYANT_DAY_CONFIG;
  return DAY_CONFIG;
}
