import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { getDepartments } from '@/lib/queries';
import { SearchClient } from '@/components/search/search-client';

export const metadata: Metadata = {
  title: 'Vendor search',
  description:
    'Search vendor ESG disclosures with MongoDB full-text search and pgvector semantic similarity.',
};

export const dynamic = 'force-dynamic';

export default async function SearchPage() {
  const session = await requireSession();
  const departments = await getDepartments();

  return <SearchClient session={session} departments={departments} />;
}
