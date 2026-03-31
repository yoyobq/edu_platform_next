import { openHomeWithSearch } from '../../helpers/app';
import { expect, test } from '../../test';

test('入口处于可用状态时，应保持增强模式而不是回退到本地卡片', async ({ page }) => {
  await openHomeWithSearch(page, '?availability=available');

  await page.getByRole('button', { name: '开始' }).click();

  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
  await expect(page.getByPlaceholder('告诉我你想查看什么，或想完成什么')).toBeFocused();
  await expect(page.getByText('增强入口当前已降级，复杂协作会优先回退到本地入口。')).toHaveCount(0);
  await expect(page.getByText('增强入口暂未连接，你仍可正常使用项目功能。')).toHaveCount(0);

  await page.getByPlaceholder('告诉我你想查看什么，或想完成什么').fill('沙盒');
  await page.getByPlaceholder('告诉我你想查看什么，或想完成什么').press('Enter');

  await expect(
    page.getByText('我先记下这个目标。下一步会结合上下文帮你整理页面、信息或草稿。'),
  ).toBeVisible();
  await expect(page.getByText('Sandbox 演练场')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^进入/ })).toHaveCount(0);
});
