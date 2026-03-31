import { openEntrySidecar, openHome } from '../../helpers/app';
import { expect, test } from '../../test';

test('宽屏下打开入口面板后，主内容区应收缩避让', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await openHome(page);

  const contentColumn = page.locator('[data-main-width-band] > .mx-auto.max-w-7xl.pt-6').first();
  const beforeColumnBox = await contentColumn.boundingBox();

  await openEntrySidecar(page);

  const afterColumnBox = await contentColumn.boundingBox();
  const sidecar = page.getByRole('dialog', { name: '从这里开始' });
  const sidecarBox = await sidecar.boundingBox();

  expect(afterColumnBox?.width).toBeLessThan(beforeColumnBox?.width ?? Number.POSITIVE_INFINITY);
  expect((afterColumnBox?.x ?? 0) + (afterColumnBox?.width ?? 0)).toBeLessThan(sidecarBox?.x ?? 0);
});

test('窄屏下打开入口面板后，主内容区不应被挤压', async ({ page }) => {
  await page.setViewportSize({ width: 680, height: 900 });
  await openHome(page);

  const contentColumn = page.locator('[data-main-width-band] > .mx-auto.max-w-7xl.pt-6').first();
  const beforeColumnBox = await contentColumn.boundingBox();

  await openEntrySidecar(page);

  const afterColumnBox = await contentColumn.boundingBox();

  expect(Math.abs((afterColumnBox?.width ?? 0) - (beforeColumnBox?.width ?? 0))).toBeLessThan(1);
});
