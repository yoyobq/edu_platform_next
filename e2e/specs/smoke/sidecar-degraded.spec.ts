import { openEntrySidecar, openHomeWithSearch } from '../../helpers/app';
import { expect, test } from '../../test';

test('增强入口降级时，应回退到本地语义入口卡片', async ({ page }) => {
  await openHomeWithSearch(page, '?availability=degraded');

  await openEntrySidecar(page);

  await expect(page.getByText('增强入口当前已降级，复杂协作会优先回退到本地入口。')).toBeVisible();

  const input = page.getByPlaceholder('输入目标页面名称或操作意图');
  await input.fill('沙盒');
  await input.press('Enter');

  await expect(page.getByText('先帮你找到 1 个和“沙盒”相关的入口，确认后即可进入。')).toBeVisible();
  await expect(page.getByText('Sandbox 演练场')).toBeVisible();
});
