'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import {
  courierProfileSchema,
  customerProfileSchema,
  merchantProfileSchema,
} from '@delivery/shared';
import { api } from '@/lib/client-api';
import { useMunicipalities, useWilayas, type ProfileBundle } from '@/hooks/use-profile';
import { Alert, Field, PrimaryButton, Select, TextInput } from '@/components/ui/form';

export function ProfileForm({ bundle, onSaved }: { bundle: ProfileBundle; onSaved: () => void }) {
  const t = useTranslations('profile');
  const common = useTranslations('common');
  const locale = useLocale();
  const role = bundle.role;
  const wilayas = useWilayas();

  const merchant = bundle.merchantProfile;
  const courier = bundle.courierProfile;
  const initialWilaya = merchant?.wilayaCode ?? courier?.wilayaCode ?? null;

  const [fullName, setFullName] = useState(bundle.customerProfile?.fullName ?? courier?.fullName ?? '');
  const [businessName, setBusinessName] = useState(merchant?.businessName ?? '');
  const [description, setDescription] = useState(merchant?.description ?? '');
  const [wilayaCode, setWilayaCode] = useState<number | null>(initialWilaya);
  const [municipalityId, setMunicipalityId] = useState<string>(merchant?.municipalityId ?? courier?.municipalityId ?? '');
  const [addressLine, setAddressLine] = useState(merchant?.addressLine ?? '');
  const [latitude, setLatitude] = useState<string>(merchant?.latitude?.toString() ?? courier?.latitude?.toString() ?? '');
  const [longitude, setLongitude] = useState<string>(merchant?.longitude?.toString() ?? courier?.longitude?.toString() ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const municipalities = useMunicipalities(wilayaCode);
  const nameKey = locale === 'ar' ? 'nameAr' : 'nameFr';

  function buildPayload() {
    const lat = latitude.trim() === '' ? undefined : Number(latitude);
    const lng = longitude.trim() === '' ? undefined : Number(longitude);
    const coords = { latitude: lat, longitude: lng };
    if (role === 'customer') return { fullName };
    if (role === 'merchant') {
      return {
        businessName,
        description: description.trim() || undefined,
        wilayaCode: wilayaCode ?? undefined,
        municipalityId: municipalityId || undefined,
        addressLine,
        ...coords,
      };
    }
    return {
      fullName,
      wilayaCode: wilayaCode ?? undefined,
      municipalityId: municipalityId || undefined,
      ...coords,
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setFieldErrors({});
    const schema =
      role === 'customer' ? customerProfileSchema : role === 'merchant' ? merchantProfileSchema : courierProfileSchema;
    const parsed = schema.safeParse(buildPayload());
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) fe[issue.path.join('.')] = issue.message;
      setFieldErrors(fe);
      return;
    }
    setSubmitting(true);
    const res = await api('PUT', `profiles/me/${role}`, parsed.data);
    setSubmitting(false);
    if (res.ok) {
      setSaved(true);
      onSaved();
    } else {
      setError(res.error ?? common('error'));
      setFieldErrors(res.fieldErrors ?? {});
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert kind="error">{error}</Alert>}
      {saved && <Alert kind="success">{t('savedNote')}</Alert>}

      {role !== 'merchant' && (
        <Field label={t('fullName')} error={fieldErrors.fullName}>
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
        </Field>
      )}

      {role === 'merchant' && (
        <>
          <Field label={t('businessName')} error={fieldErrors.businessName}>
            <TextInput value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </Field>
          <Field label={`${t('description')} (${common('optional')})`} error={fieldErrors.description}>
            <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </>
      )}

      {role !== 'customer' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('wilaya')} error={fieldErrors.wilayaCode}>
              <Select
                value={wilayaCode ?? ''}
                onChange={(e) => {
                  setWilayaCode(e.target.value ? Number(e.target.value) : null);
                  setMunicipalityId('');
                }}
              >
                <option value="">{t('selectWilaya')}</option>
                {wilayas.map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.code} — {w[nameKey]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={`${t('municipality')} (${common('optional')})`} error={fieldErrors.municipalityId}>
              <Select value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)} disabled={!wilayaCode}>
                <option value="">{t('selectMunicipality')}</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m[nameKey]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {role === 'merchant' && (
            <Field label={t('addressLine')} error={fieldErrors.addressLine}>
              <TextInput value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${t('latitude')} (${common('optional')})`} error={fieldErrors.latitude}>
              <TextInput dir="ltr" inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="36.75" />
            </Field>
            <Field label={`${t('longitude')} (${common('optional')})`} error={fieldErrors.longitude}>
              <TextInput dir="ltr" inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="3.06" />
            </Field>
          </div>
        </>
      )}

      <PrimaryButton disabled={submitting}>{submitting ? common('saving') : common('save')}</PrimaryButton>
    </form>
  );
}