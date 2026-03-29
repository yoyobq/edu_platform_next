import { expect, test } from '@playwright/test';

test('blocks labs demo when the access rule is not matched', async ({ page }) => {
  await page.goto('/labs/demo');

  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
});

test('allows labs demo when the admin role is present', async ({ page }) => {
  await page.goto('/labs/demo?role=admin');

  await expect(page.getByRole('heading', { name: 'Labs Demo' })).toBeVisible();
});
