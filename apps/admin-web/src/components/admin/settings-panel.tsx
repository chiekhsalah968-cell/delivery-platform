'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { platformPricingSchema } from '@delivery/shared';
import { api } from '@/lib/client-api';
import { Alert, Card, Field, PrimaryButton, TextInput } from '@/components/ui/form';

interface AdminSetting {
  key: string;
  value: Record<string, unknown>;
  updatedBy: string | null;
  updatedAt: string;
}

const PRICING_KEY = 'platform.pricing';

export function SettingsPanel() {
  const t = useTranslations('settings');
  const common = useTranslations('common');

  const [commissionPct, setCommissionPct] = useState(10);
  const [baseDeliveryFee, setBaseDeliveryFee] = useState(200);
  const [perKmFee, setPerKmFee] = useState(50);
  const [minimumFee, setMinimumFee] = useState(200);
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const [list, pricing] = await Promise.all([
      api<AdminSetting[]>('GET', 'admin/settings'),
      api<AdminSetting>('GET', `admin/settings/${PRICING_KEY}`),
    ]);
    if (list.ok && list.data) setSettings(list.data);
    if (pricing.ok && pricing.data) {
      const parsed = platformPricingSchema.safeParse(pricing.data.value);
      if (parsed.success) {
        setCommissionPct(Math.round(parsed.data.commissionRate * 100));
        setBaseDeliveryFee(parsed.data.baseDeliveryFee);
        setPerKmFee(parsed.data.perKmFee);
        setMinimumFee(parsed.data.minimumFee);
      }
    }
    if (!list.ok) setError(list.error ?? common('error'));
    setLoading(false);
  }, [common]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setFieldErrors({});
    const value = {
      commissionRate: commissionPct / 100,
      baseDeliveryFee,
      perKmFee,
      minimumFee,
      currency: 'DZD' as const,
    };
    const parsed = platformPricingSchema.safeParse(value);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) fe[issue.path.join('.')] = issue.message;
      setFieldErrors(fe);
      return;
    }
    setSaving(true);
    const res = await api('PUT', `admin/settings/${PRICING_KEY}`, { value: parsed.data });
    setSaving(false);
    if (res.ok) {
      setNotice(t('saved'));
      void refresh();
    } else {
      setError(res.error ?? common('error'));
      setFieldErrors(res.fieldErrors ?? {});
    }
  }

  if (loading) return <p className="text-sm text-slate-400">{common('loading')}</p>;

  const otherSettings = settings.filter((s) => s.key !== PRICING_KEY);

  return (
    <div className="space-y-6">
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Card title={t('pricingTitle')} subtitle={t('pricingSubtitle')}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('commissionRate')} hint={t('commissionHint')} error={fieldErrors.commissionRate}>
              <TextInput
                type="number"
                min={0}
                max={100}
                step={1}
                dir="ltr"
                value={commissionPct}
                onChange={(e) => setCommissionPct(Number(e.target.value))}
              />
            </Field>
            <Field label={t('baseDeliveryFee')} hint={t('dzdHint')} error={fieldErrors.baseDeliveryFee}>
              <TextInput
                type="number"
                min={0}
                step={1}
                dir="ltr"
                value={baseDeliveryFee}
                onChange={(e) => setBaseDeliveryFee(Number(e.target.value))}
              />
            </Field>
            <Field label={t('perKmFee')} hint={t('dzdHint')} error={fieldErrors.perKmFee}>
              <TextInput
                type="number"
                min={0}
                step={1}
                dir="ltr"
                value={perKmFee}
                onChange={(e) => setPerKmFee(Number(e.target.value))}
              />
            </Field>
            <Field label={t('minimumFee')} hint={t('dzdHint')} error={fieldErrors.minimumFee}>
              <TextInput
                type="number"
                min={0}
                step={1}
                dir="ltr"
                value={minimumFee}
                onChange={(e) => setMinimumFee(Number(e.target.value))}
              />
            </Field>
          </div>
          <p className="text-xs text-slate-500">{t('currencyNote')}</p>
          <PrimaryButton disabled={saving}>{saving ? common('saving') : common('save')}</PrimaryButton>
        </form>
      </Card>

      <Card title={t('otherTitle')} subtitle={t('otherSubtitle')}>
        {otherSettings.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noOther')}</p>
        ) : (
          <ul className="space-y-3">
            {otherSettings.map((s) => (
              <li key={s.key} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="font-mono text-sm text-emerald-300" dir="ltr">{s.key}</p>
                <pre className="mt-2 overflow-x-auto text-xs text-slate-400" dir="ltr">
                  {JSON.stringify(s.value, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}