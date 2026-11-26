/**
 * Document numbers: one document_sequences row per tenant × branch × doc type × FY, locked with
 * SELECT … FOR UPDATE in the caller's transaction. Two parallel requests can never get the same
 * number, and a rolled-back insert gives its number back (no gaps from failures).
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { documentSequences } from '@/db/schema';
import type { Tx } from '@/db/tenant-tx';
import { financialYear } from './fy';

export const DOC_TYPES = ['enquiry', 'quotation', 'proposal', 'proforma', 'invoice', 'receipt', 'credit_note', 'package', 'rental'] as const;
export type DocType = (typeof DOC_TYPES)[number];

export type SeriesDefaults = { prefix: string; format?: string; pad?: number; resetYearly?: boolean };

/** Format tokens: {prefix} {fy} {yyyy} {seq}. */
export function formatNumber(format: string, v: { prefix: string; fy: string; seq: number; pad: number; at: Date }): string {
  return format
    .replaceAll('{prefix}', v.prefix)
    .replaceAll('{fy}', v.fy)
    .replaceAll('{yyyy}', String(v.at.getFullYear()))
    .replaceAll('{seq}', String(v.seq).padStart(v.pad, '0'));
}

export async function takeNumber(
  tx: Tx,
  tenantId: string,
  docType: DocType,
  opts: { at?: Date; timeZone?: string; branchId?: string | null; defaults: SeriesDefaults },
): Promise<string> {
  const at = opts.at ?? new Date();
  const fy = opts.defaults.resetYearly === false ? 'ALL' : financialYear(at, opts.timeZone);
  const branchId = opts.branchId ?? null;

  // Create the series row on first use (concurrent creators collapse into one row).
  await tx
    .insert(documentSequences)
    .values({ tenantId, branchId, docType, fy, prefix: opts.defaults.prefix, format: opts.defaults.format ?? '{prefix}{seq}', pad: opts.defaults.pad ?? 4 })
    .onConflictDoNothing();

  const branchCond = branchId ? eq(documentSequences.branchId, branchId) : isNull(documentSequences.branchId);
  const [row] = await tx
    .select()
    .from(documentSequences)
    .where(and(eq(documentSequences.tenantId, tenantId), branchCond, eq(documentSequences.docType, docType), eq(documentSequences.fy, fy)))
    .for('update');
  if (!row) throw new Error(`No sequence for ${docType}`);

  await tx.update(documentSequences).set({ nextNumber: sql`${documentSequences.nextNumber} + 1` }).where(eq(documentSequences.id, row.id));
  return formatNumber(row.format, { prefix: row.prefix, fy, seq: row.nextNumber, pad: row.pad, at });
}
