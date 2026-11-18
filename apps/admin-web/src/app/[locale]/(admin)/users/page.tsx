'use client';

import { useTranslations } from 'next-intl';
import { AdminPanel } from '@/components/admin/admin-panel';

export default function AdminUsersPage() {
  const t = useTranslations('app');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('users')}</h1>
      <AdminPanel />
    </div>
  );
}