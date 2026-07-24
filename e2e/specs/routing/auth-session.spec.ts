import type { Page, Route } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import {
  AUTH_STORAGE_KEY,
  mockApiHealth,
  mockAuthGraphQL,
  seedAuthSession,
  type SeedAuthSessionOptions,
} from '../../helpers/app';
import { expect, test } from '../../test';

const ACCOUNT_SWITCH_STORAGE_KEY = 'aigc-friendly-frontend.labs.account-switch.v1';

type AccountSwitchTestSession = ReturnType<typeof buildAccountSwitchTestSession>;

function layoutBanner(page: Page) {
  return page.getByRole('banner');
}

async function expectAuthenticatedUserMenu(
  page: Page,
  displayName: string,
  identity: string = 'Admin',
) {
  const userMenuButton = page.getByRole('button', { name: '用户菜单' });

  await expect(userMenuButton).toBeVisible();
  await userMenuButton.click();

  const dropdown = page.locator('.ant-dropdown').last();

  await expect(dropdown.getByText(displayName, { exact: true })).toBeVisible();
  await expect(dropdown.getByText(identity, { exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
}

async function expectAuthenticatedStudentMenu(page: Page, displayName: string) {
  const userMenuButton = page.getByRole('button', { name: '用户菜单' });

  await expect(userMenuButton).toBeVisible();
  await userMenuButton.click();

  const dropdown = page.locator('.ant-dropdown').last();

  await expect(dropdown.getByText(displayName, { exact: true })).toBeVisible();
  await expect(dropdown.getByText(`${displayName}@example.com`, { exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
}

async function submitLogin(page: Page) {
  await page.getByLabel('登录名或邮箱').fill('tester@example.com');
  await page.getByLabel('密码').fill('password');
  await page.getByRole('button', { name: /登\s*录/ }).click();
}

function createAdminSession(overrides: SeedAuthSessionOptions = {}): SeedAuthSessionOptions {
  return {
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
    ...overrides,
  };
}

function createJwtWithExpOffsetMs(offsetMs: number) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor((Date.now() + offsetMs) / 1000),
    }),
  ).toString('base64url');

  return `${header}.${payload}.signature`;
}

function buildAccountSwitchTestSession(input: {
  accessToken: string;
  accountId: number;
  displayName: string;
  primaryAccessGroup: 'ADMIN' | 'STAFF' | 'STUDENT';
  refreshToken: string;
}) {
  const identity = (() => {
    if (input.primaryAccessGroup === 'STAFF') {
      return {
        departmentId: 'staff-department',
        id: `staff-${input.accountId}`,
        kind: 'STAFF' as const,
        name: input.displayName,
        slotGroup: [] as readonly string[],
      };
    }

    if (input.primaryAccessGroup === 'STUDENT') {
      return {
        currentClassCode: 'class-01',
        currentClassId: 'class-01',
        id: `student-${input.accountId}`,
        kind: 'STUDENT' as const,
        name: input.displayName,
        slotGroup: [] as readonly string[],
        upstreamId: `upstream-${input.accountId}`,
      };
    }

    return null;
  })();

  return {
    accessToken: input.accessToken,
    account: {
      id: input.accountId,
      identityHint: input.primaryAccessGroup,
      loginEmail: `${input.displayName}@example.com`,
      loginName: input.displayName,
      status: 'ACTIVE',
    },
    accountId: input.accountId,
    displayName: input.displayName,
    identity,
    isAuthenticated: true,
    needsProfileCompletion: false,
    primaryAccessGroup: input.primaryAccessGroup,
    refreshToken: input.refreshToken,
    slotGroup: [],
    userInfo: {
      accessGroup: [input.primaryAccessGroup],
      avatarUrl: null,
      email: `${input.displayName}@example.com`,
      nickname: input.displayName,
      signature: null,
      tags: [],
    },
    version: 2,
  };
}

function buildMePayload(session: AccountSwitchTestSession) {
  const identity =
    session.identity?.kind === 'STAFF'
      ? {
          __typename: 'StaffType',
          departmentId: session.identity.departmentId,
          id: session.identity.id,
          name: session.identity.name,
          slotGroup: session.identity.slotGroup,
        }
      : session.identity?.kind === 'STUDENT'
        ? {
            __typename: 'StudentType',
            currentClassCode: session.identity.currentClassCode,
            currentClassId: session.identity.currentClassId,
            id: session.identity.id,
            name: session.identity.name,
            slotGroup: session.identity.slotGroup,
            upstreamId: session.identity.upstreamId,
          }
        : null;

  return {
    account: {
      id: session.account.id,
      identityHint: session.account.identityHint,
      loginEmail: session.account.loginEmail,
      loginName: session.account.loginName,
      status: session.account.status,
    },
    accountId: session.accountId,
    identity,
    needsProfileCompletion: session.needsProfileCompletion,
    userInfo: {
      accessGroup: session.userInfo.accessGroup,
      avatarUrl: session.userInfo.avatarUrl,
      email: session.userInfo.email,
      nickname: session.userInfo.nickname,
      signature: session.userInfo.signature,
      tags: session.userInfo.tags,
    },
  };
}

function buildMyProfileIdentityPayload(session: AccountSwitchTestSession) {
  if (session.identity?.kind === 'STAFF') {
    return {
      __typename: 'MyProfileStaffIdentityDTO',
      accountId: session.accountId,
      id: session.identity.id,
      name: session.displayName,
    };
  }

  if (session.identity?.kind === 'STUDENT') {
    return {
      __typename: 'MyProfileStudentIdentityDTO',
      accountId: session.accountId,
      currentClassCode: session.identity.currentClassCode,
      currentClassId: session.identity.currentClassId,
      id: session.identity.id,
      name: session.displayName,
      upstreamId: session.identity.upstreamId,
    };
  }

  return null;
}

async function fulfillGraphQLAuthError(route: Route) {
  await route.fulfill({
    body: JSON.stringify({
      errors: [
        {
          message: 'TOKEN_INVALID',
          extensions: {
            code: 'UNAUTHENTICATED',
            errorCode: 'TOKEN_INVALID',
          },
        },
      ],
    }),
    contentType: 'application/json',
    status: 200,
  });
}

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
}

async function fulfillGraphQLData(route: Route, data: Record<string, unknown>) {
  await route.fulfill({
    body: JSON.stringify({ data }),
    contentType: 'application/json',
    status: 200,
  });
}

async function mockLoginDuringOldRestoreGraphQL(page: Page) {
  const oldStaffSession = buildAccountSwitchTestSession({
    accessToken: 'old-staff-access-token',
    accountId: 1001,
    displayName: 'old-staff-user',
    primaryAccessGroup: 'STAFF',
    refreshToken: 'old-staff-refresh-token',
  });
  const newStudentSession = buildAccountSwitchTestSession({
    accessToken: 'new-student-access-token',
    accountId: 1002,
    displayName: 'new-student-user',
    primaryAccessGroup: 'STUDENT',
    refreshToken: 'new-student-refresh-token',
  });
  const oldMeStarted = createDeferred();
  const releaseOldMe = createDeferred();

  await page.addInitScript(
    ({ authKey, session }) => {
      window.localStorage.setItem(authKey, JSON.stringify(session));
    },
    {
      authKey: AUTH_STORAGE_KEY,
      session: oldStaffSession,
    },
  );

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | { query?: string; variables?: { input?: { refreshToken?: unknown } } }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';
    const authorization = route.request().headers().authorization ?? '';

    if (query.includes('mutation Login')) {
      await fulfillGraphQLData(route, {
        login: {
          accessToken: newStudentSession.accessToken,
          refreshToken: newStudentSession.refreshToken,
        },
      });
      return;
    }

    if (query.includes('mutation Refresh')) {
      await fulfillGraphQLAuthError(route);
      return;
    }

    if (query.includes('query Me')) {
      if (authorization.includes(oldStaffSession.accessToken)) {
        oldMeStarted.resolve();
        await releaseOldMe.promise;
        await fulfillGraphQLData(route, {
          me: buildMePayload(oldStaffSession),
        });
        return;
      }

      if (authorization.includes(newStudentSession.accessToken)) {
        await fulfillGraphQLData(route, {
          me: buildMePayload(newStudentSession),
        });
        return;
      }
    }

    if (query.includes('myProfileIdentity')) {
      await fulfillGraphQLData(route, {
        myProfileIdentity: buildMyProfileIdentityPayload(
          authorization.includes(newStudentSession.accessToken)
            ? newStudentSession
            : oldStaffSession,
        ),
      });
      return;
    }

    await route.fallback();
  });

  return {
    newStudentSession,
    oldMeStarted: oldMeStarted.promise,
    releaseOldMe: releaseOldMe.resolve,
  };
}

