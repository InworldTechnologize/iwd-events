import { LoginForm } from '@/app/admin/login/LoginForm';
import { MakerLine } from '@/ui/MakerLine';

export default function ConsoleLogin() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold">Staff sign in</h1>
      <LoginForm next="/" />
      <MakerLine />
    </div>
  );
}
