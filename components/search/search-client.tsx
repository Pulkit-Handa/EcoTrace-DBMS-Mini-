'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Database,
  FileText,
  Info,
  Loader2,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { UploadReportForm } from '@/components/search/upload-report-form';
import { cn, formatDate, truncate } from '@/lib/format';
import type { Department, SearchHit, SessionUser } from '@/lib/types';

type SearchMode = 'text' | 'vector';

interface SearchResponse {
  error?: string;
  results?: SearchHit[];
  mode_used?: string;
  vector_ready?: boolean;
  notice?: string;
  total?: number;
  took_ms?: number;
}

const examples = [
  'GHG Protocol',
  'ISO 14064',
  'supply chain emissions',
  'net zero targets',
  'renewable energy',
];

export function SearchClient({
  session,
  departments,
}: {
  session: SessionUser;
  departments: Department[];
}) {
  const [mode, setMode] = useState<SearchMode>('text');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [lastQuery, setLastQuery] = useState('');
  const [modeUsed, setModeUsed] = useState('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [vectorReady, setVectorReady] = useState<boolean | null>(null);
  const [tookMs, setTookMs] = useState<number | null>(null);
  const [deptFilter, setDeptFilter] = useState(
    session.role === 'dept_lead' && session.deptId
      ? String(session.deptId)
      : '',
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const didLoad = useRef(false);

  const loadRecent = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/search?limit=6', {
        signal,
        cache: 'no-store',
      });
      const payload = (await response.json()) as SearchResponse;
      if (!response.ok) throw new Error(payload.error ?? 'Search failed.');
      setResults(payload.results ?? []);
      setModeUsed('recent');
      setVectorReady(Boolean(payload.vector_ready));
      setLastQuery('');
      setNotice(null);
      setTookMs(null);
    } catch (fetchError) {
      if ((fetchError as Error).name === 'AbortError') return;
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Could not load vendor documents.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    const controller = new AbortController();
    void loadRecent(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const runSearch = async (
    searchTerm?: string,
    requestedMode?: SearchMode,
  ) => {
    const term = (searchTerm ?? query).trim();
    if (!term) {
      await loadRecent();
      return;
    }

    const activeMode = requestedMode ?? mode;
    setLoading(true);
    setError(null);
    setNotice(null);
    setQuery(term);
    setMode(activeMode);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: term,
          mode: activeMode,
          dept_id: deptFilter ? Number(deptFilter) : undefined,
          limit: 10,
        }),
      });
      const payload = (await response.json()) as SearchResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Search failed.');
      }

      setResults(payload.results ?? []);
      setModeUsed(payload.mode_used ?? activeMode);
      setVectorReady(Boolean(payload.vector_ready));
      setLastQuery(term);
      setNotice(payload.notice ?? null);
      setTookMs(payload.took_ms ?? null);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : 'Search failed.',
      );
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch();
  };

  const handleUploaded = (result: {
    message: string;
    document: SearchHit;
    vectorStored: boolean;
  }) => {
    const department = departments.find(
      (item) => item.dept_id === result.document.dept_id,
    )?.name;
    setResults((current) => [
      { ...result.document, department },
      ...current.filter((item) => item._id !== result.document._id),
    ]);
    setLastQuery('');
    setModeUsed('recent');
    setToast(result.message);
    setVectorReady((current) =>
      result.vectorStored ? true : current,
    );
  };

  const resultLabel =
    modeUsed === 'recent'
      ? 'Recent vendor documents'
      : modeUsed === 'vector'
        ? 'Semantic matches'
        : 'Full-text matches';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="eyebrow">Vendor intelligence · MongoDB + pgvector</p>
          <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-tight sm:text-[2.35rem]">
            Evidence search
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
            Search unstructured vendor ESG disclosures stored in MongoDB, or use
            the pgvector index to retrieve semantically related evidence across
            the same linked records.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="badge border-brand-200 bg-brand-50 text-brand-800">
              <Database className="h-3.5 w-3.5" />
              MongoDB collection · vendor_reports
            </span>
            <span
              className={cn(
                'badge',
                vectorReady
                  ? 'border-sky-200 bg-sky-50 text-sky-700'
                  : 'border-ink-200 bg-white text-ink-500',
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {vectorReady === null
                ? 'Checking pgvector…'
                : vectorReady
                  ? 'pgvector ready · 384 dimensions'
                  : 'pgvector unavailable'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="btn-primary self-start"
        >
          <Upload className="h-4 w-4" />
          Upload vendor report
        </button>
      </header>

      {/* Search panel */}
      <section className="card overflow-hidden">
        <div className="border-b border-ink-100 bg-gradient-to-r from-brand-50/70 via-white to-white px-5 pt-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex rounded-xl border border-ink-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setMode('text')}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-semibold transition',
                  mode === 'text'
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'text-ink-500 hover:text-ink-800',
                )}
              >
                <Search className="h-3.5 w-3.5" />
                Full-text
                <span
                  className={cn(
                    'rounded px-1 py-0.5 font-mono text-[8.5px]',
                    mode === 'text' ? 'bg-white/15' : 'bg-ink-100',
                  )}
                >
                  $text
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode('vector')}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-semibold transition',
                  mode === 'vector'
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'text-ink-500 hover:text-ink-800',
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Semantic
                <span
                  className={cn(
                    'rounded px-1 py-0.5 font-mono text-[8.5px]',
                    mode === 'vector' ? 'bg-white/15' : 'bg-ink-100',
                  )}
                >
                  vector
                </span>
              </button>
            </div>
            <p className="flex items-center gap-1.5 text-[10.5px] text-ink-400">
              <Info className="h-3.5 w-3.5" />
              {mode === 'text'
                ? 'MongoDB text index with weighted vendor, tag and body fields.'
                : 'Cosine similarity over 384-dimensional local embeddings.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2.5 pb-5 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="input py-3.5 pl-11 pr-4 text-[14px]"
                placeholder={
                  mode === 'vector'
                    ? 'Describe the evidence you need, e.g. “carbon accounting standard”…'
                    : 'Search vendor, report text or compliance tag…'
                }
                aria-label="Search vendor reports"
              />
            </div>
            {session.role === 'auditor' ? (
              <select
                value={deptFilter}
                onChange={(event) => setDeptFilter(event.target.value)}
                className="input sm:w-48"
                aria-label="Filter by department"
              >
                <option value="">All departments</option>
                {departments.map((department) => (
                  <option key={department.dept_id} value={department.dept_id}>
                    {department.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="badge self-center border-ink-200 bg-ink-50 text-ink-600">
                <Building2 className="h-3.5 w-3.5" />
                {session.deptName ?? 'Department'} only
              </span>
            )}
            <button type="submit" disabled={loading} className="btn-primary px-6 py-3.5">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2 pb-5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
              Try
            </span>
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => void runSearch(example)}
                className="rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[10.5px] font-medium text-ink-600 transition hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-800"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {notice ? (
          <div className="flex items-start gap-2.5 border-b border-amber-100 bg-amber-50 px-5 py-3 text-[11.5px] leading-5 text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
          </div>
        ) : null}

        <div className="px-5 py-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-semibold text-ink-900">
                {lastQuery ? `${resultLabel} for “${lastQuery}”` : resultLabel}
              </h2>
              <Badge
                tone={
                  modeUsed === 'vector'
                    ? 'info'
                    : modeUsed === 'text'
                      ? 'warning'
                      : 'neutral'
                }
              >
                {modeUsed === 'vector'
                  ? 'pgvector'
                  : modeUsed === 'text'
                    ? 'MongoDB $text'
                    : 'latest'}
              </Badge>
            </div>
            <span className="text-[10.5px] text-ink-400">
              {results.length} document{results.length === 1 ? '' : 's'}
              {tookMs !== null ? ` · ${tookMs} ms` : ''}
            </span>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </span>
              <button
                type="button"
                onClick={() => void loadRecent()}
                className="btn-secondary shrink-0 py-1.5 text-[11px]"
              >
                Retry
              </button>
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-ink-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="skeleton h-9 w-9 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3 w-40" />
                      <div className="skeleton h-2.5 w-28" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="skeleton h-3 w-full" />
                    <div className="skeleton h-3 w-11/12" />
                    <div className="skeleton h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length === 0 && !error ? (
            <EmptyState
              className="mt-4"
              icon={<FileText className="h-5 w-5" />}
              title="No matching vendor documents"
              description="Try a broader term or switch between full-text and semantic search. You can also upload a new vendor disclosure."
              action={
                <button
                  type="button"
                  onClick={() => setUploadOpen(true)}
                  className="btn-primary"
                >
                  <Upload className="h-4 w-4" />
                  Upload report
                </button>
              }
            />
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {results.map((result) => {
                const similarity =
                  typeof result.similarity === 'number'
                    ? Math.round(result.similarity * 100)
                    : null;
                return (
                  <article
                    key={result._id}
                    className="group flex flex-col rounded-2xl border border-ink-200/80 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-[12px] font-bold text-brand-700 ring-1 ring-brand-100">
                        {result.vendor_name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate text-[13px] font-semibold text-ink-900">
                            {result.vendor_name}
                          </h3>
                          {similarity !== null ? (
                            <Badge tone="info" className="shrink-0">
                              {similarity}% match
                            </Badge>
                          ) : typeof result.score === 'number' ? (
                            <Badge tone="neutral" className="shrink-0 font-mono">
                              score {result.score.toFixed(1)}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-ink-500">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {result.department ??
                              `Department ${result.dept_id}`}
                          </span>
                          <span className="text-ink-300">·</span>
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {result.reporting_year}
                          </span>
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-[11.5px] leading-5 text-ink-600">
                      {truncate(result.raw_text, 220)}
                    </p>

                    {result.compliance_tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {result.compliance_tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[9.5px] font-medium text-brand-800"
                          >
                            {tag}
                          </span>
                        ))}
                        {result.compliance_tags.length > 3 ? (
                          <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[9.5px] text-ink-500">
                            +{result.compliance_tags.length - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink-100 pt-3 text-[9.5px] text-ink-400">
                      <span className="truncate font-mono" title={result._id}>
                        mongo:{result._id.slice(-10)}
                      </span>
                      <span className="shrink-0">
                        {result.metadata?.uploaded_by
                          ? `${result.metadata.uploaded_by} · `
                          : ''}
                        {formatDate(result.createdAt)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Pipeline explainer */}
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: Database,
            step: '01',
            title: 'Document store',
            text: 'Vendor text, tags and metadata are stored in MongoDB.',
          },
          {
            icon: FileText,
            step: '02',
            title: 'Relational bridge',
            text: 'PostgreSQL vendor_reports keeps the mongo_doc_id link.',
          },
          {
            icon: Sparkles,
            step: '03',
            title: 'Vector index',
            text: 'pgvector stores a 384-dim embedding for semantic recall.',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.step} className="card flex items-start gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-500 ring-1 ring-ink-100">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="font-mono text-[9px] font-semibold text-brand-600">
                  {item.step}
                </p>
                <p className="mt-0.5 text-[12px] font-semibold text-ink-800">
                  {item.title}
                </p>
                <p className="mt-1 text-[10.5px] leading-4 text-ink-500">
                  {item.text}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      {uploadOpen ? (
        <UploadReportForm
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          session={session}
          departments={departments}
          onSuccess={handleUploaded}
        />
      ) : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="toast-in fixed bottom-5 right-5 z-[70] flex max-w-sm items-start gap-3 rounded-2xl border border-brand-200 bg-white p-4 shadow-2xl ring-1 ring-brand-100"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-ink-900">
              Vendor report linked
            </p>
            <p className="mt-1 text-[11.5px] leading-5 text-ink-500">{toast}</p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
