import { PRODUCT } from '@/config/product';

export default function UnknownHost() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">There is no site at this address</h1>
      <p className="mt-3 text-muted">Check the address, or start your own on {PRODUCT.name}.</p>
    </main>
  );
}
