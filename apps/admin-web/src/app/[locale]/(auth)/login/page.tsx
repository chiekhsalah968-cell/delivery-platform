'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { adminLoginSchema, adminMfaVerifySchema } from '@delivery/shared';
import { authErrorMessage, fieldError } from '@/components/auth/auth-error';
import { useAdminAuth } from '@/components/auth/admin-auth-provider';
import { useRouter } from '@/i18n/navigation';
import { Alert } from '@/components/ui/form';

const inputClass =
  'w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500';
const labelClass = 'mb-1 block text-sm font-medium text-slate-300';

export default function AdminLoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const { login, verifyMfa } = useAdminAuth();

  const [step, setStep] = useState<'password' | 'mfa'>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function onPasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsed = adminLoginSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) fe[issue.path.join('.')] = issue.message;
      setFieldErrors(fe);
      return;
    }
    setSubmitting(true);
    const res = await login(parsed.data.identifier, parsed.data.password);
    setSubmitting(false);
    if (!res.ok) {
      setError(authErrorMessage(res, t));
      setFieldErrors(res.fieldErrors ?? {});
      return;
    }
    if (res.mfaRequired && res.mfaToken) {
      setMfaToken(res.mfaToken);
      setCode('');
      setStep('mfa');
    } else {
      router.push('/dashboard');
    }
  }

  async function onMfaSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsed = adminMfaVerifySchema.safeParse({ mfaToken, code });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) fe[issue.path.join('.')] = issue.message;
      setFieldErrors(fe);
      return;
    }
    setSubmitting(true);
    const res = await verifyMfa(parsed.data.mfaToken, parsed.data.code);
    setSubmitting(false);
    if (res.ok) {
      router.push('/dashboard');
    } else {
      setError(res.status === 401 ? t('mfa.invalidCode') : authErrorMessage(res, t));
      setFieldErrors(res.fieldErrors ?? {});
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
        {t('login.badge')}
      </span>
      <h1 className="mt-4 text-2xl font-bold">{t('login.title')}</h1>
      <p className="mt-2 text-sm text-slate-400">
        {step === 'password' ? t('login.subtitle') : t('mfa.subtitle')}
      </p>

      {step === 'password' ? (
        <form onSubmit={onPasswordSubmit} className="mt-6 space-y-4" noValidate>
          {error && <Alert kind="error">{error}</Alert>}
          <div>
            <label htmlFor="identifier" className={labelClass}>
              {t('fields.identifier')}
            </label>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              dir="ltr"
              className={inputClass}
              placeholder={t('fields.identifierPlaceholder')}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              aria-invalid={Boolean(fieldErrors.identifier)}
            />
            {fieldError(fieldErrors, 'identifier', t) && (
              <p className="mt-1 text-xs text-red-400">{fieldError(fieldErrors, 'identifier', t)}</p>
            )}
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>
              {t('fields.password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className={inputClass}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
            />
            {fieldError(fieldErrors, 'password', t) && (
              <p className="mt-1 text-xs text-red-400">{fieldError(fieldErrors, 'password', t)}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
          >
            {submitting ? t('login.submitting') : t('login.submit')}
          </button>
        </form>
      ) : (
        <form onSubmit={onMfaSubmit} className="mt-6 space-y-4" noValidate>
          {error && <Alert kind="error">{error}</Alert>}
          <div>
            <label htmlFor="code" className={labelClass}>
              {t('mfa.codeLabel')}
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={6}
              className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              aria-invalid={Boolean(fieldErrors.code)}
            />
            {fieldError(fieldErrors, 'code', t) && (
              <p className="mt-1 text-xs text-red-400">{fieldError(fieldErrors, 'code', t)}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
          >
            {submitting ? t('mfa.submitting') : t('mfa.submit')}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('password');
              setMfaToken('');
              setCode('');
              setError(null);
            }}
            className="w-full rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:text-white"
          >
            {t('mfa.back')}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-slate-500">{t('login.privateNotice')}</p>
    </div>
  );
}