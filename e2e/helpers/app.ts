import { expect, type Page } from '@playwright/test';

import { routes } from '../fixtures/routes';

type SeedAuthSessionOptions = {
  accessGroup?: readonly ('ADMIN' | 'CUSTOMER' | 'GUEST')[];
  accountId?: number;
  displayName?: string;
  role: 'ADMIN' | 'CUSTOMER' | 'GUEST';
};

export async function mockApiHealth(page: Page): Promise<void> {
  await page.route(/\/health(?:\/readiness)?$/, async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        message: 'ok',
        status: 'ok',
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
}

export async function seedAuthSession(
  page: Page,
  { accessGroup, accountId, displayName, role }: SeedAuthSessionOptions,
): Promise<void> {
  await page.addInitScript(
    (session) => {
      window.localStorage.setItem(
        'aigc-friendly-frontend.auth.session.v1',
        JSON.stringify({
          accessGroup: session.accessGroup,
          accessToken: session.accessToken,
          accountId: session.accountId,
          avatarUrl: null,
          displayName: session.displayName,
          refreshToken: session.refreshToken,
          role: session.role,
          version: 1,
        }),
      );
    },
    {
      accessGroup: accessGroup ?? [role],
      accessToken: `${role.toLowerCase()}-access-token`,
      accountId: accountId ?? (role === 'ADMIN' ? 9527 : role === 'CUSTOMER' ? 1001 : 1000),
      displayName: displayName ?? `${role.toLowerCase()}-user`,
      refreshToken: `${role.toLowerCase()}-refresh-token`,
      role,
    },
  );
}

export async function openHome(page: Page): Promise<void> {
  await mockApiHealth(page);
  await seedAuthSession(page, { role: 'ADMIN' });
  await page.goto(routes.home);
  await expect(page.getByRole('heading', { name: 'aigc-friendly-frontend' })).toBeVisible();
}

export async function openHomeAsAdmin(page: Page): Promise<void> {
  await openHome(page);
}

export async function openHomeWithSearch(page: Page, search: string): Promise<void> {
  await mockApiHealth(page);
  await seedAuthSession(page, { role: 'ADMIN' });
  await page.goto(`${routes.home}${search}`);
  await expect(page.getByRole('heading', { name: 'aigc-friendly-frontend' })).toBeVisible();
}
