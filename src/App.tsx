import { Outlet } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';

export function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 max-w-lg mx-auto">
      <Outlet />
      <BottomNav />
    </div>
  );
}
