'use client';
import { authClient } from '@/auth/client';

export function SignOut() {
  return (
    <button
      type="button"
      className="min-h-12 shrink-0 rounded-[var(--radius-input)] border border-border px-4 text-sm"
      onClick={async () => {
        await authClient.signOut();
        window.location.href = '/admin/login';
      }}
    >
      Sign out
    </button>
  );
}
