import { openEntrySidecar, openHome } from '../../helpers/app';
import { expect, test } from '../../test';

test('layout 应预留全局 overlay 挂载位，且不影响主链路交互', async ({ page }) => {
  await openHome(page);

  const overlayRoot = page.locator('[data-layout-layer="global-overlay-root"]');
  const overlayMount = page.locator('[data-overlay-mount="cross-region-visual"]');

  await expect(overlayRoot).toBeVisible();
  await expect(overlayMount).toBeAttached();

  await openEntrySidecar(page);
});
