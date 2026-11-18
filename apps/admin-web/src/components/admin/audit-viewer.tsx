'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client-api';
import { Alert, Card, GhostButton, TextInput } from '@/components/ui/form';

interface AuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; phone: string; role: string } | null;
}

export function AuditViewer() {
  const t = useTranslations('audit');
  const common = useTranslations('common');
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [limit, setLimit] = useState(50);

  const refresh = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams({ limit: String(limit) });
    if (action.trim()) query.set('action', action.trim());
    if (entity.trim()) query.set('entity', entity.trim());
    const res = await api<AuditEntry[]>('GET', `admin/audit?${query.toString()}`);
    if (res.ok && res.data) {
      setEntries(res.data);
      setError(null);
    } else {
      setError(res.error ?? common('error'));
    }
    setLoading(false);
  }, [common, action, entity, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      {error && <Alert kind="error">{error}</Alert>}
      <Card title={t('title')} subtitle={t('subtitle')}>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-400">
            {t('actionFilter')}
            <TextInput value={action} onChange={(e) => setAction(e.target.value)} placeholder="auth.login.success" dir="ltr" className="w-48" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-400">
            {t('entityFilter')}
            <TextInput value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="user" dir="ltr" className="w-40" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-400">
            {t('limit')}
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-slate-100"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </label>
          <GhostButton onClick={() => void refresh()}>{t('refresh')}</GhostButton>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">{common('loading')}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-500">{t('empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pe-4 text-start font-medium">{t('time')}</th>
                  <th className="py-2 pe-4 text-start font-medium">{t('actor')}</th>
                  <th className="py-2 pe-4 text-start font-medium">{t('action')}</th>
                  <th className="py-2 pe-4 text-start font-medium">{t('entity')}</th>
                  <th className="py-2 text-start font-medium">{t('details')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-800/60 align-top">
                    <td className="py-3 pe-4 whitespace-nowrap text-slate-400" dir="ltr">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 pe-4" dir="ltr">
                      {e.actor ? e.actor.phone : t('system')}
                    </td>
                    <td className="py-3 pe-4 font-mono text-xs text-emerald-300" dir="ltr">{e.action}</td>
                    <td className="py-3 pe-4 text-slate-400" dir="ltr">
                      {e.entity}
                      {e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ''}
                    </td>
                    <td className="py-3 text-xs text-slate-500" dir="ltr">
                      {e.metadata ? JSON.stringify(e.metadata) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}