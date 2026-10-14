'use client';

import { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Database,
  Eye,
  EyeOff,
  Leaf,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Logo } from '@/components/logo';

const demoAccounts = [
  {
    role: 'Auditor',
    name: 'Alice Chen',
    email: 'alice@eco.com',
    detail: 'All departments',
  },
  {
    role: 'Dept lead',
    name: 'Bob Patel',
    email: 'bob@eco.com',
    detail: 'Operations only',
  },
];

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState('alice@eco.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? 'Unable to sign in.');
        setLoading(false);
        return;
      }

      window.location.assign(nextPath);
    } catch {
      setError('Could not reach the server. Is Next.js running?');
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
      {/* Brand / story panel */}
      <section className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_20%_10%,_#0a6b53_0%,_#064e3b_38%,_#022c22_78%)] px-12 py-10 lg:flex lg:flex-col xl:px-16">
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="absolute -right-28 top-1/4 h-80 w-80 rounded-full bg-brand-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-96 rounded-full bg-emerald-300/5 blur-3xl" />

        <div className="relative">
          <Logo />
        </div>

        <div className="relative mt-auto max-w-xl pb-10">
          <span className="badge border-white/15 bg-white/[0.07] text-brand-100">
            <Sparkles className="h-3.5 w-3.5 text-brand-300" />
            PostgreSQL + MongoDB + pgvector
          </span>
          <h1 className="mt-6 text-balance text-[2.8rem] font-semibold leading-[1.08] tracking-tight text-white xl:text-[3.2rem]">
            Carbon compliance,
            <br />
            without the spreadsheet chaos.
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-7 text-brand-100/65">
            One workspace for Scope 1–3 emissions, department caps, carbon
            credits and the unstructured vendor disclosures behind them.
          </p>

          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: 'Relational truth',
                text: 'ACID compliance in PostgreSQL',
              },
              {
                icon: Database,
                title: 'Flexible evidence',
                text: 'Vendor documents in MongoDB',
              },
              {
                icon: Sparkles,
                title: 'Semantic recall',
                text: '384-dim pgvector search',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm"
                >
                  <Icon className="h-5 w-5 text-brand-300" />
                  <p className="mt-3 text-[12px] font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[10.5px] leading-4 text-brand-100/50">
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-10 flex items-center gap-6 border-t border-white/10 pt-5 text-[11px] text-brand-100/40">
            <span className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-brand-400" />
              Two role-based views
            </span>
            <span className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-brand-400" />
              GHG Protocol aligned
            </span>
          </div>
        </div>
      </section>

      {/* Form panel */}
      <section className="relative flex items-center justify-center overflow-hidden bg-white px-5 py-10 sm:px-8">
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-brand-50/80 to-transparent" />
        <div className="relative w-full max-w-[430px]">
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <div className="rounded-xl bg-brand-950 px-3 py-2">
              <Logo />
            </div>
            <span className="text-[11px] font-medium text-ink-400">v1.0</span>
          </div>

          <div className="rounded-3xl border border-ink-200/80 bg-white/95 p-6 shadow-card backdrop-blur sm:p-8">
            <p className="eyebrow">Welcome back</p>
            <h2 className="mt-2 text-[1.75rem] font-semibold tracking-tight">
              Sign in to EcoTrace
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-500">
              Compliance analytics, emission records and vendor evidence in one
              place.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div>
                <label htmlFor="email" className="label">
                  Work email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="input pl-10"
                    placeholder="you@company.com"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="label">
                    Password
                  </label>
                  <span className="mb-1.5 text-[11px] font-medium text-ink-400">
                    Demo: password123
                  </span>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="input px-10"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-5 text-red-700"
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary mt-1 w-full py-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-ink-100" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                Demo accounts
              </span>
              <div className="h-px flex-1 bg-ink-100" />
            </div>

            <div className="space-y-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword('password123');
                    setError(null);
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    {account.role === 'Auditor' ? (
                      <BarChart3 className="h-4 w-4" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold text-ink-800">
                      {account.name} · {account.role}
                    </span>
                    <span className="block text-[10.5px] text-ink-500">
                      {account.email} · {account.detail}
                    </span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                </button>
              ))}
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] leading-5 text-ink-400">
            Passwords are bcrypt-hashed. Sessions use signed HttpOnly JWT cookies.
            <br />
            DBMS mini project · Semester 5
          </p>
        </div>
      </section>
    </div>
  );
}
