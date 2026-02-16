import { useState } from 'react';
import templates from '@/db/data/periodization-templates.json';
import { BLOCK_LABELS, BLOCK_TYPES, BLOCK_MAX_WEEKS } from '@/db/types';
import type { BlockType } from '@/db/types';

interface ProgramPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  currentBlockType: BlockType;
  currentWeek: number;
  onSwitchProgram?: (blockType: BlockType) => void;
}

export function ProgramPreview({
  isOpen,
  onClose,
  currentBlockType,
  currentWeek,
  onSwitchProgram,
}: ProgramPreviewProps) {
  const [previewBlock, setPreviewBlock] = useState<BlockType>(currentBlockType);

  if (!isOpen) return null;

  const weeks = templates.filter((t) => t.blockType === previewBlock);
  const isCurrentProgram = previewBlock === currentBlockType;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
      <div className="bg-slate-900 w-full max-h-[95vh] rounded-t-2xl flex flex-col safe-bottom">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h3 className="text-sm font-bold text-slate-200">Program Preview</h3>
          <button
            onClick={onClose}
            className="text-slate-500 text-lg w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Program selector */}
        <div className="px-4 py-2 border-b border-slate-800">
          <div className="flex gap-1.5 overflow-x-auto">
            {BLOCK_TYPES.map((bt) => (
              <button
                key={bt}
                onClick={() => setPreviewBlock(bt)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  previewBlock === bt
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}
              >
                {BLOCK_LABELS[bt]}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                  <th className="text-left py-2 pr-2 font-medium">Wk</th>
                  <th className="text-left py-2 pr-2 font-medium">Phase</th>
                  <th className="text-center py-2 pr-2 font-medium">Top</th>
                  <th className="text-center py-2 pr-2 font-medium">Backoff</th>
                  <th className="text-center py-2 pr-2 font-medium">Secondary</th>
                  <th className="text-center py-2 font-medium">Accessory</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => {
                  const isActive = isCurrentProgram && w.weekNumber === currentWeek;
                  return (
                    <tr
                      key={w.id}
                      className={`border-b border-slate-800/50 ${
                        isActive ? 'bg-blue-500/10' : ''
                      }`}
                    >
                      <td className="py-2.5 pr-2">
                        <span className={`font-bold ${isActive ? 'text-blue-400' : 'text-slate-300'}`}>
                          {w.weekNumber}
                          {isActive && <span className="text-[8px] ml-0.5">◀</span>}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2">
                        <span className={`capitalize ${isActive ? 'text-blue-300' : 'text-slate-400'}`}>
                          {w.phase}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 text-center">
                        <div className="text-slate-300">
                          {w.topSets}×{w.topReps}
                        </div>
                        <div className="text-slate-600 text-[10px]">@{w.topRPE}</div>
                      </td>
                      <td className="py-2.5 pr-2 text-center">
                        <div className="text-slate-300">
                          {w.backoffSets}×{w.backoffReps}
                        </div>
                        <div className="text-slate-600 text-[10px]">@{w.backoffRPE}</div>
                      </td>
                      <td className="py-2.5 pr-2 text-center">
                        <div className="text-slate-300">
                          {w.secondarySets}×{w.secondaryReps}
                        </div>
                        <div className="text-slate-600 text-[10px]">@{w.secondaryRPE}</div>
                      </td>
                      <td className="py-2.5 text-center">
                        <div className="text-slate-300">
                          {w.accessorySets}×{w.accessoryReps}
                        </div>
                        <div className="text-slate-600 text-[10px]">@{w.accessoryRPE}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-3 text-[10px] text-slate-600">
            Format: sets × reps @ RPE &middot; {BLOCK_MAX_WEEKS[previewBlock]} weeks total
          </div>
        </div>

        {/* Switch button (only if different program) */}
        {!isCurrentProgram && onSwitchProgram && (
          <div className="px-4 py-3 border-t border-slate-800">
            <button
              onClick={() => {
                onSwitchProgram(previewBlock);
                onClose();
              }}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl text-sm active:bg-blue-700"
            >
              Switch to {BLOCK_LABELS[previewBlock]}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
