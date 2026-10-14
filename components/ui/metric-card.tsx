import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/format';

export function MetricCard({
  label,
  value,
  suffix,
  helper,
  icon: Icon,
  accent = 'brand',
  progress,
}: {
  label: string;
  value: string;
  suffix?: string;
  helper: string;
  icon: LucideIcon;
  accent?: 'brand' | 'amber' | 'sky' | 'violet';
  progress?: number;
}) {
  const accents = {
    brand: {
      icon: 'bg-brand-50 text-brand-700 ring-brand-100',
      bar: 'bg-brand-500',
    },
    amber: {
      icon: 'bg-amber-50 text-amber-700 ring-amber-100',
      bar: 'bg-amber-500',
    },
    sky: {
      icon: 'bg-sky-50 text-sky-700 ring-sky-100',
      bar: 'bg-sky-500',
    },
    violet: {
      icon: 'bg-violet-50 text-violet-700 ring-violet-100',
      bar: 'bg-violet-500',
    },
  }[accent];

  return (
    <div className="card card-hover relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.09em] text-ink-500">
          {label}
        </p>
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1',
            accents.icon,
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="metric-value">{value}</span>
        {suffix ? (
          <span className="text-xs font-medium text-ink-400">{suffix}</span>
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-ink-500">{helper}</p>
      {typeof progress === 'number' ? (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div
            className={cn('h-full rounded-full transition-all', accents.bar)}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
