import { expect, test } from '@playwright/test';

import { projectFixtures } from '../../fixtures/project-data';
import { openHome, projectCard } from '../../helpers/app';

test('shows which projects are live and supports live-only filtering', async ({ page }) => {
  await openHome(page);

  await expect(projectCard(page, projectFixtures.live.id)).toContainText(projectFixtures.live.name);
  await expect(projectCard(page, projectFixtures.live.id)).toContainText(
    projectFixtures.live.status,
  );

  await expect(projectCard(page, projectFixtures.paused.id)).toContainText(
    projectFixtures.paused.name,
  );
  await expect(projectCard(page, projectFixtures.paused.id)).toContainText(
    projectFixtures.paused.status,
  );

  await page.getByRole('checkbox', { name: 'Only live' }).check();

  await expect(projectCard(page, projectFixtures.live.id)).toBeVisible();
  await expect(projectCard(page, projectFixtures.paused.id)).toHaveCount(0);
});