async function mockAccountSwitchReauthGraphQL(page: Page) {
  const adminSession = buildAccountSwitchTestSession({
    accessToken: 'admin-access-token',
    accountId: 9527,
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
    refreshToken: 'admin-refresh-token',
  });
  const staleStaffSession = buildAccountSwitchTestSession({
    accessToken: 'staff-access-token-stale',
    accountId: 1001,
    displayName: 'staff-user',
    primaryAccessGroup: 'STAFF',
    refreshToken: 'staff-refresh-token-stale',
  });
  const freshStaffSession = buildAccountSwitchTestSession({
    accessToken: 'staff-access-token-fresh',
    accountId: 1001,
    displayName: 'staff-user',
    primaryAccessGroup: 'STAFF',
    refreshToken: 'staff-refresh-token-fresh',
  });
  const logoutRequests: string[] = [];

  await page.addInitScript(
    ({ authKey, currentSession, switchKey, targetSession }) => {
      if (!window.localStorage.getItem(authKey)) {
        window.localStorage.setItem(authKey, JSON.stringify(currentSession));
      }

      if (!window.localStorage.getItem(switchKey)) {
        window.localStorage.setItem(
          switchKey,
          JSON.stringify([
            {
              addedAt: '2026-04-03T00:00:00.000Z',
              session: targetSession,
            },
          ]),
        );
      }
    },
    {
      authKey: AUTH_STORAGE_KEY,
      currentSession: adminSession,
      switchKey: ACCOUNT_SWITCH_STORAGE_KEY,
      targetSession: staleStaffSession,
    },
  );

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | { query?: string; variables?: { input?: { refreshToken?: unknown } } }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';
    const authorization = route.request().headers().authorization ?? '';

    if (query.includes('mutation Logout')) {
      logoutRequests.push(authorization);
      await fulfillGraphQLData(route, {
        logout: {
          success: true,
        },
      });
      return;
    }

    if (query.includes('query Me')) {
      if (authorization.includes(staleStaffSession.accessToken)) {
        await fulfillGraphQLAuthError(route);
        return;
      }

      await route.fulfill({
        body: JSON.stringify({
          data: {
            me: buildMePayload(
              authorization.includes(freshStaffSession.accessToken)
                ? freshStaffSession
                : adminSession,
            ),
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('myProfileIdentity')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            myProfileIdentity: buildMyProfileIdentityPayload(
              authorization.includes(freshStaffSession.accessToken)
                ? freshStaffSession
                : adminSession,
            ),
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation Refresh')) {
      if (payload?.variables?.input?.refreshToken === staleStaffSession.refreshToken) {
        await fulfillGraphQLAuthError(route);
        return;
      }

      await route.fulfill({
        body: JSON.stringify({
          data: {
            refresh: {
              accessToken: adminSession.accessToken,
              refreshToken: adminSession.refreshToken,
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation Login')) {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            login: {
              accessToken: freshStaffSession.accessToken,
              refreshToken: freshStaffSession.refreshToken,
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    await route.fallback();
  });

  return {
    adminSession,
    freshStaffSession,
    logoutRequests,
    staleStaffSession,
  };
}

async function mockActiveAccountLogoutFallbackGraphQL(
  page: Page,
  options: { logoutError?: boolean } = {},
) {
  const adminSession = buildAccountSwitchTestSession({
    accessToken: 'admin-access-token',
    accountId: 9527,
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN',
    refreshToken: 'admin-refresh-token',
  });
  const fallbackStaffSession = buildAccountSwitchTestSession({
    accessToken: 'staff-access-token',
    accountId: 1001,
    displayName: 'staff-user',
    primaryAccessGroup: 'STAFF',
    refreshToken: 'staff-refresh-token',
  });
  const logoutRequests: string[] = [];

  await page.addInitScript(
    ({ authKey, currentSession, fallbackSession, switchKey }) => {
      if (!window.localStorage.getItem(authKey)) {
        window.localStorage.setItem(authKey, JSON.stringify(currentSession));
      }

      if (!window.localStorage.getItem(switchKey)) {
        window.localStorage.setItem(
          switchKey,
          JSON.stringify([
            {
              addedAt: '2026-04-03T00:00:00.000Z',
              session: fallbackSession,
            },
          ]),
        );
      }
    },
    {
      authKey: AUTH_STORAGE_KEY,
      currentSession: adminSession,
      fallbackSession: fallbackStaffSession,
      switchKey: ACCOUNT_SWITCH_STORAGE_KEY,
    },
  );

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | { query?: string; variables?: { input?: { refreshToken?: unknown } } }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';
    const authorization = route.request().headers().authorization ?? '';

    if (query.includes('mutation Logout')) {
      logoutRequests.push(authorization);

      if (options.logoutError) {
        await fulfillGraphQLAuthError(route);
        return;
      }

      await fulfillGraphQLData(route, {
        logout: {
          success: true,
        },
      });
      return;
    }

    if (query.includes('mutation Refresh')) {
      const refreshToken = payload?.variables?.input?.refreshToken;
      const session =
        refreshToken === fallbackStaffSession.refreshToken ? fallbackStaffSession : adminSession;

      await fulfillGraphQLData(route, {
        refresh: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
        },
      });
      return;
    }

    if (query.includes('query Me')) {
      await fulfillGraphQLData(route, {
        me: buildMePayload(
          authorization.includes(fallbackStaffSession.accessToken)
            ? fallbackStaffSession
            : adminSession,
        ),
      });
      return;
    }

    if (query.includes('myProfileIdentity')) {
      await fulfillGraphQLData(route, {
        myProfileIdentity: buildMyProfileIdentityPayload(
          authorization.includes(fallbackStaffSession.accessToken)
            ? fallbackStaffSession
            : adminSession,
        ),
      });
      return;
    }

    await route.fallback();
  });

  return {
    adminSession,
    fallbackStaffSession,
    logoutRequests,
  };
}

async function replaceStoredAccessToken(page: Page, accessToken: string) {
  await page.addInitScript(
    ({ accessToken: nextAccessToken, storageKey }) => {
      const raw = window.localStorage.getItem(storageKey);

      if (!raw) {
        throw new Error('missing auth session');
      }

      const parsed = JSON.parse(raw) as {
        accessToken: string;
      };

      parsed.accessToken = nextAccessToken;
      window.localStorage.setItem(storageKey, JSON.stringify(parsed));
    },
    {
      accessToken,
      storageKey: AUTH_STORAGE_KEY,
    },
  );
}

test('未登录访问首页时，应跳到携带 redirect 的登录页', async ({ page }) => {
  await page.goto(routes.home);

  await expect(page).toHaveURL(/\/login\?redirect=%2F$/);
  await expect(page.getByRole('heading', { name: '账号登录' })).toBeVisible();
  await expect(layoutBanner(page)).toHaveCount(0);
});

test('登录成功后，应按 redirect 进入目标页并呈现已认证状态', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    loginSession: createAdminSession(),
  });

  await page.goto(`${routes.login}?redirect=${encodeURIComponent(routes.labsDemo)}`);
  await submitLogin(page);

  await expect(page).toHaveURL(/\/labs\/demo$/);
  await expect(page.getByRole('heading', { name: '第三工作区跳层 Demo' })).toBeVisible();
  await expectAuthenticatedUserMenu(page, 'admin-user');
});

test('登录成功后不应等待 me 完成才离开登录页', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    loginSession: createAdminSession(),
    meDelayMs: 1500,
  });

  await page.goto(routes.login);
  await submitLogin(page);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '正在同步账户信息' })).toBeVisible();
  await expect(layoutBanner(page).getByRole('button', { name: '取消登录' })).toBeVisible();
});

