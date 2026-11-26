import { test } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const WIDTHS = [360, 390, 768, 1024, 1366];
const OUT = process.env.SCREENS_DIR ?? 'screenshots/phase-1';

test('screens at 5 widths', async ({ browser }) => {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/`);
    await page.screenshot({ path: `${OUT}/marketing-${width}.png`, fullPage: true });
    await page.goto(`http://kayal.localhost:${PORT}/`);
    await page.screenshot({ path: `${OUT}/tenant-site-${width}.png`, fullPage: true });
    await page.goto(`http://kayal.localhost:${PORT}/admin/login`);
    await page.screenshot({ path: `${OUT}/login-${width}.png`, fullPage: true });
    await page.getByLabel('Email').fill('owner@kayal.demo');
    await page.getByLabel('Password').fill('demo-pass-123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Today' }).waitFor();
    await page.screenshot({ path: `${OUT}/admin-today-${width}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) throw new Error(`horizontal overflow at ${width}px`);
    await ctx.close();
  }
});
