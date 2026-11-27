import { test, expect } from '@playwright/test';

test.describe('House Designer', () => {
  test('generates a house from a request, applies it, and previews the lighting', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

    await page.goto('/');
    await page.getByRole('button', { name: 'Open workspace' }).click();
    await expect(page.locator('canvas').first()).toBeVisible();

    await page.locator('#open-house-designer').click();
    const dialog = page.getByRole('dialog', { name: 'House Designer' });
    await expect(dialog).toBeVisible();

    // The request fills in the controls and the "understood" chips.
    await dialog.getByLabel('Your request').fill('Scandinavian two storey 4 bedroom 3 bathroom home with a study and oak floors');
    await expect(dialog.getByText('Scandinavian style')).toBeVisible();
    await expect(dialog.getByText('Two storeys')).toBeVisible();
    await expect(dialog.locator('output#hd-bed')).toHaveText('4');
    await expect(dialog.locator('output#hd-bath')).toHaveText('3');

    // Three variations, a finish schedule and a cost summary.
    await expect(dialog.getByRole('radio', { name: /Option/ })).toHaveCount(3);
    await expect(dialog.getByText('Finish schedule')).toBeVisible();
    await expect(dialog.getByText('Indicative total')).toBeVisible();

    // Changing a control regenerates.
    await dialog.getByRole('button', { name: 'Fewer bedrooms' }).click();
    await expect(dialog.locator('output#hd-bed')).toHaveText('3');

    await dialog.getByRole('button', { name: 'Apply to workspace' }).click();
    await dialog.getByRole('button', { name: 'Replace design' }).click();
    await expect(dialog).toBeHidden();

    // Two floors appear in the floor bar, with the house on the ground floor.
    await expect(page.getByText('Ground Floor', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('First Floor', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Living Room').first()).toBeVisible();

    for (const mode of ['Evening', 'Night', 'Day']) {
      await page.getByRole('group', { name: 'Lighting preview' }).getByRole('button', { name: mode, exact: true }).click();
    }
    await page.getByRole('button', { name: 'Cutaway' }).click();
    await expect(page.getByRole('button', { name: 'Cutaway' })).toHaveAttribute('aria-pressed', 'true');

    // Undo restores the previous design in one step.
    await page.keyboard.press('Control+z');
    await expect(page.getByText('Open Working Area', { exact: false }).first()).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('closes with Escape and keeps the current design', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open workspace' }).click();
    await page.locator('#open-house-designer').click();
    await expect(page.getByRole('dialog', { name: 'House Designer' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'House Designer' })).toBeHidden();
    await expect(page.getByText('Open Working Area', { exact: false }).first()).toBeVisible();
  });

  test('house furniture can be added from the library', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open workspace' }).click();
    await expect(page.getByText('House · Living')).toBeVisible();
    await page.getByText('Sofa (3-seat)', { exact: true }).click();
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('Relight swaps the lighting scheme of the house in one undo step', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

    await page.goto('/');
    await page.getByRole('button', { name: 'Open workspace' }).click();
    // The starting office has no house rooms, so Relight is unavailable.
    await page.locator('#open-tools').click();
    await expect(page.locator('#open-relight')).toBeDisabled();
    await page.keyboard.press('Escape');

    await page.locator('#open-house-designer').click();
    const dialog = page.getByRole('dialog', { name: 'House Designer' });
    await dialog.getByRole('button', { name: 'Apply to workspace' }).click();
    await dialog.getByRole('button', { name: 'Replace design' }).click();
    await expect(dialog).toBeHidden();

    await page.locator('#open-tools').click();
    await expect(page.locator('#open-relight')).toBeEnabled();
    await page.locator('#open-relight').click();
    const panel = page.getByRole('dialog', { name: 'Relight the house' });
    await expect(panel).toBeVisible();
    await panel.getByLabel('Fixtures').selectOption('pendants');
    await panel.getByLabel('Light colour').selectOption('cool');
    await panel.getByRole('button', { name: 'Apply lighting' }).click();
    await expect(panel).toBeHidden();
    await expect(page.getByText(/Lighting changed to pendants, 4500 K/)).toBeVisible();
    // The preview switches from Day so the new lights can be seen.
    await expect(page.getByRole('group', { name: 'Lighting preview' }).getByRole('button', { name: 'Evening', exact: true })).toHaveAttribute('aria-pressed', 'true');

    // Escape closes the panel without changing anything.
    await page.locator('#open-tools').click();
    await page.locator('#open-relight').click();
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();

    // Undo reverts the relight as a single step (the house is still there).
    await page.keyboard.press('Control+z');
    await expect(page.getByText('Living Room').first()).toBeVisible();
    expect(problems).toEqual([]);
  });
});
