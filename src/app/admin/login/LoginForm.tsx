'use client';
import { useState } from 'react';
import { authClient } from '@/auth/client';

const input = 'mt-1 block min-h-12 w-full rounded-[var(--radius-input)] border border-border bg-surface px-3';
const primary = 'min-h-12 w-full rounded-[var(--radius-input)] bg-primary font-semibold text-on-primary disabled:opacity-60';

type Step = 'email' | 'phone' | 'phone-code' | 'totp';

/** Normalises "94970 09515" / "+91 94970 09515" to +919497009515 (India by default). */
function toE164(v: string) {
  const d = v.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d;
  const digits = d.replace(/^0+/, '');
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

export function LoginForm({ next = '/admin' }: { next?: string }) {
  const [step, setStep] = useState<Step>('email');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const done = () => (window.location.href = next);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      {(step === 'email' || step === 'phone') && (
        <div role="tablist" className="mb-4 grid grid-cols-2 gap-2 rounded-[var(--radius-input)] bg-surface-2 p-1">
          {(['email', 'phone'] as const).map((s) => (
            <button key={s} role="tab" type="button" aria-selected={step === s} onClick={() => setStep(s)} className={`min-h-11 rounded-[6px] text-sm font-medium ${step === s ? 'bg-surface' : 'text-muted'}`}>
              {s === 'email' ? 'Email' : 'Phone'}
            </button>
          ))}
        </div>
      )}

      {step === 'email' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              const { data, error } = await authClient.signIn.email({ email: String(f.get('email')), password: String(f.get('password')) });
              if (error) return setError('That email and password do not match.');
              if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) return setStep('totp');
              done();
            });
          }}
        >
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input name="email" type="email" autoComplete="email" required className={input} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input name="password" type="password" autoComplete="current-password" required className={input} />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button disabled={busy} className={primary}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      )}

      {step === 'phone' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const n = toE164(phone);
              const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber: n });
              if (error) return setError('We could not send a code to that number.');
              setPhone(n);
              setStep('phone-code');
            });
          }}
        >
          <label className="block">
            <span className="text-sm font-medium">Mobile number</span>
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button disabled={busy} className={primary}>{busy ? 'Sending…' : 'Send code'}</button>
        </form>
      )}

      {step === 'phone-code' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const code = String(new FormData(e.currentTarget).get('code'));
            void run(async () => {
              const { error } = await authClient.phoneNumber.verify({ phoneNumber: phone, code });
              if (error) return setError(error.status === 403 ? (error.message ?? 'Use email sign-in.') : 'That code is not right, or it has expired.');
              done();
            });
          }}
        >
          <p className="text-sm text-muted">We sent a 6-digit code to {phone}.</p>
          <label className="block">
            <span className="text-sm font-medium">Code</span>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className={`${input} tabular tracking-widest`} />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button disabled={busy} className={primary}>{busy ? 'Checking…' : 'Sign in'}</button>
        </form>
      )}

      {step === 'totp' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const code = String(new FormData(e.currentTarget).get('code'));
            void run(async () => {
              const { error } = await authClient.twoFactor.verifyTotp({ code, trustDevice: true });
              if (error) return setError('That code is not right. Use the latest code from your authenticator app.');
              done();
            });
          }}
        >
          <p className="text-sm text-muted">Two-step login is on. Enter the 6-digit code from your authenticator app.</p>
          <label className="block">
            <span className="text-sm font-medium">Authenticator code</span>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className={`${input} tabular tracking-widest`} />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button disabled={busy} className={primary}>{busy ? 'Checking…' : 'Continue'}</button>
        </form>
      )}
    </div>
  );
}
