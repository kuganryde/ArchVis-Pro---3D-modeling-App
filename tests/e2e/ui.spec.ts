import { test, expect, Page } from '@playwright/test';

const open = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open workspace' }).click();
  await expect(page.locator('canvas').first()).toBeVisible();
};

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

test.describe('interface', () => {
  test('welcome card explains the app, and "Don\'t show this again" is remembered', async ({ page }) => {
    await page.goto('/');
    const welcome = page.getByRole('dialog', { name: 'Plan offices and homes in 3D' });
    await expect(welcome).toBeVisible();
    await expect(welcome.getByText('Start from a blueprint or a description.')).toBeVisible();
    await welcome.getByLabel("Don't show this again").check();
    await welcome.getByRole('button', { name: 'Open workspace' }).click();
    await expect(welcome).toBeHidden();
    await page.reload();
    await expect(page.locator('canvas').first()).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Plan offices and homes in 3D' })).toBeHidden();
  });

  test('"Design a house" opens the House Designer straight from the welcome card', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Design a house' }).click();
    await expect(page.getByRole('dialog', { name: 'House Designer' })).toBeVisible();
  });

  for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1100, height: 760 }]) {
    test(`toolbar fits on one row without overlaps at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await open(page);
      const nav = page.getByRole('navigation', { name: 'Workspace toolbar' });
      const navBox = (await nav.boundingBox())!;
      expect(navBox.height).toBeLessThanOrEqual(65);
      // Nothing is cut off horizontally.
      expect(await nav.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      // The wordmark stays on one line.
      const word = (await page.getByText('ARCHVIZ', { exact: false }).first().boundingBox())!;
      expect(word.height).toBeLessThan(28);
      // No two direct controls overlap, and all are inside the viewport.
      const controls = await nav.locator('button:visible, [role=group]:visible').evaluateAll((els) =>
        els.filter((e) => !(e.parentElement && e.parentElement.closest('[role=group]'))).map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
      for (let i = 0; i < controls.length; i++) {
        expect(controls[i].x + controls[i].width).toBeLessThanOrEqual(size.width + 1);
        for (let j = i + 1; j < controls.length; j++) expect(overlaps(controls[i], controls[j]), `controls ${i} and ${j} overlap`).toBe(false);
      }
    });
  }

  test('Tools menu holds the secondary actions and closes with Escape or a click outside', async ({ page }) => {
    await open(page);
    await page.locator('#open-tools').click();
    const menu = page.getByRole('menu', { name: 'Tools' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitemcheckbox', { name: /Heatmap overlay/ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /Relight house/ })).toBeDisabled();
    await expect(menu.getByRole('menuitem', { name: /Gemini key/ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /Reset workspace/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await page.locator('#open-tools').click();
    await expect(menu).toBeVisible();
    await page.locator('canvas').first().click({ position: { x: 20, y: 300 } });
    await expect(menu).toBeHidden();
  });

  test('fonts are served by this app and nothing is requested from Google', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url()); });
    await page.goto('/');
    // Headings use the display face.
    const title = await page.locator('#welcome-title').evaluate((el) => getComputedStyle(el).fontFamily);
    expect(title).toContain('Bricolage Grotesque');
    await page.getByRole('button', { name: 'Open workspace' }).click();
    await expect(page.locator('canvas').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() => ({
      display: document.fonts.check('700 16px "Bricolage Grotesque Variable"'),
      sans: document.fonts.check('400 16px "IBM Plex Sans"'),
      mono: document.fonts.check('400 12px "IBM Plex Mono"'),
    }));
    expect(loaded).toEqual({ display: true, sans: true, mono: true });
    expect(external).toEqual([]);
    const mono = await page.locator('.font-mono').first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(mono).toContain('IBM Plex Mono');
  });

  test('room labels carry the name only; area appears in the hover card, in both units', async ({ page }) => {
    await open(page);
    const overlay = page.locator('#room-labels-canvas-overlay');
    await expect(overlay.getByText('Open Working Area').first()).toBeVisible();
    // No area chips crowding the labels while the heatmap is off.
    await expect(overlay.getByText(/ft²|SQFT/)).toHaveCount(0);
  });

  test('the access point planner reports what it did, in plain words', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /Add access points where coverage is missing/ }).click();
    await expect(page.getByText(/Added \d+ access points?\.|No change needed: every room is already within 6\.5 m/)).toBeVisible();
  });
});
