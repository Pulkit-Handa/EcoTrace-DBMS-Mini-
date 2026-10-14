'use client';

import { useEffect, useState } from 'react';
import {
  Database,
  FileText,
  Info,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import type { Department, SearchHit, SessionUser } from '@/lib/types';

interface UploadResponse {
  error?: string;
  message?: string;
  vector_stored?: boolean;
  report_id?: number;
  document?: SearchHit;
}

export function UploadReportForm({
  open,
  onClose,
  session,
  departments,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  session: SessionUser;
  departments: Department[];
  onSuccess: (result: {
    message: string;
    document: SearchHit;
    vectorStored: boolean;
  }) => void;
}) {
  const locked = session.role === 'dept_lead';
  const [vendorName, setVendorName] = useState('');
  const [departmentId, setDepartmentId] = useState(
    String(session.deptId ?? departments[0]?.dept_id ?? 0),
  );
  const [reportingYear, setReportingYear] = useState(
    String(new Date().getFullYear()),
  );
  const [pages, setPages] = useState('');
  const [tags, setTags] = useState('');
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVendorName('');
    setDepartmentId(String(session.deptId ?? departments[0]?.dept_id ?? 0));
    setReportingYear(String(new Date().getFullYear()));
    setPages('');
    setTags('');
    setRawText('');
    setError(null);
  }, [open, session.deptId, departments]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_name: vendorName,
          dept_id: Number(departmentId),
          reporting_year: Number(reportingYear),
          pages: pages ? Number(pages) : undefined,
          compliance_tags: tags,
          raw_text: rawText,
        }),
      });

      const payload = (await response.json()) as UploadResponse;

      if (!response.ok || !payload.document) {
        setError(payload.error ?? 'Could not upload the vendor report.');
        return;
      }

      onSuccess({
        message: payload.message ?? 'Vendor report uploaded.',
        document: payload.document,
        vectorStored: Boolean(payload.vector_stored),
      });
      onClose();
    } catch {
      setError('Upload failed. Confirm MongoDB and PostgreSQL are running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload a vendor disclosure"
      subtitle="Unstructured evidence goes to MongoDB; a bridge row is written to PostgreSQL."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="vendor-name" className="label">
              Vendor name
            </label>
            <input
              id="vendor-name"
              value={vendorName}
              onChange={(event) => setVendorName(event.target.value)}
              className="input"
              placeholder="e.g. GreenLogix Pvt Ltd"
              maxLength={150}
              required
            />
          </div>

          <div>
            <label htmlFor="upload-department" className="label">
              Department
            </label>
            <select
              id="upload-department"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              disabled={locked}
              className="input"
            >
              {departments.map((department) => (
                <option key={department.dept_id} value={department.dept_id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="reporting-year" className="label">
                Reporting year
              </label>
              <input
                id="reporting-year"
                type="number"
                min={2000}
                max={new Date().getFullYear() + 1}
                value={reportingYear}
                onChange={(event) => setReportingYear(event.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label htmlFor="pages" className="label">
                Pages
              </label>
              <input
                id="pages"
                type="number"
                min={1}
                max={5000}
                value={pages}
                onChange={(event) => setPages(event.target.value)}
                className="input"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="tags" className="label">
              Compliance tags
            </label>
            <input
              id="tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className="input"
              placeholder="GHG Protocol, ISO 14064, Scope 3 Cat 11"
            />
            <p className="hint">
              Comma-separated. Tags receive a higher weight in the MongoDB text
              index and the pgvector embedding.
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between">
            <label htmlFor="raw-text" className="label">
              Report text / ESG excerpt
            </label>
            <span className="mb-1.5 text-[10px] text-ink-400">
              {rawText.length.toLocaleString()} / 20,000
            </span>
          </div>
          <textarea
            id="raw-text"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            className="input min-h-[170px] resize-y leading-6"
            placeholder="Paste the vendor's disclosure, assurance statement or reporting excerpt…"
            maxLength={20_000}
            required
          />
        </div>

        <div className="grid gap-2.5 rounded-xl border border-ink-200 bg-ink-50/60 p-3.5 text-[11px] leading-5 text-ink-600 sm:grid-cols-2">
          <span className="flex items-start gap-2">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            MongoDB stores the full, flexible document and its metadata.
          </span>
          <span className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            PostgreSQL stores the vendor link and a 384-dim vector.
          </span>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-700"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-ink-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-[10.5px] text-ink-400">
            <Info className="h-3.5 w-3.5" />
            Stored as {session.name} · {session.role}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Storing document…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload report
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
