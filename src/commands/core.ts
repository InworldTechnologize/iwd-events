/**
 * Typed commands: the only way business state changes. The UI, the public API and future agents
 * all call execute(). Each command: validates input (zod), checks the capability, runs inside
 * withTenant, and writes audit_log + outbox_events in the same transaction.
 */
import 'server-only';
import type { z } from 'zod';
import { auditLog, outboxEvents } from '@/db/schema';
import { withTenant, type TenantContext, type Tx } from '@/db/tenant-tx';
import type { Capability } from '@/domain/permissions';

export class CommandError extends Error {
  constructor(public code: 'forbidden' | 'invalid' | 'not_found' | 'conflict', message: string) {
    super(message);
  }
}

export type Emit = (type: string, entityType: string, entityId: string, payload?: Record<string, unknown>) => void;
export type Audit = (entry: { entityType: string; entityId: string; before?: unknown; after?: unknown }) => void;

export type CommandDef<I extends z.ZodType, O> = {
  name: string;
  input: I;
  capability: Capability;
  run: (args: { tx: Tx; ctx: TenantContext; input: z.output<I>; emit: Emit; audit: Audit }) => Promise<O>;
};

export function defineCommand<I extends z.ZodType, O>(def: CommandDef<I, O>) {
  return def;
}

export async function execute<I extends z.ZodType, O>(cmd: CommandDef<I, O>, ctx: TenantContext, rawInput: unknown): Promise<O> {
  if (!ctx.capabilities.has(cmd.capability)) throw new CommandError('forbidden', `${cmd.name}: not allowed`);
  const parsed = cmd.input.safeParse(rawInput);
  if (!parsed.success) throw new CommandError('invalid', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));

  return withTenant(ctx, async (tx) => {
    const events: { type: string; entityType: string; entityId: string; payload: Record<string, unknown> }[] = [];
    const audits: { entityType: string; entityId: string; before?: unknown; after?: unknown }[] = [];
    const result = await cmd.run({
      tx,
      ctx,
      input: parsed.data,
      emit: (type, entityType, entityId, payload = {}) => events.push({ type, entityType, entityId, payload }),
      audit: (e) => audits.push(e),
    });
    if (audits.length === 0) audits.push({ entityType: 'none', entityId: '' });
    await tx.insert(auditLog).values(
      audits.map((a) => ({
        tenantId: ctx.tenantId,
        actorType: ctx.actorType,
        actorId: ctx.userId,
        impersonatedBy: ctx.impersonatedBy ?? null,
        command: cmd.name,
        entityType: a.entityType,
        entityId: a.entityId,
        before: (a.before ?? null) as never,
        after: (a.after ?? null) as never,
        ip: ctx.ip ?? null,
      })),
    );
    if (events.length) await tx.insert(outboxEvents).values(events.map((e) => ({ tenantId: ctx.tenantId, ...e })));
    return result;
  });
}
