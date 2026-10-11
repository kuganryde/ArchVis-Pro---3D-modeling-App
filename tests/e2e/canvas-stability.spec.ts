import { test, expect } from '@playwright/test';

// Regression: `rooms`/`assets` once got a new identity on every document change,
// which tore down and rebuilt the WebGL renderer on each asset add / drag step.
test('canvas renderer is built once; a drag is exactly one undo step', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__ctx = 0;
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...a: any[]) {
      if (/webgl/.test(type)) (window as any).__ctx++;
      return (orig as any).call(this, type, ...a);
    } as any;
  });
  const contexts = () => page.evaluate(() => (window as any).__ctx as number);
  const coords = async () =>
    (await page.locator('span', { hasText: 'COORDINATE MAP:' }).locator('xpath=..').innerText()).replace(/\s+/g, ' ');

  await page.goto('/');
  await page.getByText('Launch CAD Workspace').click();
  await expect(page.locator('canvas').first()).toBeVisible();
  const initial = await contexts();

  await page.getByText('2D Plan').click();
  await page.getByText('Access Point (AP)').first().click(); // placed at the floor centre and selected
  await expect(page.getByText('COORDINATE MAP:')).toBeVisible();
  expect(await coords()).toContain('X: 0.00m, Z: 0.00m');

  const box = (await page.locator('#cad-three-canvas').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 25; i++) await page.mouse.move(cx + i * 8, cy + i * 3);
  await page.mouse.up();

  expect(await coords()).not.toContain('X: 0.00m, Z: 0.00m'); // it really moved
  expect(await contexts()).toBe(initial); // no renderer rebuilds from add or drag

  await page.getByRole('button', { name: 'Undo' }).click(); // ONE undo undoes the whole 25-step drag
  expect(await coords()).toContain('X: 0.00m, Z: 0.00m');
});
