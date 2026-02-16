import { Header } from '@/components/layout/Header';
import { Card } from '@/components/shared/Card';
import { useSettings } from '@/hooks/useSettings';
import type { PrimaryLift } from '@/db/types';
import { exportAllData, importAllData } from '@/utils/export';
import { useRef } from 'react';
const LIFTS: { key: PrimaryLift; label: string; rmKey: string; goalKey: string }[] = [
  { key: 'squat', label: 'Squat', rmKey: 'squat1RM', goalKey: 'squatGoal' },
  { key: 'bench', label: 'Bench', rmKey: 'bench1RM', goalKey: 'benchGoal' },
  { key: 'deadlift', label: 'Deadlift', rmKey: 'deadlift1RM', goalKey: 'deadliftGoal' },
];

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  if (!settings) return null;

  const handleNumberChange = (key: string, value: string) => {
    const num = Number(value);
    if (!isNaN(num) && num >= 0) {
      updateSettings({ [key]: num } as any);
    }
  };

  const handleExport = async () => {
    const json = await exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strength-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importAllData(text);
    window.location.reload();
  };

  return (
    <div>
      <Header title="Settings" />
      <div className="px-4 py-4 space-y-4 pb-20">
        {/* Current Maxes */}
        <Card title="Current 1RM">
          <div className="space-y-3">
            {LIFTS.map((lift) => (
              <div key={lift.key} className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-300 w-20">{lift.label}</span>
                <input
                  type="number"
                  value={(settings as any)[lift.rmKey]}
                  onChange={(e) => handleNumberChange(lift.rmKey, e.target.value)}
                  className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-right text-sm text-slate-200 tabular-nums"
                />
                <span className="text-xs text-slate-600">lbs</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Goals */}
        <Card title="Goal 1RM">
          <div className="space-y-3">
            {LIFTS.map((lift) => (
              <div key={lift.key} className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-300 w-20">{lift.label}</span>
                <input
                  type="number"
                  value={(settings as any)[lift.goalKey]}
                  onChange={(e) => handleNumberChange(lift.goalKey, e.target.value)}
                  className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-right text-sm text-slate-200 tabular-nums"
                />
                <span className="text-xs text-slate-600">lbs</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Timer */}
        <Card title="Rest Timer">
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-300">Default rest (seconds)</span>
            <input
              type="number"
              value={settings.restTimerDefault}
              onChange={(e) => handleNumberChange('restTimerDefault', e.target.value)}
              className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-right text-sm text-slate-200 tabular-nums"
            />
          </div>
        </Card>

        {/* Training Max */}
        <Card title="Training Max">
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-300">TM Percentage</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={Math.round(settings.trainingMaxPercent * 100)}
                onChange={(e) => {
                  const pct = Number(e.target.value);
                  if (pct > 0 && pct <= 100) {
                    updateSettings({ trainingMaxPercent: pct / 100 });
                  }
                }}
                className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-right text-sm text-slate-200 tabular-nums"
              />
              <span className="text-xs text-slate-600">%</span>
            </div>
          </div>
        </Card>

        {/* Data Management */}
        <Card title="Data">
          <div className="space-y-3">
            <button
              onClick={handleExport}
              className="w-full py-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 active:bg-slate-700"
            >
              Export All Data (JSON)
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full py-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 active:bg-slate-700"
            >
              Import Data
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
