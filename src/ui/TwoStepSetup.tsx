'use client';
import { useState } from 'react';
import { authClient } from '@/auth/client';

const input = 'mt-1 block min-h-12 w-full rounded-[var(--radius-input)] border border-border bg-surface px-3';
const primary = 'min-h-12 w-full rounded-[var(--radius-input)] bg-primary font-semibold text-on-primary disabled:opacity-60';

/** Turn on two-step login: password → authenticator key + backup codes → confirm one code. */
export function TwoStepSetup({ enabled }: { enabled: boolean }) {
  const [uri, setUri] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);

  if (on) return <p className="rounded-[var(--radius-card)] border border-border bg-surface p-4">Two-step login is on for your account.</p>;

  if (!uri)
    return (
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const { data, error } = await authClient.twoFactor.enable({ password: String(new FormData(e.currentTarget).get('password')) });
          setBusy(false);
          if (error || !data || !('totpURI' in data)) return setError('That password is not right.');
          setUri(data.totpURI);
          setCodes(data.backupCodes);
        }}
      >
        <label className="block">
          <span className="text-sm font-medium">Your password</span>
          <input name="password" type="password" autoComplete="current-password" required className={input} />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button disabled={busy} className={primary}>Set up two-step login</button>
      </form>
    );

  const secret = new URL(uri).searchParams.get('secret') ?? '';
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const { error } = await authClient.twoFactor.verifyTotp({ code: String(new FormData(e.currentTarget).get('code')) });
        setBusy(false);
        if (error) return setError('That code is not right. Try the latest one.');
        setOn(true);
      }}
    >
      <p>Add this key to an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password):</p>
      <p className="tabular break-all rounded-[var(--radius-input)] bg-surface-2 p-3 font-mono text-sm" data-testid="totp-secret">{secret}</p>
      <p className="text-sm text-muted">Keep these backup codes somewhere safe. Each works once if you lose your phone:</p>
      <ul className="tabular grid grid-cols-2 gap-1 font-mono text-sm">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
      <label className="block">
        <span className="text-sm font-medium">Code from the app</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className={`${input} tabular tracking-widest`} />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button disabled={busy} className={primary}>Turn on</button>
    </form>
  );
}
