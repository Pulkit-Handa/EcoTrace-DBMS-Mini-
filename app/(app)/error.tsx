'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card w-full max-w-lg p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-xl font-semibold">The data layer is not responding</h1>
        <p className="mt-2 text-sm leading-6 text-ink-500">
          Check that PostgreSQL and MongoDB are running, then retry. The
          database setup command is{' '}
          <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px]">
            npm run db:setup
          </code>
          .
        </p>
        {error.message ? (
          <p className="mt-4 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-left font-mono text-[10.5px] leading-5 text-ink-500">
            {error.message}
          </p>
        ) : null}
        <button type="button" onClick={reset} className="btn-primary mt-6">
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}
