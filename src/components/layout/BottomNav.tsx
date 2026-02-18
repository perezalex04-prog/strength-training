import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';

const tabs = [
  { to: '/', label: 'HOME' },
  { to: '/workout', label: 'TRAIN' },
  { to: '/history', label: 'LOG' },
  { to: '/exercises', label: 'LIFTS' },
  { to: '/calculator', label: 'CALC' },
  { to: '/settings', label: 'SET' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 safe-bottom z-50">
      <div className="flex justify-around items-center h-12 max-w-lg mx-auto">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center justify-center px-2 py-2 text-[11px] font-bold tracking-wider transition-colors min-w-0 flex-1 uppercase',
                isActive
                  ? 'text-amber-400 border-t-2 border-amber-400 -mt-[2px]'
                  : 'text-slate-600',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
