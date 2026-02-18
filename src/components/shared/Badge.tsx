import { clsx } from 'clsx';

type BadgeVariant = 'success' | 'warning' | 'info' | 'muted';

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  info: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  muted: 'bg-slate-700/50 text-slate-400 border-slate-600/30',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

export function Badge({ children, variant = 'muted' }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        variantStyles[variant],
      )}
    >
      {children}
    </span>
  );
}
