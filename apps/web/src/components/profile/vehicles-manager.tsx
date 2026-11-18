'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { VEHICLE_TYPES, vehicleSchema, type VehicleType } from '@delivery/shared';
import { api } from '@/lib/client-api';
import type { Vehicle } from '@/hooks/use-profile';
import { Alert, Field, GhostButton, PrimaryButton, Select, TextInput } from '@/components/ui/form';

export function VehiclesManager({ vehicles, onChanged }: { vehicles: Vehicle[]; onChanged: () => void }) {
  const t = useTranslations('vehicles');
  const common = useTranslations('common');
  const [type, setType] = useState<VehicleType>('motorcycle');
  const [plateNumber, setPlateNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function addVehicle(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setFieldErrors({});
    const parsed = vehicleSchema.safeParse({
      type,
      plateNumber,
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      color: color.trim() || undefined,
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) fe[issue.path.join('.')] = issue.message;
      setFieldErrors(fe);
      return;
    }
    setSubmitting(true);
    const res = await api('POST', 'vehicles', parsed.data);
    setSubmitting(false);
    if (res.ok) {
      setPlateNumber('');
      setBrand('');
      setModel('');
      setColor('');
      setNotice(t('added'));
      onChanged();
    } else {
      setError(res.error ?? common('error'));
      setFieldErrors(res.fieldErrors ?? {});
    }
  }

  async function remove(id: string) {
    const res = await api('DELETE', `vehicles/${id}`);
    if (res.ok) {
      setNotice(t('deleted'));
      onChanged();
    } else {
      setError(res.error ?? common('error'));
    }
  }

  async function makeDefault(v: Vehicle) {
    const res = await api('PUT', `vehicles/${v.id}`, {
      type: v.type,
      plateNumber: v.plateNumber,
      brand: v.brand ?? undefined,
      model: v.model ?? undefined,
      color: v.color ?? undefined,
      isDefault: true,
    });
    if (res.ok) onChanged();
    else setError(res.error ?? common('error'));
  }

  return (
    <div className="space-y-5">
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      {vehicles.length === 0 ? (
        <p className="text-sm text-slate-500">{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {vehicles.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div>
                <p className="font-medium">
                  {t(`types.${v.type}`)} · <span dir="ltr">{v.plateNumber}</span>
                  {v.isDefault && (
                    <span className="ms-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                      {common('default')}
                    </span>
                  )}
                </p>
                {(v.brand || v.model || v.color) && (
                  <p className="mt-1 text-sm text-slate-400">{[v.brand, v.model, v.color].filter(Boolean).join(' · ')}</p>
                )}
              </div>
              <div className="flex gap-2">
                {!v.isDefault && <GhostButton onClick={() => makeDefault(v)}>{common('makeDefault')}</GhostButton>}
                <GhostButton onClick={() => remove(v.id)}>{common('delete')}</GhostButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addVehicle} className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('type')} error={fieldErrors.type}>
            <Select value={type} onChange={(e) => setType(e.target.value as VehicleType)}>
              {VEHICLE_TYPES.map((vt) => (
                <option key={vt} value={vt}>
                  {t(`types.${vt}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('plateNumber')} error={fieldErrors.plateNumber}>
            <TextInput dir="ltr" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="123456-116-16" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`${t('brand')} (${common('optional')})`}>
            <TextInput value={brand} onChange={(e) => setBrand(e.target.value)} />
          </Field>
          <Field label={`${t('model')} (${common('optional')})`}>
            <TextInput value={model} onChange={(e) => setModel(e.target.value)} />
          </Field>
          <Field label={`${t('color')} (${common('optional')})`}>
            <TextInput value={color} onChange={(e) => setColor(e.target.value)} />
          </Field>
        </div>
        <PrimaryButton disabled={submitting}>{submitting ? common('saving') : t('add')}</PrimaryButton>
      </form>
    </div>
  );
}