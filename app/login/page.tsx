import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginForm } from '@/components/login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to the EcoTrace carbon compliance platform.',
};

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect('/dashboard');

  const params = await searchParams;
  const candidate = params.next;
  const nextPath =
    typeof candidate === 'string' &&
    candidate.startsWith('/') &&
    !candidate.startsWith('//')
      ? candidate
      : '/dashboard';

  return <LoginForm nextPath={nextPath} />;
}
