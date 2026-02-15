import { Header } from '@/components/layout/Header';
import { MaxesCard } from '@/components/dashboard/MaxesCard';
import { DeltaBar } from '@/components/dashboard/DeltaBar';
import { WeeklyBests } from '@/components/dashboard/WeeklyBests';
import { BlockProgress } from '@/components/dashboard/BlockProgress';
import { Card } from '@/components/shared/Card';
import { useSettings } from '@/hooks/useSettings';

export function DashboardPage() {
  const { settings } = useSettings();

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-slate-500">Loading...</span>
      </div>
    );
  }

  return (
    <div>
      <Header title="Strength Tracker" subtitle="Dashboard" />
      <div className="px-4 py-4 space-y-4 pb-20">
        <BlockProgress settings={settings} />
        <MaxesCard settings={settings} />

        <Card title="Progress to Goals">
          <div className="space-y-3">
            <DeltaBar label="Squat" current={settings.squat1RM} goal={settings.squatGoal} />
            <DeltaBar label="Bench" current={settings.bench1RM} goal={settings.benchGoal} />
            <DeltaBar label="Deadlift" current={settings.deadlift1RM} goal={settings.deadliftGoal} />
          </div>
        </Card>

        <WeeklyBests settings={settings} />
      </div>
    </div>
  );
}
