import { db } from '@/db/database';
import type {
  BlockType,
  DayNumber,
  PrimaryLift,
  WorkoutSet,
  ExerciseCategory,
} from '@/db/types';
import { calculateGoalWeight, roundTo5 } from './e1rm';
import { getLastWeight, calculateFatigueMultiplier, calculateVolumeAdjustment } from './autoregulation';

interface SlotDef {
  name: string;
  category: ExerciseCategory;
}

const DAY_EXERCISE_DEFAULTS: Record<DayNumber, { secondaries: SlotDef[]; accessories: SlotDef[] }> = {
  1: {
    secondaries: [
      { name: 'Incline Bench', category: 'bench-secondary' },
      { name: 'Barbell Row', category: 'horizontal-row' },
    ],
    accessories: [
      { name: 'Tricep Pushdown (rope)', category: 'triceps' },
      { name: 'Face Pull', category: 'shoulders-isolation' },
      { name: 'Spider Curl', category: 'biceps' },
    ],
  },
  2: {
    secondaries: [
      { name: 'Deficit Deadlift (1")', category: 'deadlift-secondary' },
    ],
    accessories: [
      { name: 'Leg Press', category: 'quad-accessory' },
      { name: 'Nordic Curl', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
    ],
  },
  3: {
    secondaries: [
      { name: 'Overhead Press', category: 'shoulders-press' },
      { name: 'Weighted Pull-up', category: 'vertical-pull' },
    ],
    accessories: [
      { name: 'Cable Row', category: 'horizontal-row' },
      { name: 'Lateral Raise', category: 'shoulders-isolation' },
      { name: 'DB Curl', category: 'biceps' },
    ],
  },
  4: {
    secondaries: [
      { name: 'Banded Box Squat', category: 'squat-secondary' },
    ],
    accessories: [
      { name: 'Reverse Hyper', category: 'posterior-chain' },
      { name: 'Leg Press', category: 'quad-accessory' },
      { name: 'GHR', category: 'posterior-chain' },
    ],
  },
  5: {
    secondaries: [
      { name: 'DB Shoulder Press', category: 'shoulders-press' },
    ],
    accessories: [
      { name: 'Overhead Tricep Ext (cable)', category: 'triceps' },
      { name: 'Cable Fly (low)', category: 'chest-accessory' },
      { name: 'Cable Curl', category: 'biceps' },
    ],
  },
};

const PRIMARY_EXERCISES: Record<DayNumber, { name: string; category: ExerciseCategory }> = {
  1: { name: 'Competition Bench', category: 'bench-primary' },
  2: { name: 'Competition Back Squat', category: 'squat-primary' },
  3: { name: 'Competition Bench', category: 'bench-primary' },
  4: { name: 'Competition Deadlift', category: 'deadlift-primary' },
  5: { name: 'Banded Bench', category: 'bench-primary' },
};

// === 5/3/1 (Wendler) constants ===
const WENDLER_SETS: Record<number, { percent: number; reps: number }[]> = {
  1: [{ percent: 0.65, reps: 5 }, { percent: 0.75, reps: 5 }, { percent: 0.85, reps: 5 }],   // 5s week
  2: [{ percent: 0.70, reps: 3 }, { percent: 0.80, reps: 3 }, { percent: 0.90, reps: 3 }],   // 3s week
  3: [{ percent: 0.75, reps: 5 }, { percent: 0.85, reps: 3 }, { percent: 0.95, reps: 1 }],   // 5/3/1 week
  4: [{ percent: 0.40, reps: 5 }, { percent: 0.50, reps: 5 }, { percent: 0.60, reps: 5 }],   // deload
};
const OHP_TM_MULTIPLIER = 0.65;
const BBB_PERCENT = 0.55;

// 5/3/1 4-day exercise maps
const WENDLER_PRIMARY_EXERCISES: Partial<Record<DayNumber, { name: string; category: ExerciseCategory }>> = {
  1: { name: 'Competition Back Squat', category: 'squat-primary' },
  2: { name: 'Competition Bench', category: 'bench-primary' },
  3: { name: 'Competition Deadlift', category: 'deadlift-primary' },
  4: { name: 'Overhead Press', category: 'shoulders-press' },
};

const WENDLER_DAY_EXERCISE_DEFAULTS: Partial<Record<DayNumber, { secondaries: SlotDef[]; accessories: SlotDef[] }>> = {
  1: { // Squat day — push/pull/legs assistance
    secondaries: [
      { name: 'Leg Press', category: 'quad-accessory' },
    ],
    accessories: [
      { name: 'Nordic Curl', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
      { name: 'DB Curl', category: 'biceps' },
    ],
  },
  2: { // Bench day — push/pull assistance
    secondaries: [
      { name: 'Incline Bench', category: 'bench-secondary' },
      { name: 'Barbell Row', category: 'horizontal-row' },
    ],
    accessories: [
      { name: 'Tricep Pushdown (rope)', category: 'triceps' },
      { name: 'Face Pull', category: 'shoulders-isolation' },
      { name: 'Spider Curl', category: 'biceps' },
    ],
  },
  3: { // Deadlift day — posterior chain assistance
    secondaries: [
      { name: 'Good Morning', category: 'posterior-chain' },
    ],
    accessories: [
      { name: 'GHR', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
      { name: 'Leg Press', category: 'quad-accessory' },
    ],
  },
  4: { // OHP day — shoulder/upper assistance
    secondaries: [
      { name: 'DB Shoulder Press', category: 'shoulders-press' },
      { name: 'Weighted Pull-up', category: 'vertical-pull' },
    ],
    accessories: [
      { name: 'Lateral Raise', category: 'shoulders-isolation' },
      { name: 'Overhead Tricep Ext (cable)', category: 'triceps' },
      { name: 'Cable Curl', category: 'biceps' },
    ],
  },
};

// Texas Method 3-day exercise maps
const TEXAS_PRIMARY_EXERCISES: Partial<Record<DayNumber, { name: string; category: ExerciseCategory }>> = {
  1: { name: 'Competition Back Squat', category: 'squat-primary' },   // Volume
  2: { name: 'Competition Bench', category: 'bench-primary' },        // Recovery
  3: { name: 'Competition Deadlift', category: 'deadlift-primary' },  // Intensity
};

const TEXAS_DAY_EXERCISE_DEFAULTS: Partial<Record<DayNumber, { secondaries: SlotDef[]; accessories: SlotDef[] }>> = {
  1: { // Volume day — heavy squats + bench volume
    secondaries: [
      { name: 'Competition Bench', category: 'bench-primary' },
      { name: 'Barbell Row', category: 'horizontal-row' },
    ],
    accessories: [
      { name: 'Leg Press', category: 'quad-accessory' },
      { name: 'GHR', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
    ],
  },
  2: { // Recovery day — light bench + OHP + pulls
    secondaries: [
      { name: 'Overhead Press', category: 'shoulders-press' },
      { name: 'Weighted Pull-up', category: 'vertical-pull' },
    ],
    accessories: [
      { name: 'Face Pull', category: 'shoulders-isolation' },
      { name: 'Tricep Pushdown (rope)', category: 'triceps' },
      { name: 'DB Curl', category: 'biceps' },
    ],
  },
  3: { // Intensity day — heavy deadlift + heavy squat
    secondaries: [
      { name: 'Competition Back Squat', category: 'squat-primary' },
    ],
    accessories: [
      { name: 'Reverse Hyper', category: 'posterior-chain' },
      { name: 'Nordic Curl', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
    ],
  },
};

// Westside DE Lower speed pull config — explosive singles at % of deadlift TM
const CONJ_SPEED_PULL: Record<number, { sets: number; reps: number; percent: number }> = {
  1: { sets: 6, reps: 1, percent: 0.60 },
  2: { sets: 6, reps: 1, percent: 0.65 },
  3: { sets: 8, reps: 1, percent: 0.70 },
  4: { sets: 4, reps: 1, percent: 0.50 },  // deload
};

// Westside Conjugate 4-day exercise maps
const CONJ_PRIMARY_EXERCISES: Partial<Record<DayNumber, { name: string; category: ExerciseCategory }>> = {
  1: { name: 'Competition Bench', category: 'bench-primary' },       // ME Upper
  2: { name: 'Competition Back Squat', category: 'squat-primary' },  // ME Lower
  3: { name: 'Banded Bench', category: 'bench-primary' },            // DE Upper
  4: { name: 'Banded Squat', category: 'squat-primary' },              // DE Lower
};

const CONJ_DAY_EXERCISE_DEFAULTS: Partial<Record<DayNumber, { secondaries: SlotDef[]; accessories: SlotDef[] }>> = {
  1: { // ME Upper — heavy supplemental bench + rows, tricep-heavy accessories
    secondaries: [
      { name: 'Close Grip Bench', category: 'bench-secondary' },
      { name: 'Barbell Row', category: 'horizontal-row' },
    ],
    accessories: [
      { name: 'JM Press', category: 'triceps' },
      { name: 'Face Pull', category: 'shoulders-isolation' },
      { name: 'Spider Curl', category: 'biceps' },
    ],
  },
  2: { // ME Lower — posterior chain supplemental, Reverse Hyper + GHR
    secondaries: [
      { name: 'Deficit Deadlift (1")', category: 'deadlift-secondary' },
    ],
    accessories: [
      { name: 'Reverse Hyper', category: 'posterior-chain' },
      { name: 'GHR', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
    ],
  },
  3: { // DE Upper — lockout supplemental, rows, tricep-heavy accessories
    secondaries: [
      { name: 'Floor Press', category: 'bench-secondary' },
      { name: 'Weighted Pull-up', category: 'vertical-pull' },
    ],
    accessories: [
      { name: 'Skull Crushers', category: 'triceps' },
      { name: 'Face Pull', category: 'shoulders-isolation' },
      { name: 'Cable Curl', category: 'biceps' },
    ],
  },
  4: { // DE Lower — speed pulls + Good Mornings, Reverse Hyper + GHR (the Westside staples)
    secondaries: [
      { name: 'Competition Deadlift', category: 'deadlift-primary' },
      { name: 'Good Morning', category: 'posterior-chain' },
    ],
    accessories: [
      { name: 'Reverse Hyper', category: 'posterior-chain' },
      { name: 'GHR', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
    ],
  },
};

// === Calgary Barbell 16-Week ===
// Percentage-based loading config matching Bryce Krawczyk's programming
// D1: Squat + Bench (intensity), D2: Deadlift + Bench (secondary), D3: Variation, D4: Volume/Tempo
interface CBBWeekConfig {
  phase: string;
  // D1/D2 main competition lifts (% of TM) — RPE-only when percent is null
  main: { sets: number; reps: number; percent: number | null; rpe?: number };
  backoff: { sets: number; reps: number; percent: number } | null;
  // D3 variation day
  variation: { sets: number; reps: number; percent: number };
  // D4 tempo/volume day
  tempo: { sets: number; reps: number; percent: number };
  tngBench: { sets: number; reps: number; percent: number } | null;
  // Accessory volume (shrinks through phases)
  secondarySets: number;
  accessorySets: number;
}

const CBB_CONFIG: Record<number, CBBWeekConfig> = {
  // Phase 1 — Accumulation (Weeks 1-4): Straight sets, no backoffs
  1:  { phase: 'accumulation', main: { sets: 4, reps: 7, percent: 0.64 }, backoff: null, variation: { sets: 3, reps: 6, percent: 0.62 }, tempo: { sets: 3, reps: 6, percent: 0.60 }, tngBench: { sets: 4, reps: 10, percent: 0.60 }, secondarySets: 3, accessorySets: 3 },
  2:  { phase: 'accumulation', main: { sets: 4, reps: 6, percent: 0.67 }, backoff: null, variation: { sets: 3, reps: 6, percent: 0.63 }, tempo: { sets: 3, reps: 6, percent: 0.62 }, tngBench: { sets: 4, reps: 8,  percent: 0.62 }, secondarySets: 3, accessorySets: 3 },
  3:  { phase: 'accumulation', main: { sets: 4, reps: 6, percent: 0.69 }, backoff: null, variation: { sets: 3, reps: 6, percent: 0.64 }, tempo: { sets: 3, reps: 6, percent: 0.63 }, tngBench: { sets: 4, reps: 8,  percent: 0.64 }, secondarySets: 3, accessorySets: 3 },
  4:  { phase: 'accumulation', main: { sets: 5, reps: 5, percent: 0.71 }, backoff: null, variation: { sets: 3, reps: 5, percent: 0.66 }, tempo: { sets: 3, reps: 5, percent: 0.65 }, tngBench: { sets: 4, reps: 6,  percent: 0.66 }, secondarySets: 3, accessorySets: 3 },
  // Phase 2 — Intensity (Weeks 5-8): Top sets + backoff sets
  5:  { phase: 'transmutation', main: { sets: 3, reps: 3, percent: 0.76 }, backoff: { sets: 2, reps: 5, percent: 0.65 }, variation: { sets: 3, reps: 4, percent: 0.68 }, tempo: { sets: 3, reps: 4, percent: 0.65 }, tngBench: { sets: 3, reps: 8, percent: 0.62 }, secondarySets: 3, accessorySets: 3 },
  6:  { phase: 'transmutation', main: { sets: 4, reps: 3, percent: 0.78 }, backoff: { sets: 2, reps: 5, percent: 0.67 }, variation: { sets: 4, reps: 4, percent: 0.70 }, tempo: { sets: 3, reps: 4, percent: 0.67 }, tngBench: { sets: 3, reps: 6, percent: 0.65 }, secondarySets: 3, accessorySets: 3 },
  7:  { phase: 'transmutation', main: { sets: 4, reps: 2, percent: 0.81 }, backoff: { sets: 2, reps: 5, percent: 0.69 }, variation: { sets: 4, reps: 3, percent: 0.72 }, tempo: { sets: 3, reps: 3, percent: 0.69 }, tngBench: { sets: 3, reps: 6, percent: 0.67 }, secondarySets: 3, accessorySets: 3 },
  8:  { phase: 'transmutation', main: { sets: 4, reps: 3, percent: 0.85 }, backoff: { sets: 3, reps: 4, percent: 0.75 }, variation: { sets: 3, reps: 3, percent: 0.74 }, tempo: { sets: 3, reps: 3, percent: 0.71 }, tngBench: { sets: 3, reps: 6, percent: 0.69 }, secondarySets: 3, accessorySets: 3 },
  // Phase 3 — Competition Prep (Weeks 9-11): Increasing specificity
  9:  { phase: 'comp prep', main: { sets: 5, reps: 4, percent: 0.78 }, backoff: { sets: 2, reps: 4, percent: 0.67 }, variation: { sets: 3, reps: 4, percent: 0.70 }, tempo: { sets: 3, reps: 4, percent: 0.67 }, tngBench: { sets: 3, reps: 6, percent: 0.65 }, secondarySets: 3, accessorySets: 2 },
  10: { phase: 'comp prep', main: { sets: 6, reps: 4, percent: 0.81 }, backoff: { sets: 2, reps: 4, percent: 0.69 }, variation: { sets: 3, reps: 3, percent: 0.73 }, tempo: { sets: 3, reps: 3, percent: 0.70 }, tngBench: { sets: 3, reps: 5, percent: 0.67 }, secondarySets: 3, accessorySets: 2 },
  11: { phase: 'comp prep', main: { sets: 1, reps: 1, percent: null, rpe: 8.0 }, backoff: { sets: 3, reps: 3, percent: 0.83 }, variation: { sets: 2, reps: 3, percent: 0.75 }, tempo: { sets: 2, reps: 3, percent: 0.72 }, tngBench: { sets: 2, reps: 5, percent: 0.67 }, secondarySets: 3, accessorySets: 2 },
  // Phase 4 — Peaking/Taper (Weeks 12-16): RPE singles + decreasing backoff volume
  12: { phase: 'peak', main: { sets: 1, reps: 3, percent: null, rpe: 8.0 }, backoff: { sets: 6, reps: 5, percent: 0.63 }, variation: { sets: 2, reps: 3, percent: 0.68 }, tempo: { sets: 2, reps: 3, percent: 0.65 }, tngBench: { sets: 2, reps: 6, percent: 0.60 }, secondarySets: 2, accessorySets: 2 },
  13: { phase: 'peak', main: { sets: 1, reps: 2, percent: null, rpe: 8.0 }, backoff: { sets: 4, reps: 4, percent: 0.65 }, variation: { sets: 2, reps: 2, percent: 0.70 }, tempo: { sets: 2, reps: 2, percent: 0.67 }, tngBench: { sets: 2, reps: 5, percent: 0.62 }, secondarySets: 2, accessorySets: 2 },
  14: { phase: 'taper', main: { sets: 1, reps: 1, percent: null, rpe: 8.0 }, backoff: { sets: 3, reps: 3, percent: 0.70 }, variation: { sets: 0, reps: 0, percent: 0 }, tempo: { sets: 0, reps: 0, percent: 0 }, tngBench: null, secondarySets: 2, accessorySets: 1 },
  15: { phase: 'taper', main: { sets: 1, reps: 1, percent: null, rpe: 9.0 }, backoff: { sets: 3, reps: 2, percent: 0.80 }, variation: { sets: 0, reps: 0, percent: 0 }, tempo: { sets: 0, reps: 0, percent: 0 }, tngBench: null, secondarySets: 1, accessorySets: 0 },
  16: { phase: 'meet week', main: { sets: 1, reps: 1, percent: null, rpe: 10.0 }, backoff: { sets: 2, reps: 2, percent: 0.78 }, variation: { sets: 0, reps: 0, percent: 0 }, tempo: { sets: 0, reps: 0, percent: 0 }, tngBench: null, secondarySets: 0, accessorySets: 0 },
};

// CBB exercise slots per day (matching Bryce's real template)
const CBB_DAY_EXERCISES: Record<number, {
  primary: { name: string; category: ExerciseCategory };
  benchSlot: { name: string; category: ExerciseCategory } | null; // heavy bench on D1, secondary bench on D2
  secondaries: SlotDef[];
  accessories: SlotDef[];
}> = {
  1: { // D1: Competition Squat + Competition Bench (paused) — OHP, Bent Over Row, Back Extension
    primary: { name: 'Competition Back Squat', category: 'squat-primary' },
    benchSlot: { name: 'Competition Bench', category: 'bench-primary' },
    secondaries: [
      { name: 'Overhead Press', category: 'shoulders-press' },
      { name: 'Barbell Row', category: 'horizontal-row' },
    ],
    accessories: [
      { name: 'Back Extension', category: 'posterior-chain' },
    ],
  },
  2: { // D2: Competition Deadlift + Bench (lighter) — Front Squat, Cable Row
    primary: { name: 'Competition Deadlift', category: 'deadlift-primary' },
    benchSlot: { name: 'Competition Bench', category: 'bench-primary' },
    secondaries: [
      { name: 'Front Squat', category: 'squat-secondary' },
      { name: 'Cable Row', category: 'horizontal-row' },
    ],
    accessories: [],
  },
  3: { // D3: Pin Squat/Box Squat + Bench variation (Spoto/Board) — DB Row, Core
    primary: { name: 'Pin Squat', category: 'squat-secondary' },
    benchSlot: { name: 'Spoto Press', category: 'bench-secondary' },
    secondaries: [
      { name: 'DB Row', category: 'horizontal-row' },
    ],
    accessories: [
      { name: 'Bird Dog', category: 'core' },
    ],
  },
  4: { // D4: 2ct Pause Deadlift + TnG Bench (volume) — SLDL, Lat Pulldown, Skull Crushers
    primary: { name: 'Pause Deadlift', category: 'deadlift-secondary' },
    benchSlot: null, // TnG bench handled separately in generator
    secondaries: [
      { name: 'Stiff Leg Deadlift', category: 'posterior-chain' },
      { name: 'Lat Pulldown', category: 'vertical-pull' },
    ],
    accessories: [
      { name: 'Skull Crushers', category: 'triceps' },
    ],
  },
};

// === Sheiko 4-Week Mesocycle exercise maps ===
const SHEIKO_PRIMARY_EXERCISES: Partial<Record<DayNumber, { name: string; category: ExerciseCategory }>> = {
  1: { name: 'Competition Back Squat', category: 'squat-primary' },
  2: { name: 'Competition Bench', category: 'bench-primary' },
  3: { name: 'Competition Back Squat', category: 'squat-primary' },
  4: { name: 'Competition Deadlift', category: 'deadlift-primary' },
};

const SHEIKO_DAY_EXERCISE_DEFAULTS: Partial<Record<DayNumber, { secondaries: SlotDef[]; accessories: SlotDef[] }>> = {
  1: { // Squat + bench
    secondaries: [
      { name: 'Competition Bench', category: 'bench-primary' },
      { name: 'Pause Squat', category: 'squat-secondary' },
    ],
    accessories: [
      { name: 'GHR', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
    ],
  },
  2: { // Bench + deadlift
    secondaries: [
      { name: 'Close Grip Bench', category: 'bench-secondary' },
      { name: 'Deficit Deadlift (1")', category: 'deadlift-secondary' },
    ],
    accessories: [
      { name: 'Tricep Pushdown (rope)', category: 'triceps' },
      { name: 'Face Pull', category: 'shoulders-isolation' },
    ],
  },
  3: { // Squat + bench (volume)
    secondaries: [
      { name: 'Competition Bench', category: 'bench-primary' },
      { name: 'Front Squat', category: 'squat-secondary' },
    ],
    accessories: [
      { name: 'Leg Press', category: 'quad-accessory' },
      { name: 'Nordic Curl', category: 'posterior-chain' },
    ],
  },
  4: { // Deadlift + bench (volume)
    secondaries: [
      { name: 'Floor Press', category: 'bench-secondary' },
      { name: 'Block Pull (2")', category: 'deadlift-secondary' },
    ],
    accessories: [
      { name: 'Reverse Hyper', category: 'posterior-chain' },
      { name: 'Barbell Row', category: 'horizontal-row' },
    ],
  },
};

// === GZCL Jacked & Tan 2.0 exercise maps ===
const GZCL_PRIMARY_EXERCISES: Partial<Record<DayNumber, { name: string; category: ExerciseCategory }>> = {
  1: { name: 'Competition Back Squat', category: 'squat-primary' },
  2: { name: 'Competition Bench', category: 'bench-primary' },
  3: { name: 'Competition Deadlift', category: 'deadlift-primary' },
  4: { name: 'Overhead Press', category: 'shoulders-press' },
};
const GZCL_OHP_MULTIPLIER = 0.65;

const GZCL_DAY_EXERCISE_DEFAULTS: Partial<Record<DayNumber, { secondaries: SlotDef[]; accessories: SlotDef[] }>> = {
  1: { // T1 Squat — T2 front squat, T3 legs/abs
    secondaries: [
      { name: 'Front Squat', category: 'squat-secondary' },
      { name: 'Barbell Row', category: 'horizontal-row' },
    ],
    accessories: [
      { name: 'Leg Press', category: 'quad-accessory' },
      { name: 'Nordic Curl', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
    ],
  },
  2: { // T1 Bench — T2 incline, T3 push/pull
    secondaries: [
      { name: 'Incline Bench', category: 'bench-secondary' },
      { name: 'Weighted Pull-up', category: 'vertical-pull' },
    ],
    accessories: [
      { name: 'Tricep Pushdown (rope)', category: 'triceps' },
      { name: 'Face Pull', category: 'shoulders-isolation' },
      { name: 'Spider Curl', category: 'biceps' },
    ],
  },
  3: { // T1 Deadlift — T2 RDL, T3 posterior
    secondaries: [
      { name: 'Deficit Deadlift (1")', category: 'deadlift-secondary' },
      { name: 'Good Morning', category: 'posterior-chain' },
    ],
    accessories: [
      { name: 'GHR', category: 'posterior-chain' },
      { name: 'Leg Press', category: 'quad-accessory' },
      { name: 'Ab Wheel', category: 'core' },
    ],
  },
  4: { // T1 OHP — T2 DB press, T3 shoulders/arms
    secondaries: [
      { name: 'DB Shoulder Press', category: 'shoulders-press' },
      { name: 'Barbell Row', category: 'horizontal-row' },
    ],
    accessories: [
      { name: 'Lateral Raise', category: 'shoulders-isolation' },
      { name: 'Overhead Tricep Ext (cable)', category: 'triceps' },
      { name: 'Cable Curl', category: 'biceps' },
    ],
  },
};

// === RTS Generalized Intermediate exercise maps ===
const RTS_PRIMARY_EXERCISES: Partial<Record<DayNumber, { name: string; category: ExerciseCategory }>> = {
  1: { name: 'Competition Back Squat', category: 'squat-primary' },
  2: { name: 'Competition Bench', category: 'bench-primary' },
  3: { name: 'Competition Deadlift', category: 'deadlift-primary' },
  4: { name: 'Competition Bench', category: 'bench-primary' },  // 2nd bench day
};

const RTS_DAY_EXERCISE_DEFAULTS: Partial<Record<DayNumber, { secondaries: SlotDef[]; accessories: SlotDef[] }>> = {
  1: { // Squat — competition variations + posterior chain
    secondaries: [
      { name: 'Pause Squat', category: 'squat-secondary' },
    ],
    accessories: [
      { name: 'GHR', category: 'posterior-chain' },
      { name: 'Leg Press', category: 'quad-accessory' },
      { name: 'Ab Wheel', category: 'core' },
    ],
  },
  2: { // Bench — close grip variation + rows
    secondaries: [
      { name: 'Close Grip Bench', category: 'bench-secondary' },
      { name: 'Barbell Row', category: 'horizontal-row' },
    ],
    accessories: [
      { name: 'Tricep Pushdown (rope)', category: 'triceps' },
      { name: 'Face Pull', category: 'shoulders-isolation' },
    ],
  },
  3: { // Deadlift — deficit variation + posterior
    secondaries: [
      { name: 'Deficit Deadlift (1")', category: 'deadlift-secondary' },
    ],
    accessories: [
      { name: 'Reverse Hyper', category: 'posterior-chain' },
      { name: 'Nordic Curl', category: 'posterior-chain' },
      { name: 'Ab Wheel', category: 'core' },
    ],
  },
  4: { // Bench 2 — supplemental pressing + pulls
    secondaries: [
      { name: 'Incline Bench', category: 'bench-secondary' },
      { name: 'Weighted Pull-up', category: 'vertical-pull' },
    ],
    accessories: [
      { name: 'Lateral Raise', category: 'shoulders-isolation' },
      { name: 'Spider Curl', category: 'biceps' },
    ],
  },
};

/**
 * Calgary Barbell 16-Week generator — percentage-based programming faithful to Bryce Krawczyk's template.
 * Each day has its own loading scheme: D1/D2 are competition intensity, D3 is variation, D4 is tempo/volume.
 * Bench appears on EVERY day (4x/wk frequency) — heavy on D1, secondary on D2, variation on D3, TnG on D4.
 */
async function generateCBBSets(
  weekNumber: number,
  dayNumber: DayNumber,
): Promise<Omit<WorkoutSet, 'id' | 'sessionId'>[]> {
  const cfg = CBB_CONFIG[weekNumber] ?? CBB_CONFIG[1];
  const dayEx = CBB_DAY_EXERCISES[dayNumber];
  if (!dayEx) return [];

  const settings = await db.settings.get('singleton');
  if (!settings) return [];

  const sets: Omit<WorkoutSet, 'id' | 'sessionId'>[] = [];
  let setNum = 0;

  // Determine training maxes
  const sqTM = Math.round(settings.squat1RM * settings.trainingMaxPercent);
  const bnTM = Math.round(settings.bench1RM * settings.trainingMaxPercent);
  const dlTM = Math.round(settings.deadlift1RM * settings.trainingMaxPercent);

  const primary = await findExercise(dayEx.primary.name, dayEx.primary.category);
  const primaryTM = dayEx.primary.category.startsWith('squat') ? sqTM
    : dayEx.primary.category.startsWith('deadlift') ? dlTM
    : dayEx.primary.category.startsWith('bench') ? bnTM
    : sqTM;

  // === PRIMARY LIFT ===
  if (dayNumber === 1 || dayNumber === 2) {
    // D1/D2: Competition lifts — use main config
    const mainCfg = cfg.main;
    const topWeight = mainCfg.percent
      ? roundTo5(primaryTM * mainCfg.percent)
      : roundTo5(calculateGoalWeight(primaryTM, mainCfg.reps, mainCfg.rpe ?? 8.0));
    for (let i = 0; i < mainCfg.sets; i++) {
      sets.push(makeSet({
        exerciseId: primary.id, exerciseName: primary.name, setType: 'top',
        setNumber: ++setNum, goalWeight: topWeight,
        goalReps: mainCfg.reps, goalRPE: mainCfg.rpe ?? 0, category: dayEx.primary.category,
      }));
    }
    // Backoff sets
    if (cfg.backoff) {
      const boWeight = roundTo5(primaryTM * cfg.backoff.percent);
      for (let i = 0; i < cfg.backoff.sets; i++) {
        sets.push(makeSet({
          exerciseId: primary.id, exerciseName: primary.name, setType: 'backoff',
          setNumber: ++setNum, goalWeight: boWeight,
          goalReps: cfg.backoff.reps, goalRPE: 0, category: dayEx.primary.category,
        }));
      }
    }
  } else if (dayNumber === 3) {
    // D3: Variation day — squat variation
    if (cfg.variation.sets > 0) {
      const varWeight = roundTo5(sqTM * cfg.variation.percent);
      for (let i = 0; i < cfg.variation.sets; i++) {
        sets.push(makeSet({
          exerciseId: primary.id, exerciseName: primary.name, setType: 'top',
          setNumber: ++setNum, goalWeight: varWeight,
          goalReps: cfg.variation.reps, goalRPE: 0, category: dayEx.primary.category,
        }));
      }
    }
  } else if (dayNumber === 4) {
    // D4: Tempo deadlift — 2ct pause deadlift
    if (cfg.tempo.sets > 0) {
      const tempoWeight = roundTo5(dlTM * cfg.tempo.percent);
      for (let i = 0; i < cfg.tempo.sets; i++) {
        sets.push(makeSet({
          exerciseId: primary.id, exerciseName: primary.name, setType: 'top',
          setNumber: ++setNum, goalWeight: tempoWeight,
          goalReps: cfg.tempo.reps, goalRPE: 0, category: dayEx.primary.category,
        }));
      }
    }
  }

  // === BENCH SLOT (appears on every day except D4 TnG which is separate) ===
  if (dayEx.benchSlot) {
    const bench = await findExercise(dayEx.benchSlot.name, dayEx.benchSlot.category);

    if (dayNumber === 1) {
      // D1: Bench uses SAME main config percentages but with bench TM
      const mainCfg = cfg.main;
      const benchWeight = mainCfg.percent
        ? roundTo5(bnTM * mainCfg.percent)
        : roundTo5(calculateGoalWeight(bnTM, mainCfg.reps, mainCfg.rpe ?? 8.0));
      for (let i = 0; i < mainCfg.sets; i++) {
        sets.push(makeSet({
          exerciseId: bench.id, exerciseName: bench.name, setType: 'secondary',
          setNumber: ++setNum, goalWeight: benchWeight,
          goalReps: mainCfg.reps, goalRPE: mainCfg.rpe ?? 0, category: dayEx.benchSlot.category,
        }));
      }
      // Bench backoffs on D1
      if (cfg.backoff) {
        const benchBo = roundTo5(bnTM * cfg.backoff.percent);
        for (let i = 0; i < cfg.backoff.sets; i++) {
          sets.push(makeSet({
            exerciseId: bench.id, exerciseName: bench.name, setType: 'secondary',
            setNumber: ++setNum, goalWeight: benchBo,
            goalReps: cfg.backoff.reps, goalRPE: 0, category: dayEx.benchSlot.category,
          }));
        }
      }
    } else if (dayNumber === 2) {
      // D2: Bench is lighter secondary — use ~90% of main bench percentages
      const mainCfg = cfg.main;
      const d2Percent = mainCfg.percent ? mainCfg.percent * 0.90 : null;
      const d2Weight = d2Percent
        ? roundTo5(bnTM * d2Percent)
        : roundTo5(calculateGoalWeight(bnTM, mainCfg.reps + 1, (mainCfg.rpe ?? 8.0) - 1.0));
      const d2Sets = Math.max(2, mainCfg.sets - 1);
      for (let i = 0; i < d2Sets; i++) {
        sets.push(makeSet({
          exerciseId: bench.id, exerciseName: bench.name, setType: 'secondary',
          setNumber: ++setNum, goalWeight: d2Weight,
          goalReps: mainCfg.reps, goalRPE: 0, category: dayEx.benchSlot.category,
        }));
      }
    } else if (dayNumber === 3) {
      // D3: Bench variation — uses variation config percentages with bench TM
      if (cfg.variation.sets > 0) {
        const varBenchWeight = roundTo5(bnTM * cfg.variation.percent);
        for (let i = 0; i < cfg.variation.sets; i++) {
          sets.push(makeSet({
            exerciseId: bench.id, exerciseName: bench.name, setType: 'secondary',
            setNumber: ++setNum, goalWeight: varBenchWeight,
            goalReps: cfg.variation.reps, goalRPE: 0, category: dayEx.benchSlot.category,
          }));
        }
      }
    }
  }

  // D4: TnG Bench — separate from benchSlot, uses tngBench config
  if (dayNumber === 4 && cfg.tngBench) {
    const tng = await findExercise('Touch and Go Bench', 'bench-primary');
    const tngWeight = roundTo5(bnTM * cfg.tngBench.percent);
    for (let i = 0; i < cfg.tngBench.sets; i++) {
      sets.push(makeSet({
        exerciseId: tng.id, exerciseName: tng.name, setType: 'secondary',
        setNumber: ++setNum, goalWeight: tngWeight,
        goalReps: cfg.tngBench.reps, goalRPE: 0, category: 'bench-primary',
      }));
    }
  }

  // === SECONDARIES (RPE-based, auto-weight from PR history) ===
  if (cfg.secondarySets > 0) {
    const template = await db.templates.where({ blockType: 'calgary-16' as BlockType, weekNumber }).first();
    const secReps = template?.secondaryReps ?? 8;
    const secRPE = template?.secondaryRPE ?? 8.0;
    for (const sec of dayEx.secondaries) {
      const exercise = await findExercise(sec.name, sec.category);
      const lastWeight = await getLastWeight(exercise.id);
      for (let i = 0; i < cfg.secondarySets; i++) {
        sets.push(makeSet({
          exerciseId: exercise.id, exerciseName: exercise.name, setType: 'secondary',
          setNumber: ++setNum, goalWeight: lastWeight,
          goalReps: secReps, goalRPE: secRPE, category: sec.category,
        }));
      }
    }
  }

  // === ACCESSORIES (RPE-based, auto-weight from PR history) ===
  if (cfg.accessorySets > 0) {
    const template = await db.templates.where({ blockType: 'calgary-16' as BlockType, weekNumber }).first();
    const accReps = template?.accessoryReps ?? 10;
    const accRPE = template?.accessoryRPE ?? 8.0;
    for (const acc of dayEx.accessories) {
      const exercise = await findExercise(acc.name, acc.category);
      const lastWeight = await getLastWeight(exercise.id);
      for (let i = 0; i < cfg.accessorySets; i++) {
        sets.push(makeSet({
          exerciseId: exercise.id, exerciseName: exercise.name, setType: 'accessory',
          setNumber: ++setNum, goalWeight: lastWeight,
          goalReps: accReps, goalRPE: accRPE, category: acc.category,
        }));
      }
    }
  }

  // === OPTIONAL SLOTS ===
  const template = await db.templates.where({ blockType: 'calgary-16' as BlockType, weekNumber }).first();
  const optReps = template?.accessoryReps ?? 10;
  const optRPE = template?.accessoryRPE ?? 8.0;
  for (let slot = 0; slot < 3; slot++) {
    const optSets = cfg.accessorySets > 0 ? cfg.accessorySets : 1;
    for (let i = 0; i < optSets; i++) {
      sets.push(makeSet({
        exerciseId: '', exerciseName: `(Optional ${slot + 1})`, setType: 'optional',
        setNumber: ++setNum, goalWeight: 0,
        goalReps: optReps, goalRPE: optRPE, category: null,
      }));
    }
  }

  return sets;
}

async function findExercise(name: string, category: ExerciseCategory) {
  const found = await db.exercises.where('name').equals(name).first();
  if (found) return { id: found.id, name: found.name };
  const fallback = await db.exercises.where('category').equals(category).first();
  if (fallback) return { id: fallback.id, name: fallback.name };
  return { id: '', name };
}

export async function generateWorkoutSets(
  blockType: BlockType,
  weekNumber: number,
  dayNumber: DayNumber,
  _primaryLift: PrimaryLift,
  isVolume: boolean,
  oneRM: number,
  trainingMaxPercent: number,
): Promise<Omit<WorkoutSet, 'id' | 'sessionId'>[]> {
  // Calgary Barbell has its own fully custom generator (percentage-based, multi-lift days)
  if (blockType === 'calgary-16') {
    return generateCBBSets(weekNumber, dayNumber);
  }

  const template = await db.templates.where({ blockType, weekNumber }).first();
  if (!template) return [];

  const trainingMax = Math.round(oneRM * trainingMaxPercent);
  const sets: Omit<WorkoutSet, 'id' | 'sessionId'>[] = [];
  let setNum = 0;

  const primaryDef = (
    blockType === 'conj-4' ? CONJ_PRIMARY_EXERCISES[dayNumber] :
    blockType === 'linear-4' ? WENDLER_PRIMARY_EXERCISES[dayNumber] :
    blockType === 'texas-4' ? TEXAS_PRIMARY_EXERCISES[dayNumber] :
    blockType === 'sheiko-4' ? SHEIKO_PRIMARY_EXERCISES[dayNumber] :
    blockType === 'gzcl-4' ? GZCL_PRIMARY_EXERCISES[dayNumber] :
    blockType === 'rts-4' ? RTS_PRIMARY_EXERCISES[dayNumber] :
    null
  ) ?? PRIMARY_EXERCISES[dayNumber];
  const primary = await findExercise(primaryDef.name, primaryDef.category);
  const dayDefaults = (
    blockType === 'conj-4' ? CONJ_DAY_EXERCISE_DEFAULTS[dayNumber] :
    blockType === 'linear-4' ? WENDLER_DAY_EXERCISE_DEFAULTS[dayNumber] :
    blockType === 'texas-4' ? TEXAS_DAY_EXERCISE_DEFAULTS[dayNumber] :
    blockType === 'sheiko-4' ? SHEIKO_DAY_EXERCISE_DEFAULTS[dayNumber] :
    blockType === 'gzcl-4' ? GZCL_DAY_EXERCISE_DEFAULTS[dayNumber] :
    blockType === 'rts-4' ? RTS_DAY_EXERCISE_DEFAULTS[dayNumber] :
    null
  ) ?? DAY_EXERCISE_DEFAULTS[dayNumber];

  // === AUTOREGULATION: Fatigue multiplier from completed sessions this week ===
  const fatigueMult = await calculateFatigueMultiplier(blockType, weekNumber);

  // === AUTOREGULATION: Volume adjustment from previous week's RPE performance ===
  const volumeAdj = await calculateVolumeAdjustment(blockType, weekNumber);

  // === PRIMARY LIFT ===
  if (blockType === 'linear-4') {
    // === 5/3/1 (WENDLER) — percentage-based ramping sets ===
    let wendlerTM = trainingMax;
    // Day 4 (OHP) uses bench 1RM with reduced multiplier
    if (dayNumber === 4) wendlerTM = roundTo5(trainingMax * OHP_TM_MULTIPLIER);

    const wendlerSets = WENDLER_SETS[weekNumber] ?? WENDLER_SETS[1];
    for (const ws of wendlerSets) {
      const goalWeight = roundTo5(wendlerTM * ws.percent);
      sets.push(makeSet({
        exerciseId: primary.id, exerciseName: primary.name, setType: 'top',
        setNumber: ++setNum, goalWeight,
        goalReps: ws.reps, goalRPE: 0, category: primaryDef.category,
      }));
    }

    // BBB supplemental: 5×10 at 55% of TM (skip on deload week)
    if (weekNumber !== 4 && template.backoffSets > 0) {
      const bbbWeight = roundTo5(wendlerTM * BBB_PERCENT);
      for (let i = 0; i < template.backoffSets; i++) {
        sets.push(makeSet({
          exerciseId: primary.id, exerciseName: primary.name, setType: 'backoff',
          setNumber: ++setNum, goalWeight: bbbWeight,
          goalReps: template.backoffReps, goalRPE: template.backoffRPE, category: primaryDef.category,
        }));
      }
    }
  } else if (isVolume) {
    // Top sets for volume days (DE speed work on conjugate, gauge set on DUP)
    if (template.volumeTopSets) {
      let vTopReps = template.volumeTopReps ?? template.topReps;
      let vTopSets = template.volumeTopSets;
      const vTopRPE = template.volumeTopRPE ?? template.topRPE;

      // Westside DE overrides: speed bench is always triples, speed squat is always doubles
      if (blockType === 'conj-4' && dayNumber === 3) { vTopSets = 9; vTopReps = 3; }
      if (blockType === 'conj-4' && dayNumber === 4) { vTopSets = 12; vTopReps = 2; }

      // Use direct percentage for speed/DE work, otherwise RPE-based calculation
      let vTopPercent = template.volumeTopPercent;

      // Texas Method: Recovery day (Day 2) uses reduced percentage
      if (blockType === 'texas-4' && dayNumber === 2 && vTopPercent) {
        vTopPercent *= 0.80;
      }

      const vTopWeight = vTopPercent
        ? roundTo5(trainingMax * vTopPercent * fatigueMult)
        : roundTo5(calculateGoalWeight(trainingMax, vTopReps, vTopRPE) * fatigueMult);
      for (let i = 0; i < vTopSets; i++) {
        sets.push(makeSet({
          exerciseId: primary.id, exerciseName: primary.name, setType: 'top',
          setNumber: ++setNum, goalWeight: vTopWeight,
          goalReps: vTopReps, goalRPE: vTopRPE, category: primaryDef.category,
        }));
      }
    }

    // Volume/supplemental sets — skip for Texas Recovery day (Day 2)
    if (!(blockType === 'texas-4' && dayNumber === 2)) {
      const volReps = template.volumeBackoffReps ?? template.backoffReps;
      const volRPE = template.volumeBackoffRPE ?? template.backoffRPE;
      const volSets = template.volumeBackoffSets ?? 4;
      const volWeight = roundTo5(calculateGoalWeight(trainingMax, volReps, volRPE) * fatigueMult);
      for (let i = 0; i < volSets; i++) {
        sets.push(makeSet({
          exerciseId: primary.id, exerciseName: primary.name, setType: 'volume',
          setNumber: ++setNum, goalWeight: volWeight,
          goalReps: volReps, goalRPE: volRPE, category: primaryDef.category,
        }));
      }
    }
  } else {
    // GZCL Day 4 (OHP) uses bench 1RM with reduced multiplier
    let effectiveTM = trainingMax;
    if (blockType === 'gzcl-4' && dayNumber === 4) effectiveTM = roundTo5(trainingMax * GZCL_OHP_MULTIPLIER);
    const topGoalWeight = roundTo5(calculateGoalWeight(effectiveTM, template.topReps, template.topRPE) * fatigueMult);
    for (let i = 0; i < template.topSets; i++) {
      sets.push(makeSet({
        exerciseId: primary.id, exerciseName: primary.name, setType: 'top',
        setNumber: ++setNum, goalWeight: topGoalWeight,
        goalReps: template.topReps, goalRPE: template.topRPE, category: primaryDef.category,
      }));
    }

    // Backoff sets (skip entirely when template prescribes 0, e.g. conjugate ME days)
    if (template.backoffSets > 0) {
      const backoffGoalWeight = roundTo5(calculateGoalWeight(effectiveTM, template.backoffReps, template.backoffRPE) * fatigueMult);

      // Volume-adjusted backoff set count (clamped to at least 1)
      const adjustedBackoffSets = Math.max(1, template.backoffSets + volumeAdj);
      for (let i = 0; i < adjustedBackoffSets; i++) {
        sets.push(makeSet({
          exerciseId: primary.id, exerciseName: primary.name, setType: 'backoff',
          setNumber: ++setNum, goalWeight: backoffGoalWeight,
          goalReps: template.backoffReps, goalRPE: template.backoffRPE, category: primaryDef.category,
        }));
      }
    }
  }

  // === SECONDARIES (auto-weight from PR history) ===
  for (const sec of dayDefaults.secondaries) {
    const exercise = await findExercise(sec.name, sec.category);

    // Conjugate DE Lower: speed pulls are percentage-based singles from deadlift 1RM
    const isSpeedPull = blockType === 'conj-4' && dayNumber === 4 && isVolume
      && (sec.category === 'deadlift-primary' || sec.category === 'deadlift-secondary');

    if (isSpeedPull) {
      const settings = await db.settings.get('singleton');
      if (settings) {
        const deadliftTM = Math.round(settings.deadlift1RM * settings.trainingMaxPercent);
        const pullCfg = CONJ_SPEED_PULL[weekNumber] ?? CONJ_SPEED_PULL[1];
        const pullWeight = roundTo5(deadliftTM * pullCfg.percent);
        for (let i = 0; i < pullCfg.sets; i++) {
          sets.push(makeSet({
            exerciseId: exercise.id, exerciseName: exercise.name, setType: 'secondary',
            setNumber: ++setNum, goalWeight: pullWeight,
            goalReps: pullCfg.reps, goalRPE: 0, category: sec.category,
          }));
        }
      }
    } else {
      const lastWeight = await getLastWeight(exercise.id);
      for (let i = 0; i < template.secondarySets; i++) {
        sets.push(makeSet({
          exerciseId: exercise.id, exerciseName: exercise.name, setType: 'secondary',
          setNumber: ++setNum, goalWeight: lastWeight,
          goalReps: template.secondaryReps, goalRPE: template.secondaryRPE, category: sec.category,
        }));
      }
    }
  }

  // === ACCESSORIES (auto-weight from PR history) ===
  for (const acc of dayDefaults.accessories) {
    const exercise = await findExercise(acc.name, acc.category);
    const lastWeight = await getLastWeight(exercise.id);
    for (let i = 0; i < template.accessorySets; i++) {
      sets.push(makeSet({
        exerciseId: exercise.id, exerciseName: exercise.name, setType: 'accessory',
        setNumber: ++setNum, goalWeight: lastWeight,
        goalReps: template.accessoryReps, goalRPE: template.accessoryRPE, category: acc.category,
      }));
    }
  }

  // === 3 OPTIONAL SLOTS (each slot is an independent exercise) ===
  for (let slot = 0; slot < 3; slot++) {
    for (let i = 0; i < template.accessorySets; i++) {
      sets.push(makeSet({
        exerciseId: '', exerciseName: `(Optional ${slot + 1})`, setType: 'optional',
        setNumber: ++setNum, goalWeight: 0,
        goalReps: template.accessoryReps, goalRPE: template.accessoryRPE, category: null,
      }));
    }
  }

  return sets;
}

function makeSet(
  partial: Pick<WorkoutSet, 'exerciseId' | 'exerciseName' | 'setType' | 'setNumber' | 'goalWeight' | 'goalReps' | 'goalRPE'>
    & { category?: ExerciseCategory | null },
): Omit<WorkoutSet, 'id' | 'sessionId'> {
  return {
    ...partial,
    actualWeight: null,
    actualReps: null,
    actualRPE: null,
    e1rm: null,
    percentOfTM: null,
    tonnage: null,
    category: partial.category ?? null,
  };
}
