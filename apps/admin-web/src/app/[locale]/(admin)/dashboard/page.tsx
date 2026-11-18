'use client';

import { useTranslations } from 'next-intl';
import { StatsDashboard } from '@/components/admin/stats-dashboard';

export default function AdminDashboardPage() {
  const t = useTranslations('app');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
      <StatsDashboard />
    </div>
  );
}