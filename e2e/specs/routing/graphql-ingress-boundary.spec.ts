import type { Page, Route } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { mockApiHealth } from '../../helpers/app';
import { expect, test } from '../../test';

const AUTH_STORAGE_KEY = 'aigc-friendly-frontend.auth.session.v2';
const DEFAULT_TIMESTAMP = '2026-04-03T00:00:00.000Z';

type SessionSeed = {
  accessGroup?: readonly string[];
  accessToken: string;
  accountId?: number;
  displayName: string;
  identity?:
    | {
        departmentId?: string | null;
        id?: string;
        kind: 'STAFF';
        name?: string;
      }
    | {
        departmentId?: string;
        id?: string;
        kind: 'STUDENT';
        name?: string;
      }
    | null;
  identityHint?: string | null;
  needsProfileCompletion?: boolean;
  primaryAccessGroup: 'ADMIN' | 'REGISTRANT' | 'STAFF' | 'STUDENT' | 'GUEST';
  refreshToken: string;
};

function buildPersistedSession(seed: SessionSeed) {
  return {
    accessToken: seed.accessToken,
    account: {
      id: seed.accountId ?? 9527,
      identityHint: seed.identityHint ?? seed.primaryAccessGroup,
      loginEmail: `${seed.displayName}@example.com`,
      loginName: seed.displayName,
      status: 'ACTIVE',
    },
    accountId: seed.accountId ?? 9527,
    displayName: seed.displayName,
    identity:
      seed.identity?.kind === 'STAFF'
        ? {
            accountId: seed.accountId ?? 9527,
            createdAt: DEFAULT_TIMESTAMP,
            departmentId: seed.identity.departmentId ?? 'staff-department',
            employmentStatus: 'ACTIVE',
            id: seed.identity.id ?? `staff-${seed.accountId ?? 9527}`,
            jobTitle: null,
            kind: 'STAFF',
            name: seed.identity.name ?? seed.displayName,
            remark: null,
            updatedAt: DEFAULT_TIMESTAMP,
          }
        : seed.identity?.kind === 'STUDENT'
          ? {
              accountId: seed.accountId ?? 9527,
              classId: null,
              createdAt: DEFAULT_TIMESTAMP,
              departmentId: seed.identity.departmentId ?? 'student-department',
              id: seed.identity.id ?? `student-${seed.accountId ?? 9527}`,
              kind: 'STUDENT',
              name: seed.identity.name ?? seed.displayName,
              remarks: null,
              studentStatus: 'ENROLLED',
              updatedAt: DEFAULT_TIMESTAMP,
            }
          : null,
    needsProfileCompletion: seed.needsProfileCompletion ?? false,
    primaryAccessGroup: seed.primaryAccessGroup,
    refreshToken: seed.refreshToken,
    slotGroup: [],
    userInfo: {
      accessGroup: seed.accessGroup ?? [seed.primaryAccessGroup],
      avatarUrl: null,
      email: `${seed.displayName}@example.com`,
      nickname: seed.displayName,
    },
    version: 2,
  };
}

async function seedPersistedSession(page: Page, seed: SessionSeed) {
  await page.addInitScript(
    ({ key, session }) => {
      window.localStorage.setItem(key, JSON.stringify(session));
    },
    {
      key: AUTH_STORAGE_KEY,
      session: buildPersistedSession(seed),
    },
  );
}

function getAuthorization(route: Route) {
  return route.request().headers().authorization ?? null;
}

function getQuery(route: Route) {
  const payload = route.request().postDataJSON() as { query?: string } | undefined;

  return typeof payload?.query === 'string' ? payload.query : '';
}

async function fulfillGraphQL(route: Route, body: unknown) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status: 200,
  });
}

async function fulfillGraphQLError(route: Route, message: string, code?: string) {
  await fulfillGraphQL(route, {
    errors: [
      {
        message,
        ...(code ? { extensions: { code } } : {}),
      },
    ],
  });
}

