import { clsx } from 'clsx';

interface RestTimerProps {
  isRunning: boolean;
  formattedTime: string;
  secondsLeft: number;
  onStart: (seconds?: number) => void;
  onStop: () => void;
  defaultSeconds: number;
}

export function RestTimer({ isRunning, formattedTime, secondsLeft, onStart, onStop, defaultSeconds }: RestTimerProps) {
  if (!isRunning) {
    return (
      <button
        onClick={() => onStart(defaultSeconds)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shadow-lg active:bg-slate-700"
      >
        <span className="text-xs font-semibold">{Math.floor(defaultSeconds / 60)}:{String(defaultSeconds % 60).padStart(2, '0')}</span>
      </button>
    );
  }

  const urgency = secondsLeft <= 10;

  return (
    <button
      onClick={onStop}
      className={clsx(
        'fixed bottom-20 right-4 z-40 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-colors',
        urgency
          ? 'bg-red-600 text-white animate-pulse'
          : 'bg-blue-600 text-white',
      )}
    >
      <span className="text-lg font-bold tabular-nums">{formattedTime}</span>
    </button>
  );
}