test('旧会话恢复中发起新登录时，应最终认证新登录会话', async ({ page }) => {
  await mockApiHealth(page);
  const { newStudentSession, oldMeStarted, releaseOldMe } =
    await mockLoginDuringOldRestoreGraphQL(page);

  await page.goto(routes.home);
  await oldMeStarted;

  await page.goto(`${routes.login}?skipRestore=1`);
  await expect(page.getByRole('heading', { name: '账号登录' })).toBeVisible();

  await submitLogin(page);

  await expect(page).toHaveURL(/\/$/);
  await expectAuthenticatedStudentMenu(page, newStudentSession.displayName);

  releaseOldMe();

  await expect
    .poll(async () =>
      page.evaluate((storageKey) => {
        const rawSession = window.localStorage.getItem(storageKey);

        return rawSession ? (JSON.parse(rawSession) as { displayName?: string }).displayName : null;
      }, AUTH_STORAGE_KEY),
    )
    .toBe(newStudentSession.displayName);
  await expectAuthenticatedStudentMenu(page, newStudentSession.displayName);
});

test('登录成功但 me 失败时，应保留已建立会话并停留在工作台', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    loginSession: createAdminSession(),
    meErrorSequence: ['TOKEN_INVALID'],
  });

  await page.goto(routes.login);
  await submitLogin(page);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '我的工作台' })).toBeVisible();
  await expectAuthenticatedUserMenu(page, 'admin-user');
});

