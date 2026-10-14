import { test, expect, Page } from '@playwright/test';

const launch = async (page: Page) => {
  await page.goto('/');
  await page.getByText('Launch CAD Workspace').click();
  await expect(page.getByRole('tablist', { name: 'Building floors' })).toBeVisible();
};

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// The viewport overlays (status/shortcuts top-left, floor switcher bottom-left,
// hover inspector bottom-right) must never cover one another.
for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 700 }]) {
  test(`viewport overlays do not overlap at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await launch(page);
    const shortcuts = await page.locator('#cad-viewer-shortcuts').boundingBox();
    const levelBar = await page.locator('#level-bar').boundingBox();
    expect(shortcuts && levelBar).toBeTruthy();
    expect(overlaps(shortcuts, levelBar)).toBe(false);

    // Open the building summary popover (grows upward) and re-check.
    await page.getByRole('button', { name: 'Building' }).click();
    const bar = await page.locator('#level-bar').boundingBox();
    expect(overlaps(shortcuts, bar)).toBe(false);
  });
}
