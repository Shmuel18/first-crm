import { expect, test } from '@playwright/test';

/** The dashboard: loads, sorts by urgency by default, opens a case. */
test.describe('dashboard', () => {
  test('loads with the urgency sort as the default', async ({ page }) => {
    await page.goto('/cases');
    await expect(page.getByRole('table')).toBeVisible();
    // The sort picker names the urgency default when no sort is chosen.
    await expect(page.getByText('לפי דחיפות').first()).toBeVisible();
  });

  test('switches to the leads tab', async ({ page }) => {
    await page.goto('/cases?view=leads');
    await expect(page).toHaveURL(/view=leads/);
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('opens a case and shows the admin block fields', async ({ page }) => {
    await page.goto('/cases');
    const firstRow = page.getByRole('table').locator('tbody tr').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}/);
    // Fields added in Oct 2026: lawyer name next to appraiser / insurance agent.
    await expect(page.getByText('שם עו"ד').first()).toBeVisible();
    await expect(page.getByText('שם שמאי').first()).toBeVisible();
  });
});
