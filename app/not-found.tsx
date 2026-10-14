import Link from 'next/link';
import { Leaf } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-6">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <Leaf className="h-7 w-7" />
        </div>
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
          404 · Not found
        </p>
        <h1 className="mt-2 text-2xl font-semibold">This page has no footprint.</h1>
        <p className="mt-2 text-sm leading-6 text-ink-500">
          The page you requested does not exist or may have been moved.
        </p>
        <Link href="/dashboard" className="btn-primary mt-6 w-full">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
