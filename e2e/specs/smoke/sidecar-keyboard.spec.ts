import { openHome } from '../../helpers/app';
import { expect, test } from '../../test';

test('应可通过快捷键打开入口面板，并在按下 Escape 后关闭并恢复焦点', async ({ page }) => {
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
