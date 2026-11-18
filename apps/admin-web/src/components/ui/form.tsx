'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export const inputClass =
  'w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500';
export const labelClass = 'mb-1 block text-sm font-medium text-slate-300';

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function PrimaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="submit"
      {...props}
      className={`rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60 ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60 ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Alert({ kind, children }: { kind: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles =
    kind === 'error'
      ? 'border-red-500/40 bg-red-500/10 text-red-300'
      : kind === 'info'
        ? 'border-sky-500/40 bg-sky-500/10 text-sky-200'
        : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}