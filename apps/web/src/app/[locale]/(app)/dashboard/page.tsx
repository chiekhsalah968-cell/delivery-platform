'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/components/auth/auth-provider';
import { useProfile } from '@/hooks/use-profile';
import { AvailabilityToggle } from '@/components/profile/availability-toggle';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/form';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const roles = useTranslations('roles');
  const availability = useTranslations('availability');
  const locale = useLocale();
  const { user } = useAuth();
  const { data, refresh } = useProfile();

  if (!user) return null;

  const nameKey = locale === 'ar' ? 'nameAr' : 'nameFr';
  const profileComplete =
    user.role === 'customer'
      ? !!data?.customerProfile
      : user.role === 'merchant'
        ? !!data?.merchantProfile
        : !!data?.courierProfile;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-sm text-emerald-300">
          {roles(`${user.role}.title`)}
        </span>
        <h1 className="mt-4 text-3xl font-bold">{t('welcome')}</h1>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <dt className="text-sm text-slate-400">{t('phone')}</dt>
            <dd className="mt-1 font-medium" dir="ltr">{user.phone}</dd>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <dt className="text-sm text-slate-400">{t('status')}</dt>
            <dd className="mt-1 font-medium">{t(`status_${user.status}`)}</dd>
          </div>
        </dl>
        {user.status === 'pending' && (
          <p className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            {t('pendingNote')}
          </p>
        )}
      </div>

      {data && !profileComplete && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6">
          <p className="text-sm text-emerald-200">{t('profileIncomplete')}</p>
          <Link
            href="/profile"
            className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
          >
            {t('profileLink')}
          </Link>
        </div>
      )}

      {user.role === 'courier' && data?.courierProfile && (
        <Card title={availability('title')}>
          <AvailabilityToggle availability={data.courierProfile.availability} onChanged={refresh} />
        </Card>
      )}

      {user.role === 'merchant' && data?.merchantProfile && (
        <Card title={t('merchantBusiness')}>
          <p className="font-medium">{data.merchantProfile.businessName}</p>
          <p className="mt-1 text-sm text-slate-400">
            {data.merchantProfile.wilaya[nameKey]}
            {data.merchantProfile.municipality ? ` · ${data.merchantProfile.municipality[nameKey]}` : ''}
          </p>
        </Card>
      )}

      {user.role === 'customer' && data && (
        <Card title={t('customerAddresses')}>
          <p className="text-sm text-slate-400">{data.addresses.length}</p>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/profile"
          className="rounded-xl border border-slate-700 px-5 py-2 text-sm text-slate-300 transition-colors hover:text-white"
        >
          {t('profileLink')}
        </Link>
      </div>

      <p className="text-sm text-slate-500">{t('roadmapNote')}</p>
    </div>
  );
}