test('登录成功后刷新页面，应通过 me 从本地会话恢复认证状态', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: createAdminSession(),
    loginSession: createAdminSession(),
  });

  await page.goto(routes.login);
  await submitLogin(page);

  await expect(page).toHaveURL(/\/$/);
  await expectAuthenticatedUserMenu(page, 'admin-user');

  await page.reload();

  await expectAuthenticatedUserMenu(page, 'admin-user');

  await page.goto(routes.labsDemo);
  await expect(page.getByRole('heading', { name: '第三工作区跳层 Demo' })).toBeVisible();
});

test('本地 access token 失效时，应走 refresh 后恢复会话', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: createAdminSession({ displayName: 'stale-admin' }),
    meErrorSequence: ['TOKEN_INVALID'],
    refreshSession: createAdminSession({ displayName: 'refreshed-admin' }),
  });
  await seedAuthSession(page, createAdminSession({ displayName: 'stale-admin' }));

  await page.goto(routes.home);

  await expect(page).toHaveURL(/\/$/);
  await expectAuthenticatedUserMenu(page, 'refreshed-admin');
});

test('切换到失效账号时，应弹出轻量登录框而不是跳回登录页', async ({ page }) => {
  await mockApiHealth(page);
  await mockAccountSwitchReauthGraphQL(page);

  await page.goto(routes.home);

  await expect(page).toHaveURL(/\/$/);
  await expectAuthenticatedUserMenu(page, 'admin-user');

  await page.getByRole('button', { name: '用户菜单' }).click();
  await page.getByRole('button', { name: /admin-user/ }).click();
  await page.getByRole('button', { name: /staff-user/ }).click();

  const reauthDialog = page.getByRole('dialog', { name: '重新登录账号' });

  await expect(reauthDialog).toBeVisible();
  await expect(reauthDialog.getByText('staff-user 登录已失效，请重新登录后继续。')).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);

  await reauthDialog.getByLabel('密码').fill('password');
  await reauthDialog.getByRole('button', { name: '登录并切换' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /staff-user/ })).toBeVisible();
  await expectAuthenticatedUserMenu(page, 'staff-user', 'Staff');
});

