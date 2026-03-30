import { openHome } from '../../helpers/app';
import { expect, test } from '../../test';

test('顶部控制层应预留 omni-bar 触发位，且不影响现有入口交互', async ({ page }) => {
  await openHome(page);

  const omniBarSlot = page.getByRole('button', { name: '全局搜索与命令' });

  await expect(omniBarSlot).toBeVisible();
  await expect(omniBarSlot).toHaveAttribute('data-layout-slot', 'omni-bar-trigger');

  await omniBarSlot.hover();
  await expect(page.getByText('全局搜索与命令 (预留)')).toBeVisible();

  await page.getByRole('button', { name: '开始' }).click();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
});
