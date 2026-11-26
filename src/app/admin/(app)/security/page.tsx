import { userTwoFactor } from '@/auth/session';
import { requireMember } from '@/tenancy/admin';
import { TwoStepSetup } from '@/ui/TwoStepSetup';

export default async function SecurityPage() {
  const { user } = await requireMember();
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Two-step login</h1>
      <p className="text-muted">After your password, you also enter a code from an authenticator app on your phone.</p>
      <TwoStepSetup enabled={await userTwoFactor(user.id)} />
    </div>
  );
}