test('移除当前账号并切到 fallback 时，应撤销旧当前账号 refresh token', async ({ page }) => {
  await mockApiHealth(page);
  const { fallbackStaffSession, logoutRequests } =
    await mockActiveAccountLogoutFallbackGraphQL(page);

  await page.goto(routes.home);

  await expect(page).toHaveURL(/\/$/);
  await expectAuthenticatedUserMenu(page, 'admin-user');

  await page.getByRole('button', { name: '用户菜单' }).click();
  await page.getByRole('button', { name: '退出账户' }).click();
  await page
    .locator('.ant-popover')
    .last()
    .getByRole('button', { name: /admin-user/ })
    .click();
  await expect(page.getByText('换到另一个账号？')).toBeVisible();
  await page.getByRole('button', { name: '切换过去' }).click();

  await expect.poll(() => logoutRequests.length).toBe(1);
  expect(logoutRequests[0]).toBe('Bearer admin-access-token');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /staff-user/ })).toBeVisible();
  await expectAuthenticatedUserMenu(page, 'staff-user', 'Staff');

  const storedSession = await page.evaluate((storageKey) => {
    return JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as {
      accessToken?: string;
      accountId?: number;
    } | null;
  }, AUTH_STORAGE_KEY);
  const switchRecords = await page.evaluate((storageKey) => {
    return JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as {
      session: { accountId: number };
    }[];
  }, ACCOUNT_SWITCH_STORAGE_KEY);

  expect(storedSession?.accountId).toBe(fallbackStaffSession.accountId);
  expect(storedSession?.accessToken).toBe(fallbackStaffSession.accessToken);
  expect(switchRecords).toHaveLength(1);
  expect(switchRecords[0]?.session.accountId).toBe(fallbackStaffSession.accountId);
});

