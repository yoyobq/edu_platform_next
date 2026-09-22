import { expect, test as base } from '@playwright/test';

export { expect };

export const test = base.extend({
  page: async ({ page }, runPage) => {
    await page.addInitScript(() => {
      if (document.documentElement) {
        document.documentElement.classList.add('disable-motion');
      } else {
        document.addEventListener(
          'DOMContentLoaded',
          () => {
            document.documentElement.classList.add('disable-motion');
          },
          { once: true },
        );
      }
    });

    await runPage(page);
  },
});
