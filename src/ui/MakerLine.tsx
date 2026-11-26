import { PRODUCT } from '@/config/product';

export function MakerLine() {
  return (
    <p className="mt-8 text-center text-sm text-muted">
      <a className="underline-offset-4 hover:underline" href={PRODUCT.maker.url} rel="noopener">
        {PRODUCT.maker.line}
      </a>
    </p>
  );
}
