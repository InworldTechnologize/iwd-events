import { PRODUCT, copyrightLine } from '@/config/product';

export default function MarketingHome() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
        <p className="text-sm font-semibold text-primary">{PRODUCT.name}</p>
        <h1 className="mt-2 text-4xl font-semibold leading-tight">Run your event business from your phone.</h1>
        <p className="mt-4 text-lg text-muted">Enquiries, packages, quotes, events, crew, stock, payments, GST invoices and your own website, in one app. English and Malayalam.</p>
        <a href="/signup" className="mt-8 inline-flex min-h-12 items-center rounded-[var(--radius-input)] bg-primary px-6 font-semibold text-on-primary">Start free trial</a>
      </main>
      <footer className="border-t border-border px-4 py-6 text-center text-sm text-muted">{copyrightLine()}</footer>
    </div>
  );
}
