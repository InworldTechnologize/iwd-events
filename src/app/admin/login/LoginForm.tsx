'use client';
import { useState } from 'react';
import { authClient } from '@/auth/client';

export function LoginForm() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const f = new FormData(e.currentTarget);
        const { error } = await authClient.signIn.email({ email: String(f.get('email')), password: String(f.get('password')) });
        setBusy(false);
        if (error) setError('That email and password do not match.');
        else window.location.href = '/admin';
      }}
    >
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input name="email" type="email" autoComplete="email" required className="mt-1 block min-h-12 w-full rounded-[var(--radius-input)] border border-border bg-surface px-3" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="mt-1 block min-h-12 w-full rounded-[var(--radius-input)] border border-border bg-surface px-3" />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button disabled={busy} className="min-h-12 w-full rounded-[var(--radius-input)] bg-primary font-semibold text-on-primary disabled:opacity-60">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
