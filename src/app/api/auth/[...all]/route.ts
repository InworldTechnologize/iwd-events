import { authFor, originFrom } from '@/auth/auth';
import { PLATFORM_HEADER, TENANT_HEADER } from '@/tenancy/headers';

async function handle(req: Request) {
  // Auth runs only on resolved tenant hosts and the platform console (middleware sets the headers).
  if (!req.headers.get(TENANT_HEADER) && !req.headers.get(PLATFORM_HEADER)) return new Response('Not found', { status: 404 });
  const host = req.headers.get('host') ?? '';
  return authFor(originFrom(host, req.headers.get('x-forwarded-proto'))).handler(req);
}
export const GET = handle;
export const POST = handle;
