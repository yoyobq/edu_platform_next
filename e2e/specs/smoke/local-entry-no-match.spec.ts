import { openEntrySidecar, openHome } from '../../helpers/app';
import { expect, test } from '../../test';

test('本地语义入口无匹配时，应给出清晰兜底回复', async ({ page }) => {
  await openHome(page);

  await openEntrySidecar(page);

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
