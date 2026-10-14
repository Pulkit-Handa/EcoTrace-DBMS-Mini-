'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Info, Loader2, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import type { Department, SessionUser } from '@/lib/types';
import { cn } from '@/lib/format';

const scopes = [
  {
    value: 1,
    label: 'Scope 1',
    description: 'Direct fuel, fleet & generators',
  },
  {
    value: 2,
    label: 'Scope 2',
    description: 'Purchased electricity & energy',
  },
  {
    value: 3,
    label: 'Scope 3',
    description: 'Supply chain & value chain',
  },
];

interface EmissionResponse {
  error?: string;
  message?: string;
  breached?: boolean;
  record?: { record_id: number };
  compliance?: { status?: string };
}

export function AddEmissionForm({
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
  onSuccess: (message: string, breached: boolean) => void;
}) {
  const locked = session.role === 'dept_lead';
  const defaultDepartment =
    session.deptId ?? departments[0]?.dept_id ?? 0;

  const [departmentId, setDepartmentId] = useState(String(defaultDepartment));
  const [scope, setScope] = useState(1);
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDepartmentId(String(session.deptId ?? departments[0]?.dept_id ?? 0));
    setScope(1);
    setValue('');
    setDescription('');
    setError(null);
  }, [open, session.deptId, departments]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/emissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dept_id: Number(departmentId),
          scope,
          value_kgco2: Number(value),
          description,
        }),
      });

      const payload = (await response.json()) as EmissionResponse;

      if (!response.ok) {
        setError(payload.error ?? 'Could not log the emission record.');
        return;
      }

      onSuccess(
        payload.message ?? 'Emission logged successfully.',
        Boolean(payload.breached),
      );
      onClose();
    } catch {
      setError('Could not reach the server. Check that Next.js is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log an emission record"
      subtitle="Structured activity data is written to PostgreSQL and checked against the department cap."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="department" className="label">
            Department
          </label>
          <select
            id="department"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            disabled={locked}
            className="input"
            required
          >
            {departments.map((department) => (
              <option key={department.dept_id} value={department.dept_id}>
                {department.name}
              </option>
            ))}
          </select>
          {locked ? (
            <p className="hint flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Department leads can only log activity for their own department.
            </p>
          ) : null}
        </div>

        <fieldset>
          <legend className="label">GHG scope</legend>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {scopes.map((item) => (
              <label
                key={item.value}
                className={cn(
                  'cursor-pointer rounded-xl border p-3 transition',
                  scope === item.value
                    ? 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-500/10'
                    : 'border-ink-200 bg-white hover:border-ink-300',
                )}
              >
                <input
                  type="radio"
                  name="scope"
                  value={item.value}
                  checked={scope === item.value}
                  onChange={() => setScope(item.value)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-ink-800">
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full border',
                      scope === item.value
                        ? 'border-brand-600 bg-brand-600'
                        : 'border-ink-300',
                    )}
                  >
                    {scope === item.value ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    ) : null}
                  </span>
                </span>
                <span className="mt-1 block text-[10.5px] leading-4 text-ink-500">
                  {item.description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="value" className="label">
            Emission value
          </label>
          <div className="relative">
            <input
              id="value"
              type="number"
              min="0.01"
              step="0.01"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="input pr-20"
              placeholder="450.00"
              required
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-ink-400">
              kg CO2e
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="label">
            Description <span className="font-normal text-ink-400">(optional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="input min-h-[84px] resize-y"
            placeholder="e.g. Diesel generator usage at the Pune warehouse"
            maxLength={500}
          />
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50/70 px-3.5 py-3 text-[11.5px] leading-5 text-sky-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <span>
            An <span className="font-mono text-[10.5px]">AFTER INSERT</span>{' '}
            trigger recalculates the department&apos;s year-to-date total and
            raises a breach notice when the cap is exceeded.
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

        <div className="flex flex-col-reverse gap-2 border-t border-ink-100 pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving record…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Log emission
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
