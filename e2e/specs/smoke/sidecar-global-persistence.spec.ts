import { openHome } from '../../helpers/app';
import { expect, test } from '../../test';

test('跨路由跳转后，应保留入口面板中的对话历史', async ({ page }) => {
  await openHome(page);

  await page.getByRole('button', { name: '开始' }).click();

  const input = page.getByPlaceholder('输入你想去的页面名称');
  await input.fill('沙盒');
  await input.press('Enter');

  await expect(page.getByText('沙盒', { exact: true })).toBeVisible();
  await expect(page.getByText('先帮你找到 1 个和“沙盒”相关的入口，确认后即可进入。')).toBeVisible();

  await page.getByRole('link', { name: '沙盒演练场' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox 演练场' })).toBeVisible();

  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
  await expect(page.getByText('沙盒', { exact: true })).toBeVisible();
  await expect(page.getByText('先帮你找到 1 个和“沙盒”相关的入口，确认后即可进入。')).toBeVisible();
});

test('浏览器后退后，应保持入口面板状态与历史内容稳定', async ({ page }) => {
  await openHome(page);

  await page.getByRole('button', { name: '开始' }).click();
  await page.getByPlaceholder('输入你想去的页面名称').fill('沙盒');
  await page.getByPlaceholder('输入你想去的页面名称').press('Enter');

  await page.getByRole('link', { name: '沙盒演练场' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox 演练场' })).toBeVisible();

  await page.goBack();

  await expect(page.getByRole('heading', { name: 'aigc-friendly-frontend' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
  await expect(page.getByText('沙盒', { exact: true })).toBeVisible();
  await expect(page.getByText('先帮你找到 1 个和“沙盒”相关的入口，确认后即可进入。')).toBeVisible();
});
