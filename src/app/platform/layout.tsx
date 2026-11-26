import { PRODUCT } from '@/config/product';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Console', robots: { index: false, follow: false } };

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface px-4 py-3 font-semibold">{PRODUCT.name} console</header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
