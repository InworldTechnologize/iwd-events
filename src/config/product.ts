/**
 * The product's own identity. The name is not final, so it lives here and nowhere else.
 * Tenant identity (name, logo, contact, GST…) is never in code: it is in tenant_settings.
 */
export const PRODUCT = {
  name: 'IWD Events',
  version: '0.1.0',
  /** Production root domain; tenants live at <slug>.<domain>. Overridden by ROOT_DOMAIN. */
  domain: 'iwd.inworldtechnologize.com',
  maker: {
    name: 'Inworld Technologize',
    url: 'https://inworldtechnologize.com',
    line: 'A product by Inworld Technologize',
  },
} as const;

/** "Powered by <product> · by Inworld Technologize" for tenant websites, emails and PDFs. */
export const poweredByLine = () => `Powered by ${PRODUCT.name} · by ${PRODUCT.maker.name}`;

/** "© <year> Inworld Technologize. All rights reserved." for the marketing site footer. */
export const copyrightLine = (year = new Date().getFullYear()) => `© ${year} ${PRODUCT.maker.name}. All rights reserved.`;

export function rootDomain(): string {
  return (process.env.ROOT_DOMAIN || PRODUCT.domain).toLowerCase();
}
