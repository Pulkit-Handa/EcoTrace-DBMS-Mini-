import { Leaf } from 'lucide-react';

export function Logo({
  variant = 'light',
  showText = true,
}: {
  variant?: 'light' | 'dark';
  showText?: boolean;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 shadow-lg shadow-brand-950/20">
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.5),transparent_55%)]" />
        <Leaf className="relative h-5 w-5 -rotate-12 text-white" strokeWidth={2.4} />
      </span>
      {showText ? (
        <span
          className={
            variant === 'dark'
              ? 'text-[19px] font-semibold tracking-tight text-brand-950'
              : 'text-[19px] font-semibold tracking-tight text-white'
          }
        >
          EcoTrace
        </span>
      ) : null}
    </span>
  );
}
