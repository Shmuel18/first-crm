import { expect, test } from '@playwright/test';

/** Phone width: the dashboard shows cards, the calendar month becomes a day list. */
test('dashboard renders case cards on a phone', async ({ page }) => {
  await page.goto('/cases');
  await expect(page.getByText('מיון').first()).toBeVisible();
  // No horizontal page scroll at phone width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('calendar month shows the day list on a phone', async ({ page }) => {
  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: 'לוח שנה' })).toBeVisible();
  // The 7-column grid is hidden below md; the agenda list is what shows.
  await expect(page.locator('ol').first()).toBeVisible();
});
