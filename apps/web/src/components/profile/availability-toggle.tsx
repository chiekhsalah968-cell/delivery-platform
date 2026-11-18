'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { COURIER_AVAILABILITY, type CourierAvailability } from '@delivery/shared';
import { api } from '@/lib/client-api';
import { Alert } from '@/components/ui/form';

const ACTIVE_STYLE: Record<CourierAvailability, string> = {
  offline: 'bg-slate-600 text-white',
  online: 'bg-emerald-500 text-slate-950',
  busy: 'bg-amber-500 text-slate-950',
};

export function AvailabilityToggle({
  availability,
  onChanged,
}: {
  availability: CourierAvailability;
  onChanged: () => void;
}) {
  const t = useTranslations('availability');
  const common = useTranslations('common');
  const [current, setCurrent] = useState<CourierAvailability>(availability);
  const [pending, setPending] = useState<CourierAvailability | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);

  async function choose(value: CourierAvailability) {
    if (value === current || pending) return;
    setError(null);
    setNotice(false);
    setPending(value);
    const res = await api('PATCH', 'profiles/me/courier/availability', { availability: value });
    setPending(null);
    if (res.ok) {
      setCurrent(value);
      setNotice(true);
      onChanged();
    } else {
      setError(res.error ?? common('error'));
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">{t('hint')}</p>
      <div className="flex flex-wrap gap-2">
        {COURIER_AVAILABILITY.map((value) => {
          const active = current === value;
          return (
            <button
              key={value}
              type="button"
              disabled={pending !== null}
              onClick={() => choose(value)}
              aria-pressed={active}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                active ? ACTIVE_STYLE[value] : 'border border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {pending === value ? common('saving') : t(value)}
            </button>
          );
        })}
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{t('updated')}</Alert>}
    </div>
  );
}