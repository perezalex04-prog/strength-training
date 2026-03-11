import { useState, useEffect } from 'react';
import { clsx } from 'clsx';

interface NumberPadProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: number) => void;
  initialValue?: number;
  mode: 'weight' | 'reps';
  label?: string;
  microPlates?: boolean;
}

export function NumberPad({ isOpen, onClose, onConfirm, initialValue, mode, label, microPlates }: NumberPadProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue ? String(initialValue) : '');
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleDigit = (d: string) => {
    setValue((prev) => {
      if (d === '.') {
        if (prev.includes('.')) return prev;
        return prev === '' ? '0.' : prev + '.';
      }
      const next = prev + d;
      if (mode === 'weight' && Number(next) > 1500) return prev;
      if (mode === 'reps' && Number(next) > 99) return prev;
      // Limit to 1 decimal place for weights
      if (prev.includes('.') && prev.split('.')[1].length >= 1) return prev;
      return next;
    });
  };

  const handleDelete = () => setValue((prev) => prev.slice(0, -1));

  const handleConfirm = () => {
    const num = Number(value);
    if (num > 0) {
      if (mode === 'weight') {
        const step = microPlates ? 0.5 : 2.5;
        onConfirm(Math.round(num / step) * step);
      } else {
        onConfirm(num);
      }
    }
    onClose();
  };

  const handleIncrement = (delta: number) => {
    const current = Number(value) || 0;
    const next = Math.max(0, current + delta);
    setValue(String(Math.round(next * 10) / 10));
  };

  const quickReps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15];
  const increments = microPlates ? [-5, -0.5, 0.5, 5] : [-10, -5, 5, 10];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="w-full bg-slate-900 border-t border-slate-700 rounded-t-xl safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-sm text-slate-400">{label ?? (mode === 'weight' ? 'Weight (lbs)' : 'Reps')}</span>
          <span className="text-2xl font-bold text-slate-100 min-w-[80px] text-right tabular-nums">
            {value || '0'}
            {mode === 'weight' && <span className="text-sm text-slate-500 ml-1">lbs</span>}
          </span>
        </div>

        {/* Quick increment buttons for weight */}
        {mode === 'weight' && (
          <div className="flex gap-2 px-4 pb-2">
            {increments.map((delta) => (
              <button
                key={delta}
                onClick={() => handleIncrement(delta)}
                className={clsx(
                  'flex-1 py-2.5 rounded-lg text-sm font-semibold',
                  delta > 0
                    ? 'bg-amber-500/20 text-amber-400 active:bg-amber-500/30'
                    : 'bg-red-500/20 text-red-400 active:bg-red-500/30',
                )}
              >
                {delta > 0 ? '+' : ''}{delta}
              </button>
            ))}
            {microPlates && (
              <button
                onClick={() => handleDigit('.')}
                className="w-12 py-2.5 rounded-lg text-sm font-semibold bg-slate-700 text-slate-300 active:bg-slate-600"
              >
                .
              </button>
            )}
          </div>
        )}

        {/* Quick reps grid */}
        {mode === 'reps' && (
          <div className="grid grid-cols-5 gap-2 px-4 pb-2">
            {quickReps.map((r) => (
              <button
                key={r}
                onClick={() => { onConfirm(r); onClose(); }}
                className="py-3 rounded-lg bg-slate-800 text-slate-200 font-semibold text-lg active:bg-slate-700"
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Number pad grid */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="py-4 rounded-lg bg-slate-800 text-slate-100 text-xl font-semibold active:bg-slate-700"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleDelete}
            className="py-4 rounded-lg bg-slate-800 text-slate-400 text-xl active:bg-slate-700"
          >
            {'\u232B'}
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="py-4 rounded-lg bg-slate-800 text-slate-100 text-xl font-semibold active:bg-slate-700"
          >
            0
          </button>
          <button
            onClick={handleConfirm}
            className="py-4 rounded-lg bg-amber-600 text-white text-xl font-bold active:bg-amber-700"
          >
            {'\u2713'}
          </button>
        </div>

        {/* Cancel */}
        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg text-slate-400 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
