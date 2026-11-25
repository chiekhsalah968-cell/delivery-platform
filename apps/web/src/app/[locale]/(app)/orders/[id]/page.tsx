'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { canTransition, formatDzd } from '@delivery/shared';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { Alert, Card, Field, GhostButton, TextInput } from '@/components/ui/form';
import { useOrder } from '@/hooks/use-orders';
import { api } from '@/lib/client-api';
import { Link } from '@/i18n/navigation';

export default function OrderDetailPage() {
  const t = useTranslations('orders');
  const common = useTranslations('common');
  const locale = useLocale() as 'ar' | 'fr';
  const nameKey = locale === 'ar' ? 'nameAr' : 'nameFr';
  const params = useParams<{ id: string }>();
  const { order, loading, error, refresh } = useOrder(params.id);

  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading) return <p className="text-sm text-slate-400">{common('loading')}</p>;

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Alert kind="error">{t('notFound')}</Alert>
        <Link href="/orders" className="text-sm text-emerald-300 hover:text-emerald-200">
          {t('backToList')}
        </Link>
      </div>
    );
  }

  const orderId = order.id;

  async function cancelOrder() {
    setCancelling(true);
    setCancelError(null);
    const res = await api('POST', `orders/${orderId}/cancel`, reason === '' ? {} : { reason });
    setCancelling(false);
    if (res.ok) {
      setShowCancel(false);
      setReason('');
      setNotice(t('cancelled'));
      await refresh();
    } else {
      setCancelError(res.error ?? common('error'));
    }
  }

  const cancellable = canTransition(order.status, 'cancelled');
  const createdAt = new Date(order.createdAt).toLocaleString(locale === 'ar' ? 'ar-DZ' : 'fr-DZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/orders" className="text-sm text-slate-400 hover:text-white">
            ← {t('backToList')}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-bold" dir="ltr">
              {order.orderNumber}
            </h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{createdAt}</p>
        </div>
        {cancellable && (
          <GhostButton onClick={() => setShowCancel((v) => !v)}>{t('cancelOrder')}</GhostButton>
        )}
      </div>

      {notice && <Alert kind="success">{notice}</Alert>}

      {showCancel && cancellable && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5">
          <p className="text-sm text-red-200">{t('cancelConfirm')}</p>
          <div className="mt-3">
            <Field label={`${t('cancelReason')} (${common('optional')})`}>
              <TextInput value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
          {cancelError && <p className="mt-2 text-xs text-red-300">{cancelError}</p>}
          <div className="mt-3 flex gap-2">
            <GhostButton onClick={cancelOrder} disabled={cancelling}>
              {cancelling ? common('saving') : t('cancelOrder')}
            </GhostButton>
            <GhostButton onClick={() => setShowCancel(false)} disabled={cancelling}>
              {common('cancel')}
            </GhostButton>
          </div>
        </div>
      )}

      {order.status === 'cancelled' && order.cancelReason && (
        <Alert kind="error">
          {t('cancelReasonLabel')}: {order.cancelReason}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t('pickup')}>
          <p className="font-medium">{order.pickupBusinessName}</p>
          <p className="mt-1 text-sm text-slate-400">
            {order.pickupAddressLine} · {order.pickupWilaya[nameKey]}
            {order.pickupMunicipality ? ` · ${order.pickupMunicipality[nameKey]}` : ''}
          </p>
        </Card>

        <Card title={t('dropoff')}>
          <p className="font-medium">{order.customerName}</p>
          <p className="mt-1 text-sm text-slate-400" dir="ltr">
            {order.customerPhone}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {order.dropoffAddressLine} · {order.dropoffWilaya[nameKey]}
            {order.dropoffMunicipality ? ` · ${order.dropoffMunicipality[nameKey]}` : ''}
          </p>
        </Card>
      </div>

      <Card title={t('items')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-start text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 text-start font-medium">{t('itemName')}</th>
                <th className="pb-2 text-start font-medium">{t('quantity')}</th>
                <th className="pb-2 text-start font-medium">{t('unitPrice')}</th>
                <th className="pb-2 text-end font-medium">{t('lineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-800/60">
                  <td className="py-3">{item.name}</td>
                  <td className="py-3">{item.quantity}</td>
                  <td className="py-3">{item.unitPrice === null ? '—' : formatDzd(item.unitPrice, locale)}</td>
                  <td className="py-3 text-end">
                    {item.unitPrice === null ? '—' : formatDzd(item.unitPrice * item.quantity, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-400">{t('subtotal')}</dt>
            <dd>{formatDzd(order.subtotal, locale)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">{t('deliveryFee')}</dt>
            <dd>{formatDzd(order.deliveryFee, locale)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-2 text-base font-semibold">
            <dt>{t('total')}</dt>
            <dd>{formatDzd(order.total, locale)}</dd>
          </div>
          <p className="pt-2 text-xs text-slate-500">{t('paymentCod')}</p>
        </dl>

        {order.notes && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm">
            <span className="text-slate-500">{t('notes')}: </span>
            {order.notes}
          </div>
        )}
      </Card>

      <Card title={t('timeline')}>
        <ol className="space-y-3">
          {order.statusEvents.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-xs text-slate-500">
                {new Date(event.createdAt).toLocaleString(locale === 'ar' ? 'ar-DZ' : 'fr-DZ', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
              <OrderStatusBadge status={event.toStatus} />
              {event.note && <span className="text-slate-400">{event.note}</span>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
