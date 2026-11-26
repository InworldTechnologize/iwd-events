import 'server-only';
import { and, eq } from 'drizzle-orm';
import { tenantSettings } from '@/db/schema';
import type { Tx } from '@/db/tenant-tx';
import { parseSection, type Settings, type SettingsSection } from '@/domain/settings';

export async function getSection<S extends SettingsSection>(tx: Tx, tenantId: string, section: S): Promise<Settings<S>> {
  const [row] = await tx.select().from(tenantSettings).where(and(eq(tenantSettings.tenantId, tenantId), eq(tenantSettings.section, section)));
  return parseSection(section, row?.data);
}
