import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { Card } from '@/components/shared/Card';
import { Badge } from '@/components/shared/Badge';
import type { UserSettings } from '@/db/types';
import { BLOCK_LABELS, PHASE_LABELS } from '@/db/types';

interface BlockProgressProps {
  settings: UserSettings;
}

export function BlockProgress({ settings }: BlockProgressProps) {
  const template = useLiveQuery(
    () =>
      db.templates
        .where({ blockType: settings.currentBlockType, weekNumber: settings.currentWeek })
        .first(),
    [settings.currentBlockType, settings.currentWeek],
  );

  const totalWeeks = useLiveQuery(
    () =>
      db.templates
        .where('blockType')
        .equals(settings.currentBlockType)
        .count(),
    [settings.currentBlockType],
  );

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-200">
            {BLOCK_LABELS[settings.currentBlockType]}
          </div>
          <div className="text-xs text-slate-500">
            Week {settings.currentWeek} of {totalWeeks ?? '—'}
          </div>
        </div>
        {template && (
          <Badge variant="info">{PHASE_LABELS[template.phase]}</Badge>
        )}
      </div>

      {/* Week dots */}
      {totalWeeks && (
        <div className="flex gap-1.5 mt-3">
          {Array.from({ length: totalWeeks }, (_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full ${
                i + 1 < settings.currentWeek
                  ? 'bg-blue-500'
                  : i + 1 === settings.currentWeek
                    ? 'bg-blue-400 animate-pulse'
                    : 'bg-slate-800'
              }`}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
