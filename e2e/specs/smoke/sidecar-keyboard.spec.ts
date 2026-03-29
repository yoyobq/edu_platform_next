import { expect, test } from '@playwright/test';

import { openHome } from '../../helpers/app';

test('opens the entry sidecar with keyboard and closes it with escape while restoring focus', async ({
  page,
}) => {
  await openHome(page);

  const trigger = page.getByRole('button', { name: '开始' });

  await page.evaluate(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
  await expect(page.getByText('增强入口暂未连接，你仍可正常使用项目功能。')).toBeVisible();
  await expect(page.getByPlaceholder('输入你想去的页面名称')).toBeFocused();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog', { name: '从这里开始' })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
