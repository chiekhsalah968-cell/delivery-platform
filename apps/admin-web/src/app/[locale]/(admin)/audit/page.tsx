'use client';

import { useTranslations } from 'next-intl';
import { AuditViewer } from '@/components/admin/audit-viewer';

export default function AdminAuditPage() {
  const t = useTranslations('app');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('audit')}</h1>
      <AuditViewer />
    </div>
  );
}