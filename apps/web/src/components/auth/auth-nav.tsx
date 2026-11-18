'use client';

import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from './auth-provider';

export function AuthNav() {
  const t = useTranslations('nav');
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  if (loading) {
    return <div className="h-9 w-28 animate-pulse rounded-full bg-slate-800" aria-hidden />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="rounded-full px-4 py-2 text-sm text-slate-300 transition-colors hover:text-white"
        >
          {t('login')}
        </Link>
        <Link
          href="/register"
          className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
        >
          {t('register')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/dashboard"
        className="rounded-full px-4 py-2 text-sm text-slate-300 transition-colors hover:text-white"
      >
        {t('dashboard')}
      </Link>
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
  );
}