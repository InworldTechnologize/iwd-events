import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const A = `http://kayal.localhost:${PORT}`;
const CONSOLE = `http://platform.localhost:${PORT}`;
const PASSWORD = 'demo-pass-123';
const ownerUrl = () => process.env.DATABASE_URL_OWNER ?? 'postgres://postgres:postgres@localhost:5432/iwd';

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s), as authenticator apps compute it. */
function totp(base32: string, at = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of base32.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

async function latestPhoneCode(phone: string) {
  const sql = postgres(ownerUrl(), { max: 1 });
  const [r] = await sql<{ value: string }[]>`select value from verifications where identifier = ${'phone-number-otp-' + phone} order by created_at desc limit 1`;
  await sql.end();
  return r!.value.split(':')[0]!;
}

/** The two-step test turns 2FA on for the demo owner; undo it so other specs can sign in with a password. */
async function resetTwoStep() {
  const sql = postgres(ownerUrl(), { max: 1 });
  await sql`delete from two_factors where user_id in (select id from users where email = 'owner@kayal.demo')`;
  await sql`update users set two_factor_enabled = false where email = 'owner@kayal.demo'`;
  await sql.end();
}
test.beforeAll(resetTwoStep);
test.afterAll(resetTwoStep);

async function emailLogin(page: Page, base: string, email: string) {
  await page.goto(`${base}/${base === CONSOLE ? 'login' : 'admin/login'}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('owner signs in with a phone OTP', async ({ page }) => {
  await page.goto(`${A}/admin/login`);
  await page.getByRole('tab', { name: 'Phone' }).click();
  await page.getByLabel('Mobile number').fill('90000 00101');
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByText('We sent a 6-digit code')).toBeVisible();
  await page.getByLabel('Code').fill(await latestPhoneCode('+919000000101'));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});

test('a wrong phone code does not sign in', async ({ page }) => {
  await page.goto(`${A}/admin/login`);
  await page.getByRole('tab', { name: 'Phone' }).click();
  await page.getByLabel('Mobile number').fill('+919000000101');
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('Code').fill('000000');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'not right' })).toBeVisible();
});

test('console: staff see tenants; tenant owners and other hosts get nothing', async ({ browser }) => {
  const staff = await (await browser.newContext()).newPage();
  await emailLogin(staff, CONSOLE, 'staff@console.demo');
  await expect(staff.getByRole('heading', { name: 'Tenants' })).toBeVisible();
  await expect(staff.getByText('Kayal Weddings (demo)')).toBeVisible();
  await expect(staff.getByText('Spice Route Caterers (demo)')).toBeVisible();
  // Staff have no membership in a tenant, so the tenant admin is closed to them.
  await emailLogin(staff, A, 'staff@console.demo');
  await staff.waitForLoadState('networkidle');
  expect((await staff.goto(`${A}/admin`))?.status()).toBe(404);

  const owner = await (await browser.newContext()).newPage();
  await emailLogin(owner, CONSOLE, 'owner@kayal.demo');
  await owner.waitForLoadState('networkidle');
  expect((await owner.goto(`${CONSOLE}/`))?.status()).toBe(404);
});

test('owner turns on two-step login; then password alone is not enough, and phone OTP is refused', async ({ page, browser }) => {
  await emailLogin(page, A, 'owner@kayal.demo');
  await expect(page.getByText('Owners should turn on two-step login')).toBeVisible();
  await page.getByRole('link', { name: 'Set it up' }).click();
  await page.getByLabel('Your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Set up two-step login' }).click();
  const secret = (await page.getByTestId('totp-secret').textContent())!.trim();
  await page.getByLabel('Code from the app').fill(totp(secret));
  await page.getByRole('button', { name: 'Turn on' }).click();
  await expect(page.getByText('Two-step login is on for your account.')).toBeVisible();

  const fresh = await (await browser.newContext()).newPage();
  await emailLogin(fresh, A, 'owner@kayal.demo');
  await expect(fresh.getByLabel('Authenticator code')).toBeVisible();
  // Password alone gave no session: the admin still sends this browser to sign in.
  const peek = await fresh.context().newPage();
  await peek.goto(`${A}/admin`);
  await expect(peek).toHaveURL(`${A}/admin/login`);
  await peek.close();
  await fresh.getByLabel('Authenticator code').fill(totp(secret));
  await fresh.getByRole('button', { name: 'Continue' }).click();
  await expect(fresh.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(fresh.getByText('Owners should turn on two-step login')).toHaveCount(0);

  const phone = await (await browser.newContext()).newPage();
  await phone.goto(`${A}/admin/login`);
  await phone.getByRole('tab', { name: 'Phone' }).click();
  await phone.getByLabel('Mobile number').fill('+919000000101');
  await phone.getByRole('button', { name: 'Send code' }).click();
  await phone.getByLabel('Code').fill(await latestPhoneCode('+919000000101'));
  await phone.getByRole('button', { name: 'Sign in' }).click();
  await expect(phone.getByRole('alert').filter({ hasText: 'Two-step login is on' })).toBeVisible();
});
