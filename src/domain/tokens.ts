/**
 * Public link tokens (/q/, /p/, /e/, /b/). 128-bit random, base64url; only the SHA-256 is stored.
 * Lookup always runs inside the host's tenant, so a token from tenant B on tenant A's host is a 404.
 */
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { publicTokens } from '@/db/schema';
import type { Tx } from '@/db/tenant-tx';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function issueToken(tx: Tx, tenantId: string, kind: string, entityId: string, expiresAt?: Date) {
  const token = randomBytes(16).toString('base64url');
  await tx.insert(publicTokens).values({ tenantId, kind, entityId, tokenHash: hashToken(token), expiresAt: expiresAt ?? null });
  return token;
}

export async function findToken(tx: Tx, tenantId: string, kind: string, token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [row] = await tx
    .select()
    .from(publicTokens)
    .where(and(eq(publicTokens.tokenHash, hashToken(token)), eq(publicTokens.tenantId, tenantId), eq(publicTokens.kind, kind), isNull(publicTokens.revokedAt)));
  if (!row || (row.expiresAt && row.expiresAt < new Date())) return null;
  return row;
}
