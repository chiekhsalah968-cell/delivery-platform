'use client';

import { useTranslations } from 'next-intl';
import { SecurityPanel } from '@/components/admin/security-panel';

export default function AdminSecurityPage() {
  const t = useTranslations('app');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('security')}</h1>
      <SecurityPanel />
    </div>
  );
}