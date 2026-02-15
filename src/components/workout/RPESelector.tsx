import { clsx } from 'clsx';

interface RPESelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (rpe: number) => void;
  currentValue?: number | null;
}

const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

const RPE_DESCRIPTIONS: Record<number, string> = {
  6: '4 reps left',
  6.5: '3-4 reps left',
  7: '3 reps left',
  7.5: '2-3 reps left',
  8: '2 reps left',
  8.5: '1-2 reps left',
  9: '1 rep left',
  9.5: 'Maybe 1 left',
  10: 'Max effort',
};

export function RPESelector({ isOpen, onClose, onSelect, currentValue }: RPESelectorProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2">
          <span className="text-sm text-slate-400">Rate of Perceived Exertion</span>
        </div>

        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          {RPE_VALUES.map((rpe) => (
            <button
              key={rpe}
              onClick={() => { onSelect(rpe); onClose(); }}
              className={clsx(
                'flex flex-col items-center py-4 rounded-xl transition-colors',
                currentValue === rpe
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-200 active:bg-slate-700',
              )}
            >
              <span className="text-2xl font-bold">{rpe}</span>
              <span className="text-xs text-slate-400 mt-0.5">{RPE_DESCRIPTIONS[rpe]}</span>
            </button>
          ))}
        </div>

        <div className="px-4 pb-4">
          <button onClick={onClose} className="w-full py-3 rounded-lg text-slate-400 text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
