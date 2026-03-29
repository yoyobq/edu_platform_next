import { openHome } from '../../helpers/app';
import { expect, test } from '../../test';

test('shows a clear fallback reply when no local entry matches the query', async ({ page }) => {
  await openHome(page);

  await page.getByRole('button', { name: '开始' }).click();

  const input = page.getByPlaceholder('输入你想去的页面名称');
  await input.fill('完全不存在的页面');
  await input.press('Enter');

  await expect(
    page.getByText(
      '暂时没有找到和“完全不存在的页面”直接匹配的入口。你可以换一个页面名称，或描述得更具体一点。',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^进入/ })).toHaveCount(0);
});
