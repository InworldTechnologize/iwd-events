/**
 * Caddy on-demand TLS "ask" endpoint: a certificate is issued only for the root domain or a
 * host that resolves to a live tenant (verified custom domains included).
 */
import { resolveTenantByHost } from '@/tenancy/resolve';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const domain = new URL(req.url).searchParams.get('domain');
  const r = await resolveTenantByHost(domain);
  return new Response(null, { status: r.kind === 'unknown' ? 404 : 200 });
}
