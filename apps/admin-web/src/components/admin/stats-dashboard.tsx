'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client-api';
import { Alert, Card } from '@/components/ui/form';

interface Stats {
  users: { total: number; byRole: Record<string, number>; byStatus: Record<string, number> };
  pendingApplications: number;
  newUsersLast7Days: number;
  auditEvents: number;
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-bold text-emerald-400">{value}</p>
    </div>
  );
}

export function StatsDashboard() {
  const t = useTranslations('stats');
  const roles = useTranslations('roles');
  const status = useTranslations('dashboard');
  const common = useTranslations('common');
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await api<Stats>('GET', 'admin/stats');
    if (res.ok && res.data) {
      setStats(res.data);
      setError(null);
    } else {
      setError(res.error ?? common('error'));
    }
    setLoading(false);
  }, [common]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <p className="text-sm text-slate-400">{common('loading')}</p>;
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!stats) return null;

  const roleKeys = ['customer', 'merchant', 'courier', 'admin'] as const;
  const statusKeys = ['active', 'pending', 'suspended'] as const;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('totalUsers')} value={stats.users.total} />
        <StatTile label={t('pendingApplications')} value={stats.pendingApplications} />
        <StatTile label={t('newUsers7d')} value={stats.newUsersLast7Days} />
        <StatTile label={t('auditEvents')} value={stats.auditEvents} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t('byRole')}>
          <ul className="space-y-2">
            {roleKeys.map((role) => (
              <li key={role} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2">
                <span className="text-sm text-slate-300">{roles(`${role}.title`)}</span>
                <span className="font-semibold">{stats.users.byRole[role] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={t('byStatus')}>
          <ul className="space-y-2">
            {statusKeys.map((s) => (
              <li key={s} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2">
                <span className="text-sm text-slate-300">{status(`status_${s}`)}</span>
                <span className="font-semibold">{stats.users.byStatus[s] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="text-sm text-slate-500">{t('honestyNote')}</p>
    </div>
  );
}