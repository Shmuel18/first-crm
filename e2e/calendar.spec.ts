import { expect, test } from '@playwright/test';

/** The calendar: views, Hebrew dates, and an event round-trip (create → delete). */
test.describe('calendar', () => {
  test('shows the month with a Hebrew-calendar title and today marked', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: 'לוח שנה' })).toBeVisible();
    // The toolbar title carries the Hebrew year (תשפ״ז / תשפ״ח …).
    await expect(page.locator('h2 [lang="he"]').first()).toContainText(/תש/);
    await expect(page.locator('[aria-current="date"]').first()).toBeVisible();
  });

  test('switches between week, day and list', async ({ page }) => {
    await page.goto('/calendar');
    for (const [label, view] of [['שבוע', 'week'], ['יום', 'day'], ['רשימה', 'agenda']] as const) {
      await page.getByRole('tab', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`view=${view}`));
    }
  });

  test('creates an event and deletes it again', async ({ page }) => {
    const title = `E2E בדיקה ${Date.now()}`;
    await page.goto('/calendar?view=agenda');
    await page.getByRole('button', { name: 'אירוע חדש' }).click();
    await page.getByLabel('כותרת').fill(title);
    await page.getByRole('button', { name: 'שמירה' }).or(page.getByRole('button', { name: 'שמור' })).first().click();

    const chip = page.getByRole('button', { name: new RegExp(title) }).first();
    await expect(chip).toBeVisible();

    await chip.click();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'מחק' }).click();
    await expect(page.getByRole('button', { name: new RegExp(title) })).toHaveCount(0);
  });
});
