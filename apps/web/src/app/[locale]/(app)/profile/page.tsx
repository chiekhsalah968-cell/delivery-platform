'use client';

import { useTranslations } from 'next-intl';
import { useProfile } from '@/hooks/use-profile';
import { ProfileForm } from '@/components/profile/profile-form';
import { VehiclesManager } from '@/components/profile/vehicles-manager';
import { AddressesManager } from '@/components/profile/addresses-manager';
import { AvailabilityToggle } from '@/components/profile/availability-toggle';
import { Alert, Card } from '@/components/ui/form';

export default function ProfilePage() {
  const t = useTranslations('profile');
  const common = useTranslations('common');
  const vehicles = useTranslations('vehicles');
  const addresses = useTranslations('addresses');
  const availability = useTranslations('availability');
  const { data, loading, error, refresh } = useProfile();

  if (loading) {
    return <p className="text-sm text-slate-400">{common('loading')}</p>;
  }
  if (error || !data) {
    return <Alert kind="error">{common('error')}</Alert>;
  }

  const sectionKey =
    data.role === 'customer' ? 'customerSection' : data.role === 'merchant' ? 'merchantSection' : 'courierSection';

  return (
    <div className="space-y-6">
      <Card title={t('title')} subtitle={t('subtitle')}>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-emerald-300">{t(sectionKey)}</h3>
        <ProfileForm bundle={data} onSaved={refresh} />
      </Card>

      {data.role === 'courier' && data.courierProfile && (
        <Card title={availability('title')}>
          <AvailabilityToggle availability={data.courierProfile.availability} onChanged={refresh} />
        </Card>
      )}

      {data.role === 'courier' && (
        <Card title={vehicles('title')} subtitle={vehicles('subtitle')}>
          <VehiclesManager vehicles={data.vehicles} onChanged={refresh} />
        </Card>
      )}

      <Card title={addresses('title')} subtitle={addresses('subtitle')}>
        <AddressesManager addresses={data.addresses} onChanged={refresh} />
      </Card>
    </div>
  );
}