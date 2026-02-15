import { useNavigate, useLocation } from 'react-router-dom';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
}

export function Header({ title, subtitle, showBack }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isRoot = location.pathname === '/';

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3 safe-top">
      <div className="flex items-center gap-3">
        {showBack && !isRoot && (
          <button
            onClick={() => navigate(-1)}
            className="text-slate-400 text-xl -ml-1 w-8 h-8 flex items-center justify-center"
          >
            ←
          </button>
        )}
        <div>
          <h1 className="text-lg font-bold text-slate-100">{title}</h1>
          {subtitle && (
            <p className="text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
    </header>
  );
}