test('移除当前账号时即使 logout mutation 失败，也应切到 fallback', async ({ page }) => {
  await mockApiHealth(page);
  const { fallbackStaffSession, logoutRequests } = await mockActiveAccountLogoutFallbackGraphQL(
    page,
    {
      logoutError: true,
    },
  );

  await page.goto(routes.home);

  await expect(page).toHaveURL(/\/$/);
  await expectAuthenticatedUserMenu(page, 'admin-user');

  await page.getByRole('button', { name: '用户菜单' }).click();
  await page.getByRole('button', { name: '退出账户' }).click();
  await page
    .locator('.ant-popover')
    .last()
    .getByRole('button', { name: /admin-user/ })
    .click();
  await expect(page.getByText('换到另一个账号？')).toBeVisible();
  await page.getByRole('button', { name: '切换过去' }).click();

  await expect.poll(() => logoutRequests.length).toBe(1);
  expect(logoutRequests[0]).toBe('Bearer admin-access-token');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /staff-user/ })).toBeVisible();

  const storedSession = await page.evaluate((storageKey) => {
    return JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as {
      accountId?: number;
    } | null;
  }, AUTH_STORAGE_KEY);

  expect(storedSession?.accountId).toBe(fallbackStaffSession.accountId);
});

test('移除当前账号且 fallback 需重新登录时，应在重登后撤销旧当前账号', async ({ page }) => {
  await mockApiHealth(page);
  const { freshStaffSession, logoutRequests } = await mockAccountSwitchReauthGraphQL(page);

  await page.goto(routes.home);

  await expect(page).toHaveURL(/\/$/);
  await expectAuthenticatedUserMenu(page, 'admin-user');

  await page.getByRole('button', { name: '用户菜单' }).click();
  await page.getByRole('button', { name: '退出账户' }).click();
  await page
    .locator('.ant-popover')
    .last()
    .getByRole('button', { name: /admin-user/ })
    .click();
  await expect(page.getByText('换到另一个账号？')).toBeVisible();
  await page.getByRole('button', { name: '切换过去' }).click();

  const reauthDialog = page.getByRole('dialog', { name: '重新登录账号' });

  await expect(reauthDialog).toBeVisible();
  await reauthDialog.getByLabel('密码').fill('password');
  await reauthDialog.getByRole('button', { name: '登录并切换' }).click();

  await expect.poll(() => logoutRequests.length).toBe(1);
  expect(logoutRequests[0]).toBe('Bearer admin-access-token');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /staff-user/ })).toBeVisible();
  await expectAuthenticatedUserMenu(page, 'staff-user', 'Staff');

  const storedSession = await page.evaluate((storageKey) => {
    return JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as {
      accessToken?: string;
      accountId?: number;
    } | null;
  }, AUTH_STORAGE_KEY);

  expect(storedSession?.accountId).toBe(freshStaffSession.accountId);
  expect(storedSession?.accessToken).toBe(freshStaffSession.accessToken);
});

