'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { loginSchema } from '@delivery/shared';
import { authErrorMessage, fieldError } from '@/components/auth/auth-error';
import { useAuth } from '@/components/auth/auth-provider';
import { Link, useRouter } from '@/i18n/navigation';

const inputClass =
  'w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500';
const labelClass = 'mb-1 block text-sm font-medium text-slate-300';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsed = loginSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) fe[issue.path.join('.')] = issue.message;
      setFieldErrors(fe);
      return;
    }
    setSubmitting(true);
    const res = await login(parsed.data);
    setSubmitting(false);
    if (res.ok) {
      router.push('/dashboard');
    } else {
      setError(authErrorMessage(res, t));
      setFieldErrors(res.fieldErrors ?? {});
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
      <h1 className="text-2xl font-bold">{t('login.title')}</h1>
      <p className="mt-2 text-sm text-slate-400">{t('login.subtitle')}</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="identifier" className={labelClass}>
            {t('fields.identifier')}
          </label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
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

      <p className="mt-6 text-center text-sm text-slate-400">
        {t('login.noAccount')}{' '}
        <Link href="/register" className="font-semibold text-emerald-400 hover:text-emerald-300">
          {t('login.registerLink')}
        </Link>
      </p>
    </div>
  );
}