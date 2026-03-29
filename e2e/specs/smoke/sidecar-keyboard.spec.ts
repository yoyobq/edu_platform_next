import { expect, test } from '@playwright/test';

import { openHome } from '../../helpers/app';

test('opens the assistant sidecar and closes it with escape while restoring focus', async ({
  page,
}) => {
  await openHome(page);

  const trigger = page.getByRole('button', { name: 'Assistant' });

  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Assistant' })).toBeVisible();
  await expect(page.getByPlaceholder('Ask or draft here')).toBeFocused();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog', { name: 'Assistant' })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
