import { expect, test } from '@playwright/test';
import postgres from 'postgres';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const A = `http://kayal.localhost:${PORT}`;
const B = `http://spice-route.localhost:${PORT}`;
const PASSWORD = 'demo-pass-123';

async function bClientId() {
  const sql = postgres(process.env.DATABASE_URL_OWNER ?? 'postgres://postgres:postgres@localhost:5432/iwd', { max: 1 });
  const [r] = await sql<{ id: string }[]>`select c.id from clients c join tenants t on t.id = c.tenant_id where t.slug = 'spice-route' limit 1`;
  await sql.end();
  return r!.id;
}

async function login(page: import('@playwright/test').Page, base: string, email: string) {
  await page.goto(`${base}/admin/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('owner of A signs in and sees only A', async ({ page }) => {
  await login(page, A, 'owner@kayal.demo');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByText('Kayal Weddings (demo)')).toBeVisible();
  await expect(page.getByText('A product by Inworld Technologize')).toBeVisible();
  await page.goto(`${A}/admin/clients`);
  await expect(page.getByText('Anjali & Rahul')).toBeVisible();
  await expect(page.getByText('Techpark Annual Day')).toHaveCount(0);
});

test('A cannot open B’s client by guessing the URL', async ({ page }) => {
  await login(page, A, 'owner@kayal.demo');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  const res = await page.goto(`${A}/admin/clients/${await bClientId()}`);
  expect(res?.status()).toBe(404);
});

test('B’s owner signed in on A’s host gets nothing', async ({ page }) => {
  await login(page, A, 'owner@spiceroute.demo');
  await page.waitForLoadState('networkidle');
  const res = await page.goto(`${A}/admin`);
  expect(res?.status()).toBe(404);
});

test('a session cookie from A does not open B', async ({ page }) => {
  await login(page, A, 'owner@kayal.demo');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await page.goto(`${B}/admin`);
  await expect(page).toHaveURL(`${B}/admin/login`);
});
