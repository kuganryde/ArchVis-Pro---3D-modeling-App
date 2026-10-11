import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.describe('ArchViz Pro smoke', () => {
  test('boots with no CSP violations or console errors and renders the 3D scene', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console.error: ${m.text()}`);
    });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

    const res = await page.goto('/');
    expect(res?.headers()['content-security-policy']).toContain("default-src 'self'");

    await page.getByText('Launch CAD Workspace').click();
    await expect(page.locator('canvas').first()).toBeVisible();
    await expect(page.getByText('Open Working Area', { exact: false }).first()).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('2D plan, heatmap and inventory views work', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Launch CAD Workspace').click();
    await page.getByText('2D Plan').click();
    await page.getByText('Heatmap Overlay').click();
    await expect(page.getByText('OCCUPANCY HEATMAP')).toBeVisible();
    await page.getByRole('button', { name: 'Inventory', exact: true }).click();
    await expect(page.getByText('Bill of Materials')).toBeVisible();
  });

  test('inventory CSV export downloads a well-formed, escaped file', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Launch CAD Workspace').click();
    await page.getByRole('button', { name: 'Inventory', exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Export CSV/ }).click(),
    ]);
    const csv = await readFile((await download.path()) as string, 'utf8');
    const [header, ...rows] = csv.split('\r\n');
    expect(header).toContain('Asset ID,Asset Name');
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every((r) => r.startsWith('"'))).toBe(true);
  });
});

test('API health and unknown route behave', async ({ request }) => {
  expect((await request.get('/api/health')).ok()).toBe(true);
  const r = await request.get('/api/does-not-exist');
  expect(r.status()).toBe(404);
});
