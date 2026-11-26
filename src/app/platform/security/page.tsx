import { userTwoFactor } from '@/auth/session';
import { requireStaff } from '@/tenancy/platform';
import { TwoStepSetup } from '@/ui/TwoStepSetup';

export default async function ConsoleSecurity() {
  const { user } = await requireStaff();
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Two-step login</h1>
      <TwoStepSetup enabled={await userTwoFactor(user.id)} />
    </div>
  );
}
