'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { formatDzd, ORDER_STATUSES, type OrderStatus } from '@delivery/shared';
import { useAuth } from '@/components/auth/auth-provider';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { Alert, Select } from '@/components/ui/form';
import { useOrders } from '@/hooks/use-orders';
import { Link } from '@/i18n/navigation';

export default function OrdersPage() {
  const t = useTranslations('orders');
  const common = useTranslations('common');
  const { user } = useAuth();
  const locale = useLocale() as 'ar' | 'fr';
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const { data, loading, error } = useOrders(status);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-400">{t('subtitle')}</p>
        </div>
        {user.role === 'merchant' && (
          <Link
            href="/orders/new"
            className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
          >
            {t('new')}
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus | '')}
          className="max-w-xs"
          aria-label={t('statusFilter')}
        >
          <option value="">{t('allStatuses')}</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </Select>
        {data && (
          <span className="text-sm text-slate-500">
            {t('countLabel')}: {data.total}
          </span>
        )}
      </div>

      {error && <Alert kind="error">{common('error')}</Alert>}
      {loading && !data && <p className="text-sm text-slate-400">{common('loading')}</p>}

      {data && data.items.length === 0 && (
        <p className="text-sm text-slate-500">{user.role === 'courier' ? t('courierEmpty') : t('empty')}</p>
      )}

      <ul className="space-y-3">
        {data?.items.map((order) => (
          <li key={order.id}>
            <Link
              href={`/orders/${order.id}`}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition-colors hover:border-slate-600"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm font-semibold" dir="ltr">
                    {order.orderNumber}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  {order.customerName} · <span dir="ltr">{order.customerPhone}</span>
                </p>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {order.dropoffAddressLine} · {order.dropoffWilaya[locale === 'ar' ? 'nameAr' : 'nameFr']}
                  {order.dropoffMunicipality
                    ? ` · ${order.dropoffMunicipality[locale === 'ar' ? 'nameAr' : 'nameFr']}`
                    : ''}
                </p>
              </div>
              <div className="text-end">
                <p className="font-semibold">{formatDzd(order.total, locale)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(order.createdAt).toLocaleString(locale === 'ar' ? 'ar-DZ' : 'fr-DZ', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