test('refresh 成功后 me 再失败时，应保留当前工作台会话', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: createAdminSession({ displayName: 'stale-admin' }),
    meErrorSequence: ['TOKEN_INVALID', 'TOKEN_INVALID_AFTER_REFRESH'],
    refreshSession: createAdminSession({ displayName: 'refreshed-admin' }),
  });
  await seedAuthSession(page, createAdminSession({ displayName: 'stale-admin' }));

  await page.goto(routes.home);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '我的工作台' })).toBeVisible();
  await expectAuthenticatedUserMenu(page, 'refreshed-admin');
});

test('本地会话失效且 refresh 失败时，应保留现有工作台快照', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: createAdminSession({ displayName: 'expired-admin' }),
    meErrorSequence: ['TOKEN_INVALID'],
    refreshErrorMessage: 'TOKEN_INVALID',
  });
  await seedAuthSession(page, createAdminSession({ displayName: 'expired-admin' }));

  await page.goto(routes.home);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '我的工作台' })).toBeVisible();
  await expectAuthenticatedUserMenu(page, 'expired-admin');
});

test('access token 临近过期但 me 仍可用时，首页导航不应因前置续期被阻断', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: createAdminSession({ displayName: 'stale-admin' }),
  });
  await seedAuthSession(page, createAdminSession({ displayName: 'stale-admin' }));
  await replaceStoredAccessToken(page, createJwtWithExpOffsetMs(-120_000));

  await page.goto(routes.home);

  await expect(page).toHaveURL(/\/$/);
  await expectAuthenticatedUserMenu(page, 'stale-admin');
  await expect(
    page.evaluate((storageKey) => window.localStorage.getItem(storageKey), AUTH_STORAGE_KEY),
  ).resolves.not.toBeNull();
});

