import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';

const tabs = [
  { to: '/', label: 'Dashboard', icon: '◉' },
  { to: '/workout', label: 'Workout', icon: '🏋' },
  { to: '/history', label: 'History', icon: '📈' },
  { to: '/exercises', label: 'Exercises', icon: '📋' },
  { to: '/calculator', label: 'Calc', icon: '🔢' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 safe-bottom z-50">
      <div className="flex justify-around items-center h-14 max-w-lg mx-auto px-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center gap-0.5 px-1 py-1 text-[10px] transition-colors min-w-0 flex-1',
                isActive ? 'text-blue-400' : 'text-slate-500',
              )
            }
          >
            <span className="text-base">{tab.icon}</span>
            <span className="truncate w-full text-center">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
