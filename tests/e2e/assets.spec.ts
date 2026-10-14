import { test, expect, Page } from '@playwright/test';

const LIBRARY_TYPES = [
  'ap', 'dp', 'tp', 'power_outlet', 'hdmi_port', 'projector_port', 'cctv', 'door_access', 'intercom',
  'desk_single', 'desk_cluster_4', 'desk_cluster_6', 'conference_table', 'chair_office', 'chair_lounge',
  'reception_desk', 'whiteboard',
];

const launch = async (page: Page) => {
  await page.goto('/');
  await page.getByText('Launch CAD Workspace').click();
  await expect(page.locator('canvas').first()).toBeVisible();
};

test.describe('library assets', () => {
  test('every Library card shows its isometric thumbnail', async ({ page }) => {
    await launch(page);
    // One in-page pass (each Playwright action is slow while the software-WebGL scene
    // renders): scroll every card into view — thumbnails are lazy — and wait for it to decode.
    const broken = await page.evaluate(async (types) => {
      const bad: string[] = [];
      for (const type of types) {
        const el = document.querySelector<HTMLImageElement>(`[data-testid="iso-thumb-${type}"]`);
        if (!el) { bad.push(`${type} (no thumbnail rendered)`); continue; }
        el.scrollIntoView({ block: 'center' });
        for (let i = 0; i < 50 && !(el.complete && el.naturalWidth > 0); i++) await new Promise((r) => setTimeout(r, 100));
        if (!(el.complete && el.naturalWidth > 0)) bad.push(type);
      }
      return bad;
    }, LIBRARY_TYPES);
    expect(broken).toEqual([]);
  });

  test('library models load from /models with no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    const chair = page.waitForResponse((r) => r.url().endsWith('/models/kaykit/chair_C.gltf'));
    const table = page.waitForResponse((r) => r.url().endsWith('/models/kaykit/table_medium_long.gltf'));
    await launch(page);
    expect((await chair).status()).toBe(200);
    expect((await table).status()).toBe(200);
    // the CSP must allow the model, buffer and texture requests
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });

  test('the editor keeps working when the model files cannot be downloaded', async ({ page }) => {
    await page.route('**/models/**', (route) => route.abort());
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await launch(page);
    await page.waitForTimeout(1500);
    // procedural fallbacks are used; adding and selecting an asset still works
    await page.getByText('Single Desk').first().scrollIntoViewIfNeeded();
    await page.getByText('Single Desk').first().click();
    await expect(page.getByText('COORDINATE MAP:')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
