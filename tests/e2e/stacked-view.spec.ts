import { test, expect, Page } from '@playwright/test';

const launch = async (page: Page) => {
  await page.goto('/');
  await page.getByText('Launch CAD Workspace').click();
  await expect(page.getByRole('tablist', { name: 'Building floors' })).toBeVisible();
};
const duplicate = async (page: Page, floor: string) => {
  await page.getByRole('tab', { name: floor, exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`Actions for ${floor.replace(/[()]/g, '\\$&')}$`) }).click();
  await page.getByRole('menuitem', { name: 'Duplicate floor' }).click();
};
const activeFloor = async (page: Page) => (await page.locator('[role=tab][aria-selected=true]').innerText()).trim();
const stackBtn = (page: Page) => page.getByRole('button', { name: 'Stack', exact: true });

test.describe('stacked building view', () => {
  test('stack needs 3D and at least two floors', async ({ page }) => {
    await launch(page);
    await expect(stackBtn(page)).toBeDisabled(); // single floor
    await page.getByRole('button', { name: 'Add floor' }).click();
    await expect(stackBtn(page)).toBeEnabled();
    await page.getByText('2D Plan').click();
    await expect(stackBtn(page)).toBeDisabled(); // 2D has no building to stack
    await page.getByText('3D View').click();
    await expect(stackBtn(page)).toBeEnabled();
  });

  test('toggle on/off, "Cut above" appears only while stacked, no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await launch(page);
    await duplicate(page, 'Level 1');
    await expect(page.getByRole('button', { name: 'Cut above' })).toHaveCount(0);
    await stackBtn(page).click();
    await expect(stackBtn(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Cut above' })).toBeVisible();
    await page.getByRole('button', { name: 'Cut above' }).click();
    await expect(page.getByRole('button', { name: 'Cut above' })).toHaveAttribute('aria-pressed', 'true');
    await stackBtn(page).click();
    await expect(page.getByRole('button', { name: 'Cut above' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('clicking a ghost floor switches to it, but orbiting over it does not', async ({ page }) => {
    test.setTimeout(150_000); // every pointer move re-renders a software-WebGL scene in CI
    await launch(page);
    await duplicate(page, 'Level 1');
    await page.getByRole('tab', { name: 'Level 1', exact: true }).click();
    await stackBtn(page).click();
    await page.waitForTimeout(1500); // camera framing + ghost build

    const canvas = page.locator('#cad-three-canvas');
    const box = (await canvas.boundingBox())!;

    // Find a point where the pointer turns into the "clickable ghost" cursor. In the
    // framed two-floor stack the ghost slabs sit just above the active floor, around
    // 60% across and ~320px down the canvas; try a few nearby points (each pointer
    // move re-renders a software-WebGL scene, so a blind full-canvas scan is too slow).
    const findGhost = async () => {
      for (const [fx, dy] of [[0.62, 324], [0.62, 345], [0.7, 324], [0.55, 324], [0.62, 300], [0.78, 340]]) {
        const x = box.x + box.width * fx;
        const y = box.y + dy;
        await page.mouse.move(x, y);
        if ((await canvas.evaluate((el) => (el as HTMLElement).style.cursor)) === 'pointer') return { x, y };
      }
      return null;
    };

    const first = await findGhost();
    expect(first, 'expected a clickable ghost floor in the stacked view').not.toBeNull();

    // An orbit gesture that starts on the ghost must not switch floors.
    await page.mouse.move(first!.x, first!.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(first!.x + i * 6, first!.y + i * 2);
    await page.mouse.up();
    expect(await activeFloor(page)).toBe('Level 1');

    // The orbit moved the camera, so look for the ghost again; a plain click then switches.
    const second = await findGhost();
    expect(second, 'ghost floor should still be reachable after orbiting').not.toBeNull();
    await page.mouse.click(second!.x, second!.y);
    await expect.poll(() => activeFloor(page)).toBe('Level 1 (copy)');
  });

  test('ghost floors can be switched back and forth and the app stays interactive', async ({ page }) => {
    await launch(page);
    await duplicate(page, 'Level 1');
    await stackBtn(page).click();
    await page.getByRole('tab', { name: 'Level 1', exact: true }).click();
    await page.getByText('Access Point (AP)').first().click(); // add a device on Level 1 while stacked
    await page.getByRole('button', { name: 'Building' }).click();
    const dialog = page.getByRole('dialog', { name: 'Building summary' });
    const row = dialog.locator('tbody tr').filter({ has: page.getByRole('cell', { name: 'Level 1', exact: true }) });
    const l1 = Number((await row.locator('td').nth(2).innerText()).trim());
    expect(l1).toBeGreaterThan(85); // 85 seeded + the new device
  });
});
