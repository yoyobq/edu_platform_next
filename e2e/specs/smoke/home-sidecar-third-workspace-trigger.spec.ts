import { openEntrySidecar, openHomeAsAdmin } from '../../helpers/app';
import { expect, test } from '../../test';

test('首页 sidecar 不应再直接承接第三工作区 demo 触发词', async ({ page }) => {
  await openHomeAsAdmin(page);

  await openEntrySidecar(page);

  const input = page.getByPlaceholder('输入你想去的页面名称');
  await input.fill('demo 跳层简报');
  await input.press('Enter');

  await expect(
    page.getByText(
      '暂时没有找到和“demo 跳层简报”直接匹配的入口。你可以换一个页面名称，或描述得更具体一点。',
    ),
  ).toBeVisible();

  const thirdWorkspaceRoot = page.locator('[data-layout-layer="third-workspace-root"]');
  await expect(thirdWorkspaceRoot).toHaveAttribute('data-workspace-state', 'closed');
  await expect(page.getByTestId('third-workspace-canvas')).toHaveCount(0);
});
