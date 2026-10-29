import { expect, test } from '@playwright/test';

/**
 * Every main screen renders without a crash or an error page — the cheapest
 * catch for a broken import / server error after a dependency bump.
 */
const SCREENS: Array<[string, RegExp | string]> = [
  ['/tasks', 'משימות'],
  ['/calendar', 'לוח שנה'],
  ['/simulators', /סימולטור/],
  ['/settings/profile', /פרופיל/],
  ['/settings/notifications', /התראות/],
  ['/settings/contacts', 'אנשי קשר מקצועיים'],
];

for (const [path, heading] of SCREENS) {
  test(`${path} renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const res = await page.goto(path);
    expect(res?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByText(heading).first()).toBeVisible();
    expect(errors, `uncaught errors on ${path}`).toEqual([]);
  });
}

test('the contacts directory lists the office professionals', async ({ page }) => {
  await page.goto('/settings/contacts');
  await expect(page.getByText('שמאים').first()).toBeVisible();
  await expect(page.getByText('עורכי דין').first()).toBeVisible();
  await expect(page.getByText('סוכני ביטוח').first()).toBeVisible();
});

test('the notification settings carry the calendar-reminder switch', async ({ page }) => {
  await page.goto('/settings/notifications');
  await expect(page.getByText('מייל בתזכורת מלוח השנה')).toBeVisible();
});
