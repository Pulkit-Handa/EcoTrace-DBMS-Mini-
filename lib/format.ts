export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

const numberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatNumber(value: number | string | null | undefined): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0';
  return numberFormatter.format(numeric);
}

export function formatDecimal(value: number | string | null | undefined): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.0';
  return decimalFormatter.format(numeric);
}

export function formatCompact(value: number): string {
  const absolute = Math.abs(value);
  const trim = (formatted: string) => formatted.replace(/\.0$/, '');

  if (absolute >= 1_000_000_000) {
    return `${trim((value / 1_000_000_000).toFixed(1))}B`;
  }
  if (absolute >= 1_000_000) {
    return `${trim((value / 1_000_000).toFixed(1))}M`;
  }
  if (absolute >= 1_000) {
    return `${trim((value / 1_000).toFixed(1))}k`;
  }
  return numberFormatter.format(value);
}

export function formatKg(value: number | string | null | undefined): string {
  return `${formatNumber(value)} kg`;
}

export function formatDate(
  value: string | Date | null | undefined,
  withTime = false,
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime
      ? { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }
      : {}),
    timeZone: 'UTC',
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, true);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function roleLabel(role: string): string {
  return role === 'auditor' ? 'Auditor' : 'Department lead';
}

export function scopeLabel(scope: number): string {
  if (scope === 1) return 'Scope 1';
  if (scope === 2) return 'Scope 2';
  return 'Scope 3';
}

export function scopeDescription(scope: number): string {
  if (scope === 1) return 'Direct emissions';
  if (scope === 2) return 'Purchased energy';
  return 'Value chain';
}

export function truncate(value: string, max = 220): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
}

export function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}
