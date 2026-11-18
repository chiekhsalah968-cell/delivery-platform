'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { registerSchema, type PublicRegistrationRole } from '@delivery/shared';
import { authErrorMessage, fieldError } from '@/components/auth/auth-error';
import { useAuth } from '@/components/auth/auth-provider';
import { Link, useRouter } from '@/i18n/navigation';

const inputClass =
  'w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500';
const labelClass = 'mb-1 block text-sm font-medium text-slate-300';
const ROLES: PublicRegistrationRole[] = ['customer', 'merchant', 'courier'];

export default function RegisterPage() {
  const t = useTranslations('auth');
  const roles = useTranslations('roles');
  const locale = useLocale();
  const router = useRouter();
  const { register } = useAuth();

  const [role, setRole] = useState<PublicRegistrationRole>('customer');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsed = registerSchema.safeParse({
      phone,
      password,
      role,
      email: email.trim() ? email.trim() : undefined,
      locale,
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) fe[issue.path.join('.')] = issue.message;
      setFieldErrors(fe);
      return;
    }
    setSubmitting(true);
    const res = await register(parsed.data);
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
      <h1 className="text-2xl font-bold">{t('register.title')}</h1>
      <p className="mt-2 text-sm text-slate-400">{t('register.subtitle')}</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div>
          <span className={labelClass}>{t('fields.role')}</span>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={`rounded-xl border px-2 py-3 text-sm font-medium transition-colors ${
                  role === r
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                }`}
              >
                {roles(`${r}.title`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="phone" className={labelClass}>
            {t('fields.phone')}
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            className={inputClass}
            placeholder="0550123456"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={Boolean(fieldErrors.phone)}
          />
          {fieldError(fieldErrors, 'phone', t) && (
            <p className="mt-1 text-xs text-red-400">{fieldError(fieldErrors, 'phone', t)}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            {t('fields.email')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            dir="ltr"
            className={inputClass}
            placeholder="name@example.dz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldError(fieldErrors, 'email', t) && (
            <p className="mt-1 text-xs text-red-400">{fieldError(fieldErrors, 'email', t)}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            {t('fields.password')}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
          />
          {fieldError(fieldErrors, 'password', t) && (
            <p className="mt-1 text-xs text-red-400">{fieldError(fieldErrors, 'password', t)}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">{t('fields.passwordHint')}</p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
        >
          {submitting ? t('register.submitting') : t('register.submit')}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        {t('register.haveAccount')}{' '}
        <Link href="/login" className="font-semibold text-emerald-400 hover:text-emerald-300">
          {t('register.loginLink')}
        </Link>
      </p>
    </div>
  );
}