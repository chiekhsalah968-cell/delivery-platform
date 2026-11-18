import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { AuthNav } from '@/components/auth/auth-nav';
import { LocaleSwitcher } from '@/components/locale-switcher';

const ROLES = ['customer', 'merchant', 'courier'] as const;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomeContent />;
}

function HomeContent() {
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
        <div className="flex items-center gap-3">
          <AuthNav />
          <LocaleSwitcher />
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center py-16">
        <span className="mb-6 w-fit rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1 text-sm text-amber-300">
          {t('hero.badge')}
        </span>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
          {t('hero.title')}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
          {t('hero.subtitle')}
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((role) => (
            <div
              key={role}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition-colors hover:border-emerald-500/50"
            >
              <h2 className="font-semibold text-emerald-400">{t(`roles.${role}.title`)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {t(`roles.${role}.description`)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3 text-sm text-slate-300">
          <span className="rounded-full border border-slate-700 px-4 py-1">{t('facts.wilayas')}</span>
          <span className="rounded-full border border-slate-700 px-4 py-1">{t('facts.cod')}</span>
          <span className="rounded-full border border-slate-700 px-4 py-1">{t('facts.languages')}</span>
        </div>

        <p className="mt-10 text-sm text-slate-500">{t('honesty')}</p>
      </main>

      <footer className="border-t border-slate-800 py-6 text-sm text-slate-500">
        {t('footer')}
      </footer>
    </div>
  );
}