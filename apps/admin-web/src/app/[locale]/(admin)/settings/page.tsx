'use client';

import { useTranslations } from 'next-intl';
import { SettingsPanel } from '@/components/admin/settings-panel';

export default function AdminSettingsPage() {
  const t = useTranslations('app');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('settings')}</h1>
      <SettingsPanel />
    </div>
  );
}