import { expect, test as base } from '@playwright/test';

export { expect };

export const test = base.extend({
  page: async ({ page }, runPage) => {
    await page.addInitScript(() => {
      document.documentElement.classList.add('disable-motion');
    });

    await runPage(page);
  },
});
