import { notFound } from 'next/navigation';
import { requestTenantId } from '@/tenancy/context';
import { MakerLine } from '@/ui/MakerLine';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (!(await requestTenantId())) notFound();
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <LoginForm />
      <MakerLine />
    </main>
  );
}
