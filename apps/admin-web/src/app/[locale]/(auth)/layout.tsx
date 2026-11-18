import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const t = useTranslations();
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-slate-950">
            {t('brand.short')}
          </span>
          <span className="text-lg font-semibold">{t('brand.name')}</span>
        </div>
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center py-10">{children}</main>
    </div>
  );
}