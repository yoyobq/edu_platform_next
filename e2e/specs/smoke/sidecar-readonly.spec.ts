import { expect, test } from '../../test';

test('shows readonly state and disables new input when the entry panel is readonly', async ({
  page,
}) => {
  await page.goto('/?availability=readonly');

  await page.getByRole('button', { name: '开始' }).click();

  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
  await expect(page.getByText('当前入口为只读模式，你仍可查看已有内容。')).toBeVisible();
  await expect(
    page.getByText('当前入口已切换为只读模式。你可以先查看已有内容，新的输入会在恢复后开放。'),
  ).toBeVisible();
  await expect(page.getByPlaceholder('当前为只读模式')).toBeDisabled();
});
