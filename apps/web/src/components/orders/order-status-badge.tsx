'use client';

import { useTranslations } from 'next-intl';
import type { OrderStatus } from '@delivery/shared';

const STYLES: Record<OrderStatus, string> = {
  pending_dispatch: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  offered: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  accepted: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  en_route_pickup: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  picked_up: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  en_route_dropoff: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  delivered: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  completed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  unassigned: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  cancelled: 'border-red-500/40 bg-red-500/10 text-red-300',
  failed_delivery: 'border-red-500/40 bg-red-500/10 text-red-300',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations('orders.statuses');
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${STYLES[status]}`}>{t(status)}</span>
  );
}