test('退出登录后，应清空会话并重新拦截 labs 访问', async ({ page }) => {
  let logoutRequestCount = 0;
  let logoutAuthorization: string | null = null;

  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: createAdminSession(),
    loginSession: createAdminSession(),
    onLogoutRequest: ({ authorization }) => {
      logoutRequestCount += 1;
      logoutAuthorization = authorization;
    },
  });

  await page.goto(routes.login);
  await submitLogin(page);

  const userMenuButton = page.getByRole('button', { name: '用户菜单' });
  await expect(userMenuButton).toBeVisible();
  await userMenuButton.click();

  await page.getByRole('button', { name: '退出账户' }).click();
  await expect(page.getByText('结束会话')).toBeVisible();
  await page.getByRole('button', { name: '江湖再见' }).click();

  await expect(page).toHaveURL(/\/login\?redirect=%2F$/);
  await expect(page.getByRole('heading', { name: '账号登录' })).toBeVisible();
  await expect(
    page.evaluate((storageKey) => window.localStorage.getItem(storageKey), AUTH_STORAGE_KEY),
  ).resolves.toBeNull();
  expect(logoutRequestCount).toBe(1);
  expect(logoutAuthorization).toBe('Bearer admin-access-token');

  await page.goto(routes.labsDemo);
  await expect(page).toHaveURL(
    new RegExp(`/login\\?redirect=${encodeURIComponent(routes.labsDemo)}$`),
  );
  await expect(page.getByRole('heading', { name: '账号登录' })).toBeVisible();
});

test('退出登录 mutation 失败时，仍应清空会话并进入登录页', async ({ page }) => {
  let logoutRequestCount = 0;

  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: createAdminSession(),
    loginSession: createAdminSession(),
    logoutErrorMessage: 'LOGOUT_FAILED',
    onLogoutRequest: () => {
      logoutRequestCount += 1;
    },
  });

  await page.goto(routes.login);
  await submitLogin(page);

  await expect(page).toHaveURL(/\/$/);
  await expectAuthenticatedUserMenu(page, 'admin-user');

  const userMenuButton = page.getByRole('button', { name: '用户菜单' });
  await userMenuButton.click();

  await page.getByRole('button', { name: '退出账户' }).click();
  await expect(page.getByText('结束会话')).toBeVisible();
  await page.getByRole('button', { name: '江湖再见' }).click();

  await expect.poll(() => logoutRequestCount).toBe(1);
  await expect
    .poll(async () => {
      try {
        return await page.evaluate(
          (storageKey) => window.localStorage.getItem(storageKey),
          AUTH_STORAGE_KEY,
        );
      } catch {
        return 'NAVIGATING';
      }
    })
    .toBeNull();
  await expect(page).toHaveURL(/\/login\?redirect=%2F$/);
  await expect(page.getByRole('heading', { name: '账号登录' })).toBeVisible();
  expect(logoutRequestCount).toBe(1);
});

test('redirect 指向站外地址时，登录后应回退到首页', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    loginSession: createAdminSession(),
  });

  await page.goto(`${routes.login}?redirect=${encodeURIComponent('//evil.example/phishing')}`);
  await submitLogin(page);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '我的工作台' })).toBeVisible();
  await expectAuthenticatedUserMenu(page, 'admin-user');
});

test('redirect 重新指向登录页时，登录后应回退到首页而不是形成回环', async ({ page }) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    loginSession: createAdminSession(),
  });

  await page.goto(
    `${routes.login}?redirect=${encodeURIComponent('/login?redirect=%2Flabs%2Fdemo')}`,
  );
  await submitLogin(page);

  await expect(page).toHaveURL(/\/$/);
  await expectAuthenticatedUserMenu(page, 'admin-user');
});

test('已认证会话访问 login 且 redirect 先指向 /welcome 时，应直接解到最终站内目标', async ({
  page,
}) => {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, {
    currentSession: createAdminSession(),
  });
  await seedAuthSession(page, createAdminSession());

  await page.goto(
    `${routes.login}?redirect=${encodeURIComponent('/welcome?redirect=%2Flabs%2Fdemo')}`,
  );

  await expect(page).toHaveURL(/\/labs\/demo$/);
  await expect(page.getByRole('heading', { name: '第三工作区跳层 Demo' })).toBeVisible();
});
