import type { Metadata, Viewport } from 'next';
import { PRODUCT } from '@/config/product';
import './globals.css';

export const metadata: Metadata = { title: { default: PRODUCT.name, template: `%s · ${PRODUCT.name}` } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
