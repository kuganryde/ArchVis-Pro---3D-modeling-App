import { test, expect, Page } from '@playwright/test';

const launch = async (page: Page) => {
  await page.goto('/');
  await page.getByText('Launch CAD Workspace').click();
  await expect(page.getByRole('tablist', { name: 'Building floors' })).toBeVisible();
};

/** Assets on a floor, read from the Building summary table (whole-building truth). */
const assetCount = async (page: Page, floor: string) => {
  const dialog = page.getByRole('dialog', { name: 'Building summary' });
  if (!(await dialog.isVisible())) await page.getByRole('button', { name: 'Building' }).click();
  const row = dialog.locator('tbody tr', { hasText: floor }).first();
  return Number((await row.locator('td').nth(2).innerText()).trim());
};

const addFirstLibraryAsset = async (page: Page) => {
  // Library cards are click targets; the first is the Access Point.
  await page.getByText('Access Point (AP)').first().click();
};

test.describe('floors', () => {
  test('legacy single-floor design opens as "Level 1" with everything on it', async ({ page }) => {
    await launch(page);
    await expect(page.getByRole('tab', { name: 'Level 1' })).toHaveAttribute('aria-selected', 'true');
    expect(await assetCount(page, 'Level 1')).toBeGreaterThan(50);
  });

  test('a new floor is empty and keeps floors isolated', async ({ page }) => {
    await launch(page);
    const before = await assetCount(page, 'Level 1');
    await page.getByRole('button', { name: 'Add floor' }).click();
    await expect(page.getByRole('tab', { name: 'Level 2' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Open Working Area', { exact: false })).toHaveCount(0); // Level 1's rooms are not drawn
    await addFirstLibraryAsset(page);
    expect(await assetCount(page, 'Level 2')).toBe(1);
    expect(await assetCount(page, 'Level 1')).toBe(before);
    await page.getByRole('tab', { name: 'Level 1' }).click();
    await expect(page.getByText('Open Working Area', { exact: false }).first()).toBeVisible();
  });

  test('duplicate floor copies content; rename works', async ({ page }) => {
    await launch(page);
    const n = await assetCount(page, 'Level 1');
    await page.getByRole('button', { name: /Actions for Level 1/ }).click();
    await page.getByRole('menuitem', { name: 'Duplicate floor' }).click();
    await expect(page.getByRole('tab', { name: 'Level 1 (copy)' })).toHaveAttribute('aria-selected', 'true');
    expect(await assetCount(page, 'Level 1 (copy)')).toBe(n);

    await page.getByRole('button', { name: /Actions for Level 1 \(copy\)/ }).click();
    await page.getByRole('menuitem', { name: 'Rename floor' }).click();
    await page.getByLabel('Floor name').fill('Level 5 – Executive');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Level 5 – Executive' })).toBeVisible();
  });

  test('floors survive a reload (autosave)', async ({ page }) => {
    await launch(page);
    await page.getByRole('button', { name: 'Add floor' }).click();
    await page.waitForTimeout(1000); // debounce is 600 ms
    await page.reload();
    await page.getByText('Launch CAD Workspace').click();
    await expect(page.getByRole('tab', { name: 'Level 2' })).toBeVisible();
  });
});

test.describe('undo / redo', () => {
  test('buttons start disabled, then undo and redo an added asset', async ({ page }) => {
    await launch(page);
    const undoBtn = page.getByRole('button', { name: 'Undo' });
    const redoBtn = page.getByRole('button', { name: 'Redo' });
    await expect(undoBtn).toBeDisabled();
    await expect(redoBtn).toBeDisabled();

    const before = await assetCount(page, 'Level 1');
    await addFirstLibraryAsset(page);
    expect(await assetCount(page, 'Level 1')).toBe(before + 1);
    await expect(undoBtn).toBeEnabled();

    await undoBtn.click();
    expect(await assetCount(page, 'Level 1')).toBe(before);
    await expect(redoBtn).toBeEnabled();
    await redoBtn.click();
    expect(await assetCount(page, 'Level 1')).toBe(before + 1);
  });

  test('keyboard shortcuts work (Ctrl+Z / Ctrl+Shift+Z)', async ({ page }) => {
    await launch(page);
    const before = await assetCount(page, 'Level 1');
    await addFirstLibraryAsset(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+z');
    expect(await assetCount(page, 'Level 1')).toBe(before);
    await page.keyboard.press('Control+Shift+z');
    expect(await assetCount(page, 'Level 1')).toBe(before + 1);
  });

  test('undoing "add floor" removes it and falls back to a valid active floor', async ({ page }) => {
    await launch(page);
    await page.getByRole('button', { name: 'Add floor' }).click();
    await expect(page.getByRole('tab', { name: 'Level 2' })).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('tab', { name: 'Level 2' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Level 1' })).toHaveAttribute('aria-selected', 'true');
  });

  test('deleting a floor and resetting the whole workspace are both undoable', async ({ page }) => {
    await launch(page);
    page.on('dialog', (d) => d.accept());
    const n = await assetCount(page, 'Level 1');

    await page.getByRole('button', { name: /Actions for Level 1/ }).click();
    await page.getByRole('menuitem', { name: 'Duplicate floor' }).click();
    await page.getByRole('button', { name: /Actions for Level 1 \(copy\)/ }).click();
    await page.getByRole('menuitem', { name: 'Delete floor' }).click();
    await expect(page.getByRole('tab', { name: 'Level 1 (copy)' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('tab', { name: 'Level 1 (copy)' })).toBeVisible();

    await page.getByRole('button', { name: 'Reset Workspace' }).click();
    expect(await assetCount(page, 'Level 1')).toBe(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    expect(await assetCount(page, 'Level 1')).toBe(n);
  });
});
