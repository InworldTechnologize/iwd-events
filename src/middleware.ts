/**
 * Host → tenant for every request. Strips any incoming tenant headers, resolves the host
 * (Redis-cached), then:
 *   marketing host  → /marketing/*
 *   tenant host     → /admin/* and /api/* as is, everything else → /site/*
 *   platform host   → /platform/* (super-admin console)
 *   unknown host    → the "no site here" page
 * Pages read the tenant only from the header set here.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { resolveTenantByHost } from '@/tenancy/resolve';
import { normalizeHost } from '@/tenancy/host';
import { HOST_HEADER, PLATFORM_HEADER, TENANT_HEADER } from '@/tenancy/headers';

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2?)$).*)'],
};

export async function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.delete(TENANT_HEADER);
  headers.delete(HOST_HEADER);
  headers.delete(PLATFORM_HEADER);
  const rawHost = req.headers.get('host');
  const host = normalizeHost(rawHost) ?? '';
  headers.set(HOST_HEADER, host);
  const path = req.nextUrl.pathname;

  const r = await resolveTenantByHost(rawHost);
  const url = req.nextUrl.clone();

  if (r.kind === 'marketing') {
    if (path.startsWith('/api/')) return NextResponse.next({ request: { headers } });
    url.pathname = `/marketing${path === '/' ? '' : path}`;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  if (r.kind === 'platform') {
    headers.set(PLATFORM_HEADER, '1');
    if (path.startsWith('/api/')) return NextResponse.next({ request: { headers } });
    url.pathname = `/platform${path === '/' ? '' : path}`;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  if (r.kind === 'unknown') {
    url.pathname = '/marketing/unknown-host';
    return NextResponse.rewrite(url, { request: { headers }, status: 404 });
  }

  headers.set(TENANT_HEADER, r.tenant.tenantId);
  if (path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/')) {
    return NextResponse.next({ request: { headers } });
  }
  url.pathname = `/site${path === '/' ? '' : path}`;
  return NextResponse.rewrite(url, { request: { headers } });
}