test('已认证 runtime 下的 public-auth 请求不应携带 Authorization', async ({ page }) => {
  const session = {
    accessToken: 'runtime-access-token',
    accountId: 9527,
    displayName: 'admin-user',
    primaryAccessGroup: 'ADMIN' as const,
    refreshToken: 'runtime-refresh-token',
  };
  let forgotPasswordAuthHeader: string | null = 'UNSET';

  await mockApiHealth(page);
  await seedPersistedSession(page, session);

  await page.route('**/graphql', async (route) => {
    const query = getQuery(route);

    if (query.includes('query Me')) {
      await fulfillGraphQL(route, {
        data: {
          me: {
            account: {
              id: session.accountId,
              identityHint: 'ADMIN',
              loginEmail: `${session.displayName}@example.com`,
              loginName: session.displayName,
              status: 'ACTIVE',
            },
            accountId: session.accountId,
            identity: null,
            needsProfileCompletion: false,
            userInfo: {
              accessGroup: ['ADMIN'],
              avatarUrl: null,
              email: `${session.displayName}@example.com`,
              nickname: session.displayName,
            },
          },
        },
      });
      return;
    }

    if (query.includes('mutation RequestPasswordResetEmail')) {
      forgotPasswordAuthHeader = getAuthorization(route);
      await fulfillGraphQL(route, {
        data: {
          requestPasswordResetEmail: {
            message: null,
            success: true,
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.home);
  await expect(page.getByRole('banner')).toContainText('admin-user');

  await page.goto(routes.forgotPassword);
  await page.getByLabel('邮箱').fill('tester@example.com');
  await page.getByRole('button', { name: '发送重置邮件' }).click();

  await expect(page.getByText('若该账户存在，我们已发送重置邮件。')).toBeVisible();
  expect(forgotPasswordAuthHeader).toBeNull();
});

test('资料补全请求应带显式 token，而 refresh 请求不应携带 Authorization', async ({ page }) => {
  const session = {
    accessGroup: ['REGISTRANT'] as const,
    accessToken: 'registrant-access-token',
    accountId: 1000,
    displayName: 'pending-user',
    identity: null,
    identityHint: 'STUDENT',
    needsProfileCompletion: true,
    primaryAccessGroup: 'REGISTRANT' as const,
    refreshToken: 'registrant-refresh-token',
  };
  let completeProfileAuthHeader: string | null = 'UNSET';
  let refreshAuthHeader: string | null = 'UNSET';

  await mockApiHealth(page);
  await seedPersistedSession(page, session);

  await page.route('**/graphql', async (route) => {
    const query = getQuery(route);

    if (query.includes('query Me')) {
      await fulfillGraphQL(route, {
        data: {
          me: {
            account: {
              id: session.accountId,
              identityHint: session.identityHint,
              loginEmail: `${session.displayName}@example.com`,
              loginName: session.displayName,
              status: 'ACTIVE',
            },
            accountId: session.accountId,
            identity: null,
            needsProfileCompletion: true,
            userInfo: {
              accessGroup: ['REGISTRANT'],
              avatarUrl: null,
              email: `${session.displayName}@example.com`,
              nickname: session.displayName,
            },
          },
        },
      });
      return;
    }

    if (query.includes('mutation CompleteMyProfile')) {
      completeProfileAuthHeader = getAuthorization(route);
      await fulfillGraphQL(route, {
        data: {
          completeMyProfile: {
            success: true,
          },
        },
      });
      return;
    }

    if (query.includes('mutation Refresh')) {
      refreshAuthHeader = getAuthorization(route);
      await fulfillGraphQL(route, {
        data: {
          refresh: {
            accessToken: 'completed-access-token',
            refreshToken: 'completed-refresh-token',
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.welcome);
  await page.getByText('我是学生').click();
  await page.getByLabel('姓名').fill('王同学');
  await page.getByRole('button', { name: '提交并继续' }).click();

  await expect(page.getByRole('alert')).toContainText(
    '资料已提交，但当前会话仍显示待补全，请联系管理员核查后端收敛。',
  );
  expect(completeProfileAuthHeader).toBe('Bearer registrant-access-token');
  expect(refreshAuthHeader).toBeNull();
});

test('普通 protected GraphQL 请求应携带 Authorization，且 UNAUTHENTICATED 不应触发 shared refresh', async ({
  page,
}) => {
  const session = {
    accessToken: 'admin-access-token',
    accountId: 1,
    displayName: 'root-admin',
    primaryAccessGroup: 'ADMIN' as const,
    refreshToken: 'admin-refresh-token',
  };
  let debugRequestAuthHeader: string | null = 'UNSET';
  let refreshRequestCount = 0;

  await mockApiHealth(page);
  await seedPersistedSession(page, session);

  await page.route('**/graphql', async (route) => {
    const query = getQuery(route);

    if (query.includes('query Me')) {
      await fulfillGraphQL(route, {
        data: {
          me: {
            account: {
              id: session.accountId,
              identityHint: 'ADMIN',
              loginEmail: `${session.displayName}@example.com`,
              loginName: session.displayName,
              status: 'ACTIVE',
            },
            accountId: session.accountId,
            identity: null,
            needsProfileCompletion: false,
            userInfo: {
              accessGroup: ['ADMIN'],
              avatarUrl: null,
              email: `${session.displayName}@example.com`,
              nickname: session.displayName,
            },
          },
        },
      });
      return;
    }

    if (query.includes('mutation Refresh')) {
      refreshRequestCount += 1;
      await fulfillGraphQLError(route, 'UNEXPECTED_REFRESH');
      return;
    }

    if (query.includes('query DebugEncryptSstsPayload')) {
      debugRequestAuthHeader = getAuthorization(route);
      await fulfillGraphQLError(route, 'UNAUTHENTICATED', 'UNAUTHENTICATED');
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.labsPayloadCrypto);
  await page.getByRole('textbox').first().fill('{"value":"demo"}');
  await page.getByRole('button', { name: '查看结果' }).click();

  await expect(page.getByText('Error encrypting payload: UNAUTHENTICATED')).toBeVisible();
  expect(debugRequestAuthHeader).toBe('Bearer admin-access-token');
  expect(refreshRequestCount).toBe(0);
});

test('restore 触发 refresh 后，后续 me 请求应显式使用 refresh 返回的新 access token', async ({
  page,
}) => {
  const staleSession = {
    accessGroup: ['ADMIN'] as const,
    accessToken: 'stale-access-token',
    accountId: 9527,
    displayName: 'stale-admin',
    identity: null,
    identityHint: 'ADMIN',
    needsProfileCompletion: false,
    primaryAccessGroup: 'ADMIN' as const,
    refreshToken: 'stale-refresh-token',
  };
  const meAuthHeaders: string[] = [];
  let refreshAuthHeader: string | null = 'UNSET';

  await mockApiHealth(page);
  await seedPersistedSession(page, staleSession);

  await page.route('**/graphql', async (route) => {
    const query = getQuery(route);

    if (query.includes('query Me')) {
      meAuthHeaders.push(getAuthorization(route) ?? 'NONE');

      if (meAuthHeaders.length === 1) {
        await fulfillGraphQLError(route, 'TOKEN_INVALID');
        return;
      }

      await fulfillGraphQL(route, {
        data: {
          me: {
            account: {
              id: staleSession.accountId,
              identityHint: 'ADMIN',
              loginEmail: 'refreshed-admin@example.com',
              loginName: 'refreshed-admin',
              status: 'ACTIVE',
            },
            accountId: staleSession.accountId,
            identity: null,
            needsProfileCompletion: false,
            userInfo: {
              accessGroup: ['ADMIN'],
              avatarUrl: null,
              email: 'refreshed-admin@example.com',
              nickname: 'refreshed-admin',
            },
          },
        },
      });
      return;
    }

    if (query.includes('mutation Refresh')) {
      refreshAuthHeader = getAuthorization(route);
      await fulfillGraphQL(route, {
        data: {
          refresh: {
            accessToken: 'fresh-access-token',
            refreshToken: 'fresh-refresh-token',
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.home);

  await expect(page.getByRole('banner')).toContainText('refreshed-admin');
  expect(meAuthHeaders).toEqual(['Bearer stale-access-token', 'Bearer fresh-access-token']);
  expect(refreshAuthHeader).toBeNull();
});
