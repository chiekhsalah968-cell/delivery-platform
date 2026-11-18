'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { totpCodeSchema } from '@delivery/shared';
import { api } from '@/lib/client-api';
import { useAdminAuth } from '@/components/auth/admin-auth-provider';
import { useRouter } from '@/i18n/navigation';
import { Alert, Card, GhostButton, PrimaryButton, TextInput } from '@/components/ui/form';

interface SetupData {
  secret: string;
  otpauthUrl: string;
}

export function SecurityPanel() {
  const t = useTranslations('security');
  const common = useTranslations('common');
  const { logout } = useAdminAuth();
  const router = useRouter();

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [justEnabled, setJustEnabled] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api<{ enabled: boolean }>('GET', 'admin/2fa/status');
    if (res.ok && res.data) setEnabled(res.data.enabled);
    else setError(res.error ?? common('error'));
  }, [common]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function beginSetup() {
    setError(null);
    setNotice(null);
    setBusy(true);
    const res = await api<SetupData>('POST', 'admin/2fa/setup', {});
    setBusy(false);
    if (res.ok && res.data) {
      setSetup(res.data);
      setCode('');
    } else {
      setError(res.error ?? common('error'));
    }
  }

  async function enable(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = totpCodeSchema.safeParse({ code });
    if (!parsed.success) {
      setError(t('invalidCode'));
      return;
    }
    setBusy(true);
    const res = await api('POST', 'admin/2fa/enable', { code });
    setBusy(false);
    if (res.ok) {
      // The current password-only session no longer satisfies the admin MFA
      // guard, so the operator must sign in again with the authenticator.
      setJustEnabled(true);
      setSetup(null);
    } else {
      setError(res.status === 400 ? t('invalidCode') : (res.error ?? common('error')));
    }
  }

  async function disable(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = totpCodeSchema.safeParse({ code });
    if (!parsed.success) {
      setError(t('invalidCode'));
      return;
    }
    setBusy(true);
    const res = await api('POST', 'admin/2fa/disable', { code });
    setBusy(false);
    if (res.ok) {
      setEnabled(false);
      setCode('');
      setNotice(t('disabled'));
    } else {
      setError(res.status === 400 ? t('invalidCode') : (res.error ?? common('error')));
    }
  }

  async function relogin() {
    await logout();
    router.push('/login');
  }

  if (enabled === null) return <p className="text-sm text-slate-400">{common('loading')}</p>;

  if (justEnabled) {
    return (
      <Card title={t('title')}>
        <Alert kind="success">{t('enabledRelogin')}</Alert>
        <div className="mt-4">
          <PrimaryButton type="button" onClick={relogin}>{t('reloginButton')}</PrimaryButton>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Card title={t('title')} subtitle={t('subtitle')}>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-sm ${
              enabled
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            }`}
          >
            {enabled ? t('statusEnabled') : t('statusDisabled')}
          </span>
        </div>

        {!enabled && !setup && (
          <div className="mt-5">
            <p className="mb-4 text-sm text-slate-400">{t('setupIntro')}</p>
            <PrimaryButton type="button" disabled={busy} onClick={beginSetup}>
              {busy ? common('loading') : t('setupButton')}
            </PrimaryButton>
          </div>
        )}

        {!enabled && setup && (
          <form onSubmit={enable} className="mt-5 space-y-4" noValidate>
            <p className="text-sm text-slate-400">{t('scanIntro')}</p>
            <div className="flex flex-wrap items-center gap-6">
              <div className="rounded-xl bg-white p-3">
                <QRCodeSVG value={setup.otpauthUrl} size={180} level="M" bgColor="#ffffff" fgColor="#0f172a" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-400">{t('manualKey')}</p>
                <code className="block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-emerald-300" dir="ltr">
                  {setup.secret}
                </code>
              </div>
            </div>
            <div className="max-w-xs">
              <label htmlFor="enable-code" className="mb-1 block text-sm font-medium text-slate-300">
                {t('codeLabel')}
              </label>
              <TextInput
                id="enable-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-xl tracking-[0.4em]"
              />
            </div>
            <div className="flex gap-2">
              <PrimaryButton disabled={busy}>{busy ? common('loading') : t('enableButton')}</PrimaryButton>
              <GhostButton onClick={() => setSetup(null)}>{common('cancel')}</GhostButton>
            </div>
          </form>
        )}

        {enabled && (
          <form onSubmit={disable} className="mt-5 space-y-4" noValidate>
            <Alert kind="info">{t('enabledNote')}</Alert>
            <div className="max-w-xs">
              <label htmlFor="disable-code" className="mb-1 block text-sm font-medium text-slate-300">
                {t('codeLabel')}
              </label>
              <TextInput
                id="disable-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-xl tracking-[0.4em]"
              />
            </div>
            <GhostButton disabled={busy}>{busy ? common('loading') : t('disableButton')}</GhostButton>
          </form>
        )}
      </Card>
    </div>
  );
}