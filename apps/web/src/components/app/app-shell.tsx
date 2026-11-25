'use client';

import { useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Link, usePathname, useRouter } from '@/i18n/navigation';

const NAV = [
  { href: '/dashboard', key: 'dashboard' },
  { href: '/orders', key: 'orders' },
  { href: '/profile', key: 'profile' },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations('app');
  const brand = useTranslations('brand');
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 py-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-slate-950">
            {brand('short')}
          </span>
          <span className="text-lg font-semibold">{brand('name')}</span>
        </Link>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.push('/');
            }}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:text-white"
          >
            {t('logout')}
          </button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-emerald-500 text-slate-950'
                  : 'border border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <main className="flex flex-1 flex-col py-8">{children}</main>
    </div>
  );
}