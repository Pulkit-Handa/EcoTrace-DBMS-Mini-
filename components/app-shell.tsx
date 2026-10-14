'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  ChevronRight,
  Database,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { cn, initials, roleLabel } from '@/lib/format';
import { Logo } from '@/components/logo';
import type { SessionUser } from '@/lib/types';

const navigation = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'Live compliance overview',
    icon: LayoutDashboard,
  },
  {
    href: '/reports',
    label: 'Reports',
    description: 'SQL analytics workspace',
    icon: BarChart3,
  },
  {
    href: '/search',
    label: 'Vendor search',
    description: 'MongoDB + pgvector',
    icon: Search,
  },
];

function SidebarContent({
  session,
  pathname,
  onNavigate,
  onLogout,
  loggingOut,
}: {
  session: SessionUser;
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const roleText =
    session.role === 'auditor'
      ? 'Auditor · All departments'
      : `${session.deptName ?? 'Department'} lead`;

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between px-6 pb-6 pt-7">
        <Link href="/dashboard" onClick={onNavigate} aria-label="EcoTrace dashboard">
          <Logo />
        </Link>
        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            className="rounded-lg p-1.5 text-brand-100/70 hover:bg-white/10 hover:text-white"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="mx-4 rounded-2xl border border-white/10 bg-white/[0.055] p-3.5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-400/15 text-[12px] font-bold text-brand-200 ring-1 ring-brand-300/20">
            {initials(session.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-white">
              {session.name}
            </p>
            <p className="truncate text-[10.5px] text-brand-200/60">{roleText}</p>
          </div>
        </div>
      </div>

      <nav className="mt-7 px-3">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-200/40">
          Workspace
        </p>
        <div className="mt-2.5 space-y-1">
          {navigation.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn('nav-link group', active && 'nav-link-active')}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition',
                    active
                      ? 'bg-brand-400/15 text-brand-300'
                      : 'text-brand-200/50 group-hover:text-brand-200',
                  )}
                >
                  <Icon className="h-[17px] w-[17px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{item.label}</span>
                  <span className="mt-0.5 block text-[10.5px] font-normal text-brand-200/40">
                    {item.description}
                  </span>
                </span>
                {active ? (
                  <ChevronRight className="h-3.5 w-3.5 text-brand-300/70" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto space-y-3 p-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-200/45">
            <Database className="h-3.5 w-3.5" />
            Data stack
          </p>
          <div className="mt-3 space-y-2 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-brand-100/65">PostgreSQL</span>
              <span className="flex items-center gap-1.5 text-brand-300/80">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                Relational
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-brand-100/65">MongoDB</span>
              <span className="flex items-center gap-1.5 text-brand-300/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Documents
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-brand-100/65">pgvector</span>
              <span className="flex items-center gap-1.5 text-brand-300/80">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
                Semantic
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12.5px] font-medium text-brand-100/55 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? 'Signing out…' : 'Sign out'}
        </button>
        <p className="px-3 text-[10px] leading-4 text-brand-200/30">
          EcoTrace v1.0 · DBMS mini project
        </p>
      </div>
    </div>
  );
}

export function AppShell({
  session,
  children,
}: {
  session: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  };

  return (
    <div className="min-h-screen bg-ink-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] overflow-hidden bg-[radial-gradient(circle_at_top_left,_#075e48_0%,_#043b2e_45%,_#022c22_100%)] lg:block">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute -left-24 top-1/3 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative h-full">
          <SidebarContent
            session={session}
            pathname={pathname}
            onLogout={handleLogout}
            loggingOut={loggingOut}
          />
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="relative h-full w-[286px] overflow-hidden bg-[radial-gradient(circle_at_top_left,_#075e48_0%,_#043b2e_45%,_#022c22_100%)] shadow-2xl animate-fade-in">
            <div className="absolute inset-0 bg-grid opacity-50" />
            <div className="relative h-full">
              <SidebarContent
                session={session}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
                onLogout={handleLogout}
                loggingOut={loggingOut}
              />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-200/70 bg-ink-50/90 px-4 py-3 backdrop-blur-lg lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-xl border border-ink-200 bg-white p-2 text-ink-700 shadow-sm"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="rounded-xl bg-brand-950 px-3 py-2">
            <Logo />
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-800">
            {initials(session.name)}
          </span>
        </header>

        <main className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
          {children}
        </main>

        <footer className="mx-auto flex w-full max-w-[1480px] flex-wrap items-center justify-between gap-2 px-4 pb-8 text-[11px] text-ink-400 sm:px-6 lg:px-8">
          <span className="flex items-center gap-1.5">
            <Leaf className="h-3.5 w-3.5 text-brand-500" />
            EcoTrace · Carbon compliance platform
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            {session.role === 'auditor'
              ? 'Auditor access · all departments'
              : `${session.deptName ?? 'Department'} scope`}
          </span>
        </footer>
      </div>
    </div>
  );
}
