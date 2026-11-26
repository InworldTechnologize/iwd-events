/** Redis cache with an in-process fallback (dev and tests without Redis). Keys are namespaced by caller. */
import Redis from 'ioredis';

const g = globalThis as unknown as { __iwdRedis?: Redis | null; __iwdMem?: Map<string, { v: string; exp: number }> };

function redis(): Redis | null {
  if (g.__iwdRedis === undefined) {
    const url = process.env.REDIS_URL;
    g.__iwdRedis = url ? new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1, enableOfflineQueue: false }) : null;
    g.__iwdRedis?.on('error', () => {});
  }
  return g.__iwdRedis;
}
const mem = () => (g.__iwdMem ??= new Map());

export async function cacheGet(key: string): Promise<string | null> {
  const r = redis();
  if (r && r.status === 'ready') return r.get(key).catch(() => null);
  const hit = mem().get(key);
  if (!hit || hit.exp < Date.now()) return null;
  return hit.v;
}

export async function cacheSet(key: string, value: string, ttlSeconds: number) {
  const r = redis();
  if (r && r.status === 'ready') {
    await r.set(key, value, 'EX', ttlSeconds).catch(() => {});
    return;
  }
  mem().set(key, { v: value, exp: Date.now() + ttlSeconds * 1000 });
}

export async function cacheDel(key: string) {
  const r = redis();
  if (r && r.status === 'ready') await r.del(key).catch(() => {});
  mem().delete(key);
}
