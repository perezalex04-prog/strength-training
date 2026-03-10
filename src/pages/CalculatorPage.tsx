import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/shared/Card';
import { calculatePlates, formatPlates } from '@/engine/plates';
import { roundTo5, calculateGoalWeight } from '@/engine/e1rm';
import { useSettings } from '@/hooks/useSettings';

const PERCENTAGES = [100, 95, 90, 85, 80, 77, 75, 70, 65, 60, 55, 50];
const PCT_LABELS: Record<number, string> = {
  100: '1RM Test',
  95: 'Single @9',
  90: 'TM / Single @8',
  85: '2-3 @8',
  80: '4-5 @8',
  77: '5 @7',
  75: '6-8 @7',
  70: '8-10',
  65: '10-12',
  60: 'Warm-up',
  55: 'Warm-up',
  50: 'Warm-up',
};

const RPE_OPTIONS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5];

const WARMUP_STEPS = [
  { pct: 0, reps: 10, label: 'Bar' },
  { pct: 50, reps: 5, label: '50%' },
  { pct: 60, reps: 3, label: '60%' },
  { pct: 70, reps: 3, label: '70%' },
  { pct: 80, reps: 2, label: '80%' },
  { pct: 90, reps: 1, label: '90%' },
];

export function CalculatorPage() {
  const { settings } = useSettings();
  const [oneRM, setOneRM] = useState(settings?.squat1RM ?? 400);
  const [rpeReps, setRpeReps] = useState(5);
  const [rpeTarget, setRpeTarget] = useState(8);
  const [workingWeight, setWorkingWeight] = useState(0);

  const barWeight = settings?.barWeight ?? 45;
  const basePlates = settings?.availablePlates ?? [45, 35, 25, 10, 5, 2.5];
  const availPlates = settings?.microPlates ? [...basePlates, 1.25, 0.5] : basePlates;

  // RPE calculator result
  const rpeWeight = calculateGoalWeight(oneRM, rpeReps, rpeTarget);
  const rpePlates = calculatePlates(rpeWeight, barWeight, availPlates);

  return (
    <div>
      <Header title="Calculator" subtitle="Weight & Plates" />
      <div className="px-4 py-4 space-y-4 pb-20">
        {/* 1RM Input */}
        <Card>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-300">1RM</span>
            <input
              type="number"
              value={oneRM}
              onChange={(e) => setOneRM(Number(e.target.value))}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-xl text-right text-slate-200 tabular-nums font-bold"
            />
            <span className="text-sm text-slate-500">lbs</span>
          </div>
        </Card>

        {/* Quick select from lifts */}
        {settings && (
          <div className="flex gap-2">
            {([
              { label: 'SQ', value: settings.squat1RM },
              { label: 'BP', value: settings.bench1RM },
              { label: 'DL', value: settings.deadlift1RM },
            ]).map((lift) => (
              <button
                key={lift.label}
                onClick={() => setOneRM(lift.value)}
                className="flex-1 py-2 bg-slate-800 rounded-lg text-sm text-slate-400 active:bg-slate-700"
              >
                {lift.label}: {lift.value}
              </button>
            ))}
          </div>
        )}

        {/* RPE Calculator */}
        <Card title="RPE Calculator">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">Reps</label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={rpeReps}
                  onChange={(e) => setRpeReps(Math.max(1, Math.min(15, Number(e.target.value))))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-right text-slate-200 tabular-nums"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">RPE</label>
                <select
                  value={rpeTarget}
                  onChange={(e) => setRpeTarget(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                >
                  {RPE_OPTIONS.map((rpe) => (
                    <option key={rpe} value={rpe}>{rpe}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Result */}
            <div className="bg-slate-800/60 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-amber-400 tabular-nums">{rpeWeight} lbs</div>
              <div className="text-xs text-slate-500 mt-1">
                {rpeReps} reps @ RPE {rpeTarget}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Plates/side: {formatPlates(rpePlates)}
              </div>
            </div>

            {/* Use as warmup working weight */}
            <button
              onClick={() => setWorkingWeight(rpeWeight)}
              className="w-full py-2 bg-slate-800 rounded-lg text-xs text-amber-400 active:bg-slate-700"
            >
              Use {rpeWeight} lbs as warmup working weight ↓
            </button>
          </div>
        </Card>

        {/* Warmup Calculator */}
        <Card title="Warmup Ramp">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-300">Working Wt</span>
              <input
                type="number"
                value={workingWeight}
                onChange={(e) => setWorkingWeight(Number(e.target.value))}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-right text-slate-200 tabular-nums"
              />
              <span className="text-sm text-slate-500">lbs</span>
            </div>

            {workingWeight > 0 && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-4 gap-2 text-xs text-slate-500 font-semibold pb-1 border-b border-slate-800">
                  <span>Set</span>
                  <span className="text-right">Weight</span>
                  <span className="text-center">Reps</span>
                  <span className="text-right">Plates/side</span>
                </div>
                {WARMUP_STEPS.map((step) => {
                  const weight = step.pct === 0
                    ? barWeight
                    : roundTo5(workingWeight * step.pct / 100);
                  // Skip warmup step if weight would be at or below bar weight (except the bar step itself)
                  if (step.pct > 0 && weight <= barWeight) return null;
                  const plates = calculatePlates(weight, barWeight, availPlates);
                  return (
                    <div key={step.label} className="grid grid-cols-4 gap-2 items-center">
                      <span className="text-sm text-slate-400">{step.label}</span>
                      <span className="text-right text-sm tabular-nums font-semibold text-slate-200">
                        {weight}
                      </span>
                      <span className="text-center text-sm text-slate-400">×{step.reps}</span>
                      <span className="text-right text-xs text-slate-500 truncate">
                        {step.pct === 0 ? '—' : formatPlates(plates)}
                      </span>
                    </div>
                  );
                })}
                {/* Working sets row */}
                <div className="grid grid-cols-4 gap-2 items-center pt-1 border-t border-slate-700">
                  <span className="text-sm font-semibold text-amber-400">Work</span>
                  <span className="text-right text-sm tabular-nums font-bold text-amber-400">
                    {workingWeight}
                  </span>
                  <span className="text-center text-sm text-amber-400">→</span>
                  <span className="text-right text-xs text-slate-400 truncate">
                    {formatPlates(calculatePlates(workingWeight, barWeight, availPlates))}
                  </span>
                </div>
              </div>
            )}

            {workingWeight === 0 && (
              <div className="text-center py-4 text-xs text-slate-600">
                Enter a working weight or use the RPE calculator above
              </div>
            )}
          </div>
        </Card>

        {/* Percentage table */}
        <Card title="Percentage Chart">
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2 text-xs text-slate-500 font-semibold pb-1 border-b border-slate-800">
              <span>%</span>
              <span className="text-right">Weight</span>
              <span className="text-center">Plates/side</span>
              <span className="text-right">Use</span>
            </div>
            {PERCENTAGES.map((pct) => {
              const weight = roundTo5(oneRM * pct / 100);
              const plates = calculatePlates(weight, barWeight, availPlates);
              return (
                <div key={pct} className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-sm text-slate-400">{pct}%</span>
                  <span className="text-right text-sm tabular-nums font-semibold text-slate-200">
                    {weight}
                  </span>
                  <span className="text-center text-xs text-slate-500 truncate">
                    {formatPlates(plates)}
                  </span>
                  <span className="text-right text-xs text-slate-600">
                    {PCT_LABELS[pct] ?? ''}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
