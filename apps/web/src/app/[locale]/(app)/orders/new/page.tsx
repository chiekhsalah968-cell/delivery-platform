'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { formatDzd, orderCreateSchema } from '@delivery/shared';
import { useAuth } from '@/components/auth/auth-provider';
import { Alert, Field, GhostButton, PrimaryButton, Select, TextInput } from '@/components/ui/form';
import { useMunicipalities, useProfile, useWilayas } from '@/hooks/use-profile';
import { api } from '@/lib/client-api';
import { Link, useRouter } from '@/i18n/navigation';
import type { Order } from '@/hooks/use-orders';

interface ItemLine {
  name: string;
  quantity: string;
  unitPrice: string;
}

const emptyLine = (): ItemLine => ({ name: '', quantity: '1', unitPrice: '' });

export default function NewOrderPage() {
  const t = useTranslations('orders');
  const p = useTranslations('profile');
  const common = useTranslations('common');
  const locale = useLocale() as 'ar' | 'fr';
  const nameKey = locale === 'ar' ? 'nameAr' : 'nameFr';
  const router = useRouter();
  const { user } = useAuth();
  const { data: profile, loading: profileLoading } = useProfile();
  const wilayas = useWilayas();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [wilayaCode, setWilayaCode] = useState<number | null>(null);
  const [municipalityId, setMunicipalityId] = useState('');
  const [dropoffAddressLine, setDropoffAddressLine] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [items, setItems] = useState<ItemLine[]>([emptyLine()]);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const municipalities = useMunicipalities(wilayaCode);

  if (!user) return null;

  if (user.role !== 'merchant') {
    return (
      <div className="space-y-4">
        <Alert kind="error">{t('merchantOnly')}</Alert>
        <Link href="/orders" className="text-sm text-emerald-300 hover:text-emerald-200">
          {t('backToList')}
        </Link>
      </div>
    );
  }

  if (profileLoading) return <p className="text-sm text-slate-400">{common('loading')}</p>;

  if (profile && !profile.merchantProfile) {
    return (
      <div className="space-y-4">
        <Alert kind="error">{t('incompleteProfile')}</Alert>
        <Link
          href="/profile"
          className="inline-block rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
        >
          {t('completeProfile')}
        </Link>
      </div>
    );
  }

  const subtotal = items.reduce((sum, line) => {
    const qty = Number(line.quantity);
    const price = line.unitPrice === '' ? 0 : Number(line.unitPrice);
    return sum + (Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0);
  }, 0);
  const fee = deliveryFee === '' ? 0 : Number(deliveryFee);
  const previewTotal = subtotal + (Number.isFinite(fee) ? fee : 0);

  function updateLine(index: number, patch: Partial<ItemLine>) {
    setItems((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const payload = {
      customerName,
      customerPhone,
      dropoffWilayaCode: wilayaCode ?? undefined,
      dropoffMunicipalityId: municipalityId || undefined,
      dropoffAddressLine,
      dropoffLatitude: latitude === '' ? undefined : Number(latitude),
      dropoffLongitude: longitude === '' ? undefined : Number(longitude),
      deliveryFee: deliveryFee === '' ? undefined : Number(deliveryFee),
      notes: notes === '' ? undefined : notes,
      items: items.map((line) => ({
        name: line.name,
        quantity: Number(line.quantity),
        unitPrice: line.unitPrice === '' ? undefined : Number(line.unitPrice),
      })),
    };

    const parsed = orderCreateSchema.safeParse(payload);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) fe[issue.path.join('.')] = issue.message;
      setFieldErrors(fe);
      return;
    }

    setSubmitting(true);
    const res = await api<Order>('POST', 'orders', parsed.data);
    setSubmitting(false);
    if (res.ok && res.data) {
      router.push(`/orders/${res.data.id}`);
      return;
    }
    setError(res.error ?? common('error'));
    setFieldErrors(res.fieldErrors ?? {});
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('createTitle')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('createSubtitle')}</p>
      </div>

      <form onSubmit={submit} className="space-y-6" noValidate>
        {error && <Alert kind="error">{error}</Alert>}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold">{t('pickupSection')}</h2>
          {profile?.merchantProfile && (
            <p className="mt-2 text-sm text-slate-400">
              {profile.merchantProfile.businessName} · {profile.merchantProfile.addressLine} ·{' '}
              {profile.merchantProfile.wilaya[nameKey]}
              {profile.merchantProfile.municipality ? ` · ${profile.merchantProfile.municipality[nameKey]}` : ''}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">{t('pickupHint')}</p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold">{t('customerSection')}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={t('customerName')} error={fieldErrors.customerName}>
              <TextInput value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </Field>
            <Field label={t('customerPhone')} error={fieldErrors.customerPhone}>
              <TextInput
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0550123456"
                dir="ltr"
                inputMode="tel"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={p('wilaya')} error={fieldErrors.dropoffWilayaCode}>
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
            <Field label={`${p('municipality')} (${common('optional')})`} error={fieldErrors.dropoffMunicipalityId}>
              <Select
                value={municipalityId}
                onChange={(e) => setMunicipalityId(e.target.value)}
                disabled={!wilayaCode}
              >
                <option value="">{p('selectMunicipality')}</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m[nameKey]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="mt-4">
            <Field label={t('dropoffAddress')} error={fieldErrors.dropoffAddressLine}>
              <TextInput value={dropoffAddressLine} onChange={(e) => setDropoffAddressLine(e.target.value)} />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={`${p('latitude')} (${common('optional')})`} error={fieldErrors.dropoffLatitude}>
              <TextInput value={latitude} onChange={(e) => setLatitude(e.target.value)} dir="ltr" inputMode="decimal" />
            </Field>
            <Field label={`${p('longitude')} (${common('optional')})`} error={fieldErrors.dropoffLongitude}>
              <TextInput value={longitude} onChange={(e) => setLongitude(e.target.value)} dir="ltr" inputMode="decimal" />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t('itemsSection')}</h2>
            <GhostButton onClick={() => setItems((prev) => [...prev, emptyLine()])}>{t('addItem')}</GhostButton>
          </div>

          <div className="mt-4 space-y-4">
            {items.map((line, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:grid-cols-[1fr_120px_150px_auto]">
                <Field label={t('itemName')} error={fieldErrors[`items.${index}.name`]}>
                  <TextInput
                    value={line.name}
                    onChange={(e) => updateLine(index, { name: e.target.value })}
                  />
                </Field>
                <Field label={t('quantity')} error={fieldErrors[`items.${index}.quantity`]}>
                  <TextInput
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: e.target.value })}
                    dir="ltr"
                    inputMode="numeric"
                  />
                </Field>
                <Field label={`${t('unitPrice')} (${common('optional')})`} error={fieldErrors[`items.${index}.unitPrice`]}>
                  <TextInput
                    value={line.unitPrice}
                    onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                    dir="ltr"
                    inputMode="numeric"
                  />
                </Field>
                <div className="flex items-end">
                  <GhostButton
                    onClick={() => setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))}
                    disabled={items.length === 1}
                  >
                    {common('delete')}
                  </GhostButton>
                </div>
              </div>
            ))}
          </div>
          {fieldErrors.items && <p className="mt-2 text-xs text-red-400">{fieldErrors.items}</p>}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={`${t('deliveryFee')} (${common('optional')})`} error={fieldErrors.deliveryFee}>
              <TextInput
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                dir="ltr"
                inputMode="numeric"
              />
            </Field>
            <Field label={`${t('notes')} (${common('optional')})`} error={fieldErrors.notes}>
              <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>

          <dl className="mt-4 space-y-1 border-t border-slate-800 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">{t('subtotal')}</dt>
              <dd>{formatDzd(subtotal, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">{t('deliveryFee')}</dt>
              <dd>{formatDzd(Number.isFinite(fee) ? fee : 0, locale)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>{t('total')}</dt>
              <dd>{formatDzd(previewTotal, locale)}</dd>
            </div>
          </dl>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton disabled={submitting}>{submitting ? t('creating') : t('create')}</PrimaryButton>
          <Link href="/orders" className="text-sm text-slate-400 hover:text-white">
            {common('cancel')}
          </Link>
        </div>
      </form>
    </div>
  );
}
