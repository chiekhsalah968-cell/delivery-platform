'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { addressSchema } from '@delivery/shared';
import { api } from '@/lib/client-api';
import { useMunicipalities, useWilayas, type Address } from '@/hooks/use-profile';
import { Alert, Field, GhostButton, PrimaryButton, Select, TextInput } from '@/components/ui/form';

export function AddressesManager({ addresses, onChanged }: { addresses: Address[]; onChanged: () => void }) {
  const t = useTranslations('addresses');
  const p = useTranslations('profile');
  const common = useTranslations('common');
  const locale = useLocale();
  const wilayas = useWilayas();
  const nameKey = locale === 'ar' ? 'nameAr' : 'nameFr';

  const [label, setLabel] = useState('');
  const [wilayaCode, setWilayaCode] = useState<number | null>(null);
  const [municipalityId, setMunicipalityId] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const municipalities = useMunicipalities(wilayaCode);

  async function addAddress(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setFieldErrors({});
    const parsed = addressSchema.safeParse({
      label,
      wilayaCode: wilayaCode ?? undefined,
      municipalityId: municipalityId || undefined,
      addressLine,
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) fe[issue.path.join('.')] = issue.message;
      setFieldErrors(fe);
      return;
    }
    setSubmitting(true);
    const res = await api('POST', 'addresses', parsed.data);
    setSubmitting(false);
    if (res.ok) {
      setLabel('');
      setAddressLine('');
      setNotice(t('added'));
      onChanged();
    } else {
      setError(res.error ?? common('error'));
      setFieldErrors(res.fieldErrors ?? {});
    }
  }

  async function remove(id: string) {
    const res = await api('DELETE', `addresses/${id}`);
    if (res.ok) {
      setNotice(t('deleted'));
      onChanged();
    } else {
      setError(res.error ?? common('error'));
    }
  }

  async function makeDefault(a: Address) {
    const res = await api('PUT', `addresses/${a.id}`, {
      label: a.label,
      wilayaCode: a.wilayaCode,
      municipalityId: a.municipalityId ?? undefined,
      addressLine: a.addressLine,
      latitude: a.latitude ?? undefined,
      longitude: a.longitude ?? undefined,
      isDefault: true,
    });
    if (res.ok) onChanged();
    else setError(res.error ?? common('error'));
  }

  return (
    <div className="space-y-5">
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      {addresses.length === 0 ? (
        <p className="text-sm text-slate-500">{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div>
                <p className="font-medium">
                  {a.label}
                  {a.isDefault && (
                    <span className="ms-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                      {common('default')}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {a.addressLine} · {a.wilaya[nameKey]}
                  {a.municipality ? ` · ${a.municipality[nameKey]}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                {!a.isDefault && <GhostButton onClick={() => makeDefault(a)}>{common('makeDefault')}</GhostButton>}
                <GhostButton onClick={() => remove(a.id)}>{common('delete')}</GhostButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addAddress} className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('label')} error={fieldErrors.label}>
            <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('labelPlaceholder')} />
          </Field>
          <Field label={p('addressLine')} error={fieldErrors.addressLine}>
            <TextInput value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={p('wilaya')} error={fieldErrors.wilayaCode}>
            <Select
              value={wilayaCode ?? ''}
              onChange={(e) => {
                setWilayaCode(e.target.value ? Number(e.target.value) : null);
                setMunicipalityId('');
              }}
            >
              <option value="">{p('selectWilaya')}</option>
              {wilayas.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.code} — {w[nameKey]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`${p('municipality')} (${common('optional')})`} error={fieldErrors.municipalityId}>
            <Select value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)} disabled={!wilayaCode}>
              <option value="">{p('selectMunicipality')}</option>
              {municipalities.map((m) => (
                <option key={m.id} value={m.id}>
                  {m[nameKey]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <PrimaryButton disabled={submitting}>{submitting ? common('saving') : t('add')}</PrimaryButton>
      </form>
    </div>
  );
}