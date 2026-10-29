import { expect, test as setup } from '@playwright/test';

const AUTH_FILE = 'e2e/.auth/user.json';

/** Signs in once and saves the session for every other spec. */
setup('sign in', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    throw new Error('Add E2E_USER_EMAIL and E2E_USER_PASSWORD (a DEV-project test user) to .env.local');
  }

  await page.goto('/login');
  await page.getByLabel('כתובת מייל').fill(email);
  await page.getByLabel('סיסמה').fill(password);
  await page.getByRole('button', { name: 'כניסה למערכת' }).click();

  // Signed in = sent on to the dashboard.
  await expect(page).toHaveURL(/\/cases/, { timeout: 180_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
