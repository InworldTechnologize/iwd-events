import { authFor, originFrom } from '@/auth/auth';
import { TENANT_HEADER } from '@/tenancy/headers';

async function handle(req: Request) {
  // Auth runs only on resolved tenant hosts (middleware sets the header).
  if (!req.headers.get(TENANT_HEADER)) return new Response('Not found', { status: 404 });
  const host = req.headers.get('host') ?? '';
  return authFor(originFrom(host, req.headers.get('x-forwarded-proto'))).handler(req);
}
export const GET = handle;
export const POST = handle;
