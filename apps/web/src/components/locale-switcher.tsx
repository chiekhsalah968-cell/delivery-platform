'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

const LABELS: Record<string, string> = { ar: 'العربية', fr: 'Français' };

export function LocaleSwitcher() {
  const current = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 p-1">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          aria-current={locale === current ? 'true' : undefined}
          className={`rounded-full px-3 py-1 text-sm transition-colors ${
            locale === current
              ? 'bg-emerald-500 font-semibold text-slate-950'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          {LABELS[locale]}
        </Link>
      ))}
    </div>
  );
}