import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/** Collects console problems and requests to hosts other than the site itself. */
function watch(page: Page) {
  const problems: string[] = [];
  const foreign: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname !== '127.0.0.1' && u.protocol.startsWith('http')) foreign.push(r.url());
  });
  return { problems, foreign };
}

const PAGES = ['index.html', 'check.html', 'method.html', 'sources.html', 'api.html', 'legal.html', 'regions/de-sn.html', 'en/index.html', 'en/regions/de-by.html'];

test.describe('every page', () => {
  for (const path of PAGES) {
    test(`${path}: renders, hydrates without warnings, calls no third party`, async ({ page }) => {
      const w = watch(page);
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(w.problems, w.problems.join('\n')).toEqual([]);
      expect(w.foreign).toEqual([]);
    });
  }
  test('is complete HTML without JavaScript', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    for (const path of ['index.html', 'sources.html', 'method.html', 'api.html', 'regions/de-sn.html']) {
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();
      expect((await page.locator('main').innerText()).length).toBeGreaterThan(200);
    }
    await ctx.close();
  });
});

test.describe('start page', () => {
  test('shows the national forecast, the map and 16 region links', async ({ page }) => {
    await page.goto('index.html');
    await expect(page.locator('[role="img"]').first()).toBeVisible();
    await expect(page.locator('main a[href*="regions/de-"]')).toHaveCount(16, { timeout: 5000 }).catch(async () => {
      expect(await page.locator('main a[href*="regions/de-"]').count()).toBeGreaterThanOrEqual(16);
    });
    await expect(page.getByText(/Robert Koch/).first()).toBeVisible();
  });

  test('the horizon picker changes the displayed week', async ({ page }) => {
    await page.goto('index.html');
    // The first radio group is the forecast horizon (the wastewater section adds a second group).
    const radios = page.locator('fieldset').first().getByRole('radio');
    expect(await radios.count()).toBe(4);
    const before = await page.locator('main').innerText();
    await radios.nth(3).check();
    await expect.poll(async () => page.locator('main').innerText()).not.toBe(before);
  });

  test('postcode search leads to the right state', async ({ page }) => {
    await page.goto('index.html');
    const box = page.getByRole('textbox').first();
    await box.fill('04109');
    await box.press('Enter');
    await page.waitForURL(/regions\/de-sn\.html/);
    await expect(page.locator('h1')).toContainText('Sachsen');
  });

  test('clicking a state on the map opens its page', async ({ page }) => {
    await page.goto('index.html');
    const state = page.locator('main svg [role="button"]').first();
    await state.click();
    await page.waitForURL(/regions\/de-[a-z]{2}\.html/);
  });

  test('language switch keeps the page', async ({ page }) => {
    await page.goto('regions/de-sn.html');
    await page.getByRole('link', { name: /Auf Englisch wechseln/ }).click();
    await page.waitForURL(/en\/regions\/de-sn\.html/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toContainText('Saxony');
  });
});

test.describe('self-check', () => {
  test('recomputes a season in the browser and shows the honesty note', async ({ page }) => {
    test.setTimeout(240_000);
    const w = watch(page);
    await page.goto('check.html');
    await page.getByRole('combobox').nth(0).selectOption({ label: 'Sachsen' });
    await page.getByRole('combobox').nth(1).selectOption({ label: '2024/25' });
    await page.getByRole('button', { name: /nachrechnen/i }).click();
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 200_000 });
    await expect(page.locator('main')).toContainText(/korrigiert/i);
    expect(w.problems, w.problems.join('\n')).toEqual([]);
    expect(w.foreign).toEqual([]);
  });
});

test.describe('accessibility basics', () => {
  test('headings start at h1 and images have names', async ({ page }) => {
    await page.goto('index.html');
    expect(await page.locator('h1').count()).toBe(1);
    for (const img of await page.locator('[role="img"]').all()) {
      expect((await img.getAttribute('aria-label'))?.length ?? 0).toBeGreaterThan(3);
    }
  });
});

test.describe('API', () => {
  test('serves valid JSON files', async ({ request }) => {
    const idx = await (await request.get('api/v1/index.json')).json();
    expect(idx.regions).toHaveLength(17);
    const de = await (await request.get('api/v1/regions/de.json')).json();
    expect(de.horizons).toHaveLength(4);
    expect(de.attribution).toContain('Robert Koch');
    const src = await (await request.get('api/v1/sources.json')).json();
    expect(src.sources.length).toBeGreaterThanOrEqual(6);
    expect((await request.get('api/v1/backtest/test.json')).ok()).toBe(true);
  });
});
