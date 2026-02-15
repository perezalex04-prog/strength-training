import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/shared/Card';
import { calculatePlates, formatPlates } from '@/engine/plates';
import { roundTo5 } from '@/engine/e1rm';
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

export function CalculatorPage() {
  const { settings } = useSettings();
  const [oneRM, setOneRM] = useState(settings?.squat1RM ?? 400);

  return (
    <div>
      <Header title="Calculator" subtitle="Weight & Plates" showBack />
      <div className="px-4 py-4 space-y-4 pb-20">
        {/* Input */}
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
              const plates = calculatePlates(weight, settings?.barWeight ?? 45, settings?.availablePlates);
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
