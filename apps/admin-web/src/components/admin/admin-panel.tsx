'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Fragment, useCallback, useEffect, useState } from 'react';
import type { Role, UserStatus } from '@delivery/shared';
import { api } from '@/lib/client-api';
import { Alert, Card, GhostButton, TextInput } from '@/components/ui/form';

interface GeoRef {
  code?: number;
  id?: string;
  nameAr: string;
  nameFr: string;
}

interface AdminUser {
  id: string;
  phone: string;
  email: string | null;
  role: Role;
  status: UserStatus;
  locale: string;
  createdAt: string;
  customerProfile: { fullName: string } | null;
  merchantProfile: { businessName: string; wilaya: GeoRef } | null;
  courierProfile: { fullName: string; wilaya: GeoRef; vehicles: { id: string }[] } | null;
}

const STATUS_STYLE: Record<UserStatus, string> = {
  active: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  pending: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  suspended: 'border-red-500/40 bg-red-500/10 text-red-300',
};

function profileSummary(user: AdminUser, locale: string, noProfile: string): string {
  const nameKey = locale === 'ar' ? 'nameAr' : 'nameFr';
  if (user.merchantProfile) return `${user.merchantProfile.businessName} · ${user.merchantProfile.wilaya[nameKey]}`;
  if (user.courierProfile) return `${user.courierProfile.fullName} · ${user.courierProfile.wilaya[nameKey]}`;
  if (user.customerProfile) return user.customerProfile.fullName;
  return noProfile;
}

export function AdminPanel() {
  const t = useTranslations('admin');
  const roles = useTranslations('roles');
  const status = useTranslations('dashboard');
  const common = useTranslations('common');
  const locale = useLocale();

  const [pending, setPending] = useState<AdminUser[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | Role>('');
  const [statusFilter, setStatusFilter] = useState<'' | UserStatus>('');

  const refresh = useCallback(async () => {
    const query = new URLSearchParams();
    if (roleFilter) query.set('role', roleFilter);
    if (statusFilter) query.set('status', statusFilter);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const [p, u] = await Promise.all([
      api<AdminUser[]>('GET', 'admin/pending'),
      api<AdminUser[]>('GET', `admin/users${suffix}`),
    ]);
    if (p.ok && p.data) setPending(p.data);
    if (u.ok && u.data) setUsers(u.data);
    if (!p.ok || !u.ok) setError(p.error ?? u.error ?? common('error'));
    setLoading(false);
  }, [common, roleFilter, statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(id: string, action: 'approve' | 'reactivate', successKey: 'approved' | 'reactivated') {
    setError(null);
    setNotice(null);
    setBusyId(id);
    const res = await api('POST', `admin/users/${id}/${action}`, {});
    setBusyId(null);
    if (res.ok) {
      setNotice(t(successKey));
      void refresh();
    } else {
      setError(res.error ?? common('error'));
    }
  }

  async function confirmReason(id: string) {
    setError(null);
    setNotice(null);
    setBusyId(id);
    const res = await api('POST', `admin/users/${id}/reject`, { reason: reason.trim() || undefined });
    setBusyId(null);
    if (res.ok) {
      setReasonId(null);
      setReason('');
      setNotice(t('suspended'));
      void refresh();
    } else {
      setError(res.error ?? common('error'));
    }
  }

  function openReason(id: string) {
    setReasonId(id);
    setReason('');
    setError(null);
    setNotice(null);
  }

  const reasonEditor = (id: string) => (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <TextInput
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('reason')}
        className="flex-1"
      />
      <GhostButton disabled={busyId === id} onClick={() => confirmReason(id)}>
        {t('confirmSuspend')}
      </GhostButton>
      <GhostButton onClick={() => setReasonId(null)}>{common('cancel')}</GhostButton>
    </div>
  );

  if (loading) {
    return <p className="text-sm text-slate-400">{common('loading')}</p>;
  }

  return (
    <div className="space-y-6">
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Card title={t('pending')} subtitle={t('pendingSubtitle')}>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noPending')}</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((user) => (
              <li key={user.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      <span dir="ltr">{user.phone}</span>
                      <span className="ms-2 rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                        {roles(`${user.role}.title`)}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-slate-400">{profileSummary(user, locale, t('noProfile'))}</p>
                    {user.courierProfile && (
                      <p className="mt-1 text-xs text-slate-500">
                        {t('vehiclesCount')}: {user.courierProfile.vehicles.length}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === user.id}
                      onClick={() => act(user.id, 'approve', 'approved')}
                      className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
                    >
                      {t('approve')}
                    </button>
                    <GhostButton disabled={busyId === user.id} onClick={() => openReason(user.id)}>
                      {t('reject')}
                    </GhostButton>
                  </div>
                </div>
                {reasonId === user.id && reasonEditor(user.id)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t('users')} subtitle={t('usersSubtitle')}>
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            {t('role')}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as '' | Role)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100"
            >
              <option value="">{t('allRoles')}</option>
              <option value="customer">{roles('customer.title')}</option>
              <option value="merchant">{roles('merchant.title')}</option>
              <option value="courier">{roles('courier.title')}</option>
              <option value="admin">{roles('admin.title')}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            {t('status')}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | UserStatus)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100"
            >
              <option value="">{t('allStatuses')}</option>
              <option value="active">{status('status_active')}</option>
              <option value="pending">{status('status_pending')}</option>
              <option value="suspended">{status('status_suspended')}</option>
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 pe-4 text-start font-medium">{t('phone')}</th>
                <th className="py-2 pe-4 text-start font-medium">{t('role')}</th>
                <th className="py-2 pe-4 text-start font-medium">{t('status')}</th>
                <th className="py-2 pe-4 text-start font-medium">{t('business')}</th>
                <th className="py-2 text-start font-medium">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <Fragment key={user.id}>
                  <tr className="border-b border-slate-800/60">
                    <td className="py-3 pe-4" dir="ltr">{user.phone}</td>
                    <td className="py-3 pe-4">{roles(`${user.role}.title`)}</td>
                    <td className="py-3 pe-4">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[user.status]}`}>
                        {status(`status_${user.status}`)}
                      </span>
                    </td>
                    <td className="py-3 pe-4 text-slate-400">{profileSummary(user, locale, t('noProfile'))}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        {user.status === 'pending' && (
                          <GhostButton disabled={busyId === user.id} onClick={() => act(user.id, 'approve', 'approved')}>
                            {t('approve')}
                          </GhostButton>
                        )}
                        {user.status !== 'suspended' && (
                          <GhostButton disabled={busyId === user.id} onClick={() => openReason(user.id)}>
                            {t('suspend')}
                          </GhostButton>
                        )}
                        {user.status === 'suspended' && (
                          <GhostButton disabled={busyId === user.id} onClick={() => act(user.id, 'reactivate', 'reactivated')}>
                            {t('reactivate')}
                          </GhostButton>
                        )}
                      </div>
                    </td>
                  </tr>
                  {reasonId === user.id && (
                    <tr className="border-b border-slate-800/60">
                      <td colSpan={5} className="pb-3">{reasonEditor(user.id)}</td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}