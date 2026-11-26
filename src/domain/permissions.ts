/**
 * Built-in roles and capabilities (DM Events' role rules, now per tenant). Each tenant gets these
 * six roles as rows in `roles`; custom roles (higher plans) carry their own capability lists.
 */
export const ROLES = ['owner', 'manager', 'sales', 'accounts', 'crew_lead', 'staff'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_INFO: Record<Role, { label: string; summary: string }> = {
  owner: { label: 'Owner', summary: 'Everything, including settings, users and deleting.' },
  manager: { label: 'Manager', summary: 'All work: sales, documents, money, catalogue, menu, gallery. Not users or settings.' },
  sales: { label: 'Sales', summary: 'Enquiries, clients and quotations. No cost prices, margins or invoices.' },
  accounts: { label: 'Accounts', summary: 'Invoices, payments and receipts; reads clients and quotations to bill them.' },
  crew_lead: { label: 'Crew lead', summary: 'Enquiries, the calendar, and the events they are on: run sheets, tasks, crew and vendors. No money.' },
  staff: { label: 'Staff', summary: 'Enquiries, the calendar, their own tasks and the events they are on (read-only). No money.' },
};

const ALL: Role[] = [...ROLES];

export const CAPABILITIES = {
  enquiries: ALL,
  calendar: ALL,
  'clients.view': ['owner', 'manager', 'sales', 'accounts'],
  'clients.edit': ['owner', 'manager', 'sales', 'accounts'],
  'clients.delete': ['owner', 'manager'],
  'catalogue.view': ['owner', 'manager', 'sales', 'accounts'],
  'catalogue.edit': ['owner', 'manager'],
  costs: ['owner', 'manager'],
  quotations: ['owner', 'manager', 'sales'],
  'quotations.view': ['owner', 'manager', 'sales', 'accounts'],
  invoices: ['owner', 'manager', 'accounts'],
  'invoices.void': ['owner', 'accounts'],
  content: ['owner', 'manager'],
  'money.dashboard': ['owner', 'manager', 'accounts'],
  settings: ['owner'],
  users: ['owner'],
  checklist: ['owner', 'manager'],
  website: ['owner', 'manager', 'sales'],
  events: ALL,
  'events.all': ['owner', 'manager', 'sales', 'accounts'],
  'events.edit': ['owner', 'manager', 'sales'],
  'events.delete': ['owner', 'manager'],
  runsheet: ['owner', 'manager', 'sales', 'crew_lead'],
  'tasks.templates': ['owner', 'manager'],
  vendors: ['owner', 'manager', 'sales'],
  'vendors.edit': ['owner', 'manager'],
  crew: ['owner', 'manager', 'crew_lead', 'accounts'],
  'crew.edit': ['owner', 'manager'],
  'crew.rates': ['owner', 'manager', 'accounts'],
  stock: ['owner', 'manager', 'sales', 'crew_lead'],
  'stock.edit': ['owner', 'manager'],
  expenses: ['owner', 'manager', 'accounts'],
  profit: ['owner', 'manager'],
  portal: ['owner', 'manager', 'sales'],
  kitchen: ['owner', 'manager', 'crew_lead'],
  'kitchen.edit': ['owner', 'manager'],
  reports: ['owner', 'manager', 'accounts'],
  activity: ['owner', 'manager'],
  export: ['owner'],
  rentals: ['owner', 'manager', 'sales', 'crew_lead'],
  'rentals.manage': ['owner', 'manager'],
  'rentals.rates': ['owner', 'manager'],
  staff: ['owner', 'manager', 'crew_lead'],
  'staff.edit': ['owner', 'manager'],
  payroll: ['owner', 'accounts'],
  'payroll.advances': ['owner', 'accounts'],
} satisfies Record<string, Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function capabilitiesFor(role: Role): Capability[] {
  return (Object.keys(CAPABILITIES) as Capability[]).filter((c) => (CAPABILITIES[c] as Role[]).includes(role));
}

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}
