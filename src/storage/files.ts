/**
 * Object storage. Keys are always tenants/<tenant_id>/<area>/<uuid>.<ext> (also enforced by a CHECK
 * on files.key). Downloads are short-lived signed URLs, issued only after an RLS read of the row,
 * so a file id from another tenant is simply "not found".
 */
import 'server-only';
import { randomUUID } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { and, eq } from 'drizzle-orm';
import { files } from '@/db/schema';
import type { Tx } from '@/db/tenant-tx';

const AREA = /^[a-z][a-z0-9-]{0,30}$/;
const EXT = /^[a-z0-9]{1,8}$/;

export function fileKey(tenantId: string, area: string, ext: string, id = randomUUID()) {
  if (!AREA.test(area) || !EXT.test(ext)) throw new Error('Bad file area or extension');
  return `tenants/${tenantId}/${area}/${id}.${ext}`;
}

let client: S3Client | undefined;
function s3() {
  client ??= new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'test', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'test' },
  });
  return client;
}
const bucket = () => process.env.S3_BUCKET ?? 'iwd';

/** Registers a file row and returns a signed upload URL (the browser uploads straight to storage). */
export async function prepareUpload(tx: Tx, tenantId: string, a: { area: string; ext: string; contentType: string; bytes: number; userId: string | null }) {
  const key = fileKey(tenantId, a.area, a.ext);
  const [row] = await tx.insert(files).values({ tenantId, area: a.area, key, contentType: a.contentType, bytes: a.bytes, createdBy: a.userId }).returning();
  const url = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: a.contentType }), { expiresIn: 600 });
  return { file: row!, uploadUrl: url };
}

/** Signed download URL for a file of the current tenant, or null (other tenant's id, or missing). */
export async function signedDownloadUrl(tx: Tx, tenantId: string, fileId: string, expiresIn = 300): Promise<string | null> {
  const [row] = await tx.select().from(files).where(and(eq(files.id, fileId), eq(files.tenantId, tenantId)));
  if (!row || !row.key.startsWith(`tenants/${tenantId}/`)) return null;
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: row.key }), { expiresIn });
}
