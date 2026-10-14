import { cn } from '@/lib/format';

type Tone = 'success' | 'danger' | 'warning' | 'neutral' | 'info' | 'brand';

const tones: Record<Tone, string> = {
  success: 'border-brand-200 bg-brand-50 text-brand-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  neutral: 'border-ink-200 bg-ink-50 text-ink-600',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  brand: 'border-brand-200 bg-brand-100/70 text-brand-800',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={cn('badge', tones[tone], className)}>{children}</span>
  );
}

export function ComplianceBadge({ status }: { status: string }) {
  const compliant = status === 'Compliant';
  return (
    <Badge tone={compliant ? 'success' : 'danger'}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          compliant ? 'bg-brand-500' : 'bg-red-500',
        )}
      />
      {status}
    </Badge>
  );
}

export function ScopeBadge({ scope }: { scope: number }) {
  const tone: Tone = scope === 1 ? 'success' : scope === 2 ? 'info' : 'warning';
  return <Badge tone={tone}>Scope {scope}</Badge>;
}
