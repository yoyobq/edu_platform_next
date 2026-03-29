import { expect, type Page } from '@playwright/test';

import { routes } from '../fixtures/routes';

export async function openHome(page: Page): Promise<void> {
  await page.goto(routes.home);
  await expect(page.getByRole('heading', { name: 'aigc-friendly-frontend' })).toBeVisible();
}

export function projectCard(page: Page, projectId: string) {
  return page.getByTestId(`project-card-${projectId}`);
}
