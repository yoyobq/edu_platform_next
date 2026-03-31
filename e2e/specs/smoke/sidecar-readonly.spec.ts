import { openEntrySidecar, openHomeWithSearch } from '../../helpers/app';
import { expect, test } from '../../test';

test('入口面板处于只读状态时，应展示只读提示并禁用新输入', async ({ page }) => {
  await openHomeWithSearch(page, '?availability=readonly');

  await openEntrySidecar(page);
  await expect(page.getByText('当前入口为只读模式，你仍可查看已有内容。')).toBeVisible();
  await expect(
    page.getByText('当前入口已切换为只读模式。你可以先查看已有内容，新的输入会在恢复后开放。'),
  ).toBeVisible();
  await expect(page.getByPlaceholder('当前为只读模式')).toBeDisabled();
});
