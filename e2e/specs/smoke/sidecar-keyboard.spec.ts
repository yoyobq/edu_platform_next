import { expect, test } from '@playwright/test';

import { openHome } from '../../helpers/app';

test('opens the assistant sidecar and closes it with escape while restoring focus', async ({
  page,
}) => {
  await openHome(page);

  const trigger = page.getByRole('button', { name: '开始' });

  await trigger.click();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
  await expect(page.getByText('智能入口暂未开启，你仍可正常使用项目功能。')).toBeVisible();
  await expect(page.getByPlaceholder('输入你想去的页面名称')).toBeDisabled();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog', { name: '从这里开始' })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
