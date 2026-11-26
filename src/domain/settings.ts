/**
 * Tenant settings: typed JSON per section. Defaults are product-neutral; no business data in code.
 * Each section is validated with zod on read and on write.
 */
import { z } from 'zod';
import { DOC_TYPES } from './numbering';

const series = z.object({
  prefix: z.string().max(20),
  format: z.string().max(60).default('{prefix}{seq}'),
  pad: z.number().int().min(1).max(8).default(4),
  resetYearly: z.boolean().default(true),
});

export const SETTINGS_SCHEMAS = {
  business: z.object({
    name: z.string().max(120).default(''),
    legalName: z.string().max(160).default(''),
    addressLines: z.array(z.string().max(120)).max(5).default([]),
    phone: z.string().max(20).default(''),
    whatsapp: z.string().max(20).default(''),
    email: z.string().max(120).default(''),
  }),
  branding: z.object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#0E6E66'),
    logoFileId: z.string().uuid().nullable().default(null),
  }),
  tax: z.object({
    gstin: z.string().max(15).default(''),
    stateName: z.string().max(40).default(''),
    stateCode: z.string().max(2).default(''),
    defaultRate: z.number().min(0).max(28).default(18),
    inclusive: z.boolean().default(false),
  }),
  numbering: z.object(Object.fromEntries(DOC_TYPES.map((d) => [d, series.optional()])) as Record<(typeof DOC_TYPES)[number], z.ZodOptional<typeof series>>),
} as const;

export type SettingsSection = keyof typeof SETTINGS_SCHEMAS;
export type Settings<S extends SettingsSection> = z.output<(typeof SETTINGS_SCHEMAS)[S]>;

/** Neutral default prefix per document type, used until the tenant sets its own. */
export const DEFAULT_PREFIX: Record<(typeof DOC_TYPES)[number], string> = {
  enquiry: 'ENQ-',
  quotation: 'QT-',
  proposal: 'PR-',
  proforma: 'PF-',
  invoice: 'INV-',
  receipt: 'RC-',
  credit_note: 'CN-',
  package: 'PKG-',
  rental: 'RN-',
};

export function parseSection<S extends SettingsSection>(section: S, data: unknown): Settings<S> {
  return SETTINGS_SCHEMAS[section].parse(data ?? {}) as Settings<S>;
}
