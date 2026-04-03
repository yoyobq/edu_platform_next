import { expect, type Page, type Route } from '@playwright/test';

import { routes } from '../fixtures/routes';

type AuthAccessGroup = 'ADMIN' | 'GUEST' | 'STAFF' | 'STUDENT';
type SessionIdentityKind = AuthAccessGroup;

type StaffIdentitySeed = {
  kind: 'STAFF';
  departmentId?: string | null;
  employmentStatus?: string;
  id?: string;
  jobTitle?: string | null;
  name?: string;
  remark?: string | null;
};

type StudentIdentitySeed = {
  classId?: number | null;
  departmentId?: string;
  id?: string;
  kind: 'STUDENT';
  name?: string;
  remarks?: string | null;
  studentStatus?: string;
};

type SessionIdentitySeed = StaffIdentitySeed | StudentIdentitySeed | null;

export type SeedAuthSessionOptions = {
  accessGroup?: readonly AuthAccessGroup[];
  accountId?: number;
  displayName?: string;
  identity?: SessionIdentitySeed;
  primaryAccessGroup?: SessionIdentityKind;
  slotGroup?: readonly string[];
};

type SessionProfile = {
  accessGroup: readonly AuthAccessGroup[];
  accountId: number;
  displayName: string;
  identity: SessionIdentitySeed;
  primaryAccessGroup: SessionIdentityKind;
  slotGroup: readonly string[];
};

type MockAuthGraphQLOptions = {
  currentSession?: SeedAuthSessionOptions;
  loginErrorMessage?: string;
  loginSession?: SeedAuthSessionOptions;
  logoutErrorMessage?: string;
  meErrorSequence?: readonly string[];
  refreshErrorMessage?: string;
  refreshSession?: SeedAuthSessionOptions;
};

const AUTH_STORAGE_KEY = 'aigc-friendly-frontend.auth.session.v2';
const DEFAULT_TIMESTAMP = '2026-04-03T00:00:00.000Z';

function resolvePrimaryAccessGroup(options: SeedAuthSessionOptions): SessionIdentityKind {
  if (options.primaryAccessGroup) {
    return options.primaryAccessGroup;
  }

  if (options.identity?.kind === 'STAFF') {
    return 'STAFF';
  }

  if (options.identity?.kind === 'STUDENT') {
    return 'STUDENT';
  }

  if (options.accessGroup?.includes('GUEST')) {
    return 'GUEST';
  }

  if (options.accessGroup?.includes('ADMIN')) {
    return 'ADMIN';
  }

  if (options.accessGroup?.includes('STAFF')) {
    return 'STAFF';
  }

  if (options.accessGroup?.includes('STUDENT')) {
    return 'STUDENT';
  }

  return 'ADMIN';
}

function resolveDefaultAccountId(primaryAccessGroup: SessionIdentityKind) {
  switch (primaryAccessGroup) {
    case 'ADMIN':
      return 9527;
    case 'STAFF':
      return 1001;
    case 'STUDENT':
      return 1002;
    default:
      return 1000;
  }
}

function buildSessionProfile(options: SeedAuthSessionOptions = {}): SessionProfile {
  const primaryAccessGroup = resolvePrimaryAccessGroup(options);
  const defaultAccessGroup: readonly AuthAccessGroup[] =
    options.accessGroup ??
    (primaryAccessGroup === 'ADMIN'
      ? ['ADMIN']
      : primaryAccessGroup === 'GUEST'
        ? ['GUEST']
        : primaryAccessGroup === 'STAFF'
          ? ['STAFF']
          : ['STUDENT']);

  return {
    accessGroup: defaultAccessGroup,
    accountId: options.accountId ?? resolveDefaultAccountId(primaryAccessGroup),
    displayName: options.displayName ?? `${primaryAccessGroup.toLowerCase()}-user`,
    identity:
      options.identity ??
      (primaryAccessGroup === 'STAFF'
        ? { kind: 'STAFF' }
        : primaryAccessGroup === 'STUDENT'
          ? { kind: 'STUDENT' }
          : null),
    primaryAccessGroup,
    slotGroup: options.slotGroup ?? [],
  };
}

function buildTokens(profile: SessionProfile) {
  const tokenPrefix = profile.primaryAccessGroup.toLowerCase();

  return {
    accessToken: `${tokenPrefix}-access-token`,
    refreshToken: `${tokenPrefix}-refresh-token`,
  };
}

function buildPersistedSession(profile: SessionProfile) {
  const tokens = buildTokens(profile);

  return {
    accessToken: tokens.accessToken,
    account: {
      id: profile.accountId,
      identityHint: profile.primaryAccessGroup,
      loginEmail: `${profile.displayName}@example.com`,
      loginName: profile.displayName,
      status: 'ACTIVE',
    },
    accountId: profile.accountId,
    displayName: profile.displayName,
    identity:
      profile.identity?.kind === 'STAFF'
        ? {
            accountId: profile.accountId,
            createdAt: DEFAULT_TIMESTAMP,
            departmentId: profile.identity.departmentId ?? 'staff-department',
            employmentStatus: profile.identity.employmentStatus ?? 'ACTIVE',
            id: profile.identity.id ?? `staff-${profile.accountId}`,
            jobTitle: profile.identity.jobTitle ?? null,
            kind: 'STAFF',
            name: profile.identity.name ?? profile.displayName,
            remark: profile.identity.remark ?? null,
            updatedAt: DEFAULT_TIMESTAMP,
          }
        : profile.identity?.kind === 'STUDENT'
          ? {
              accountId: profile.accountId,
              classId: profile.identity.classId ?? null,
              createdAt: DEFAULT_TIMESTAMP,
              departmentId: profile.identity.departmentId ?? 'student-department',
              id: profile.identity.id ?? `student-${profile.accountId}`,
              kind: 'STUDENT',
              name: profile.identity.name ?? profile.displayName,
              remarks: profile.identity.remarks ?? null,
              studentStatus: profile.identity.studentStatus ?? 'ENROLLED',
              updatedAt: DEFAULT_TIMESTAMP,
            }
          : null,
    primaryAccessGroup: profile.primaryAccessGroup,
    refreshToken: tokens.refreshToken,
    slotGroup: profile.slotGroup,
    userInfo: {
      accessGroup: profile.accessGroup,
      avatarUrl: null,
      email: `${profile.displayName}@example.com`,
      nickname: profile.displayName,
    },
    version: 2,
  };
}

function buildMePayload(profile: SessionProfile) {
  return {
    account: {
      id: profile.accountId,
      identityHint: profile.primaryAccessGroup,
      loginEmail: `${profile.displayName}@example.com`,
      loginName: profile.displayName,
      status: 'ACTIVE',
    },
    accountId: profile.accountId,
    identity:
      profile.identity?.kind === 'STAFF'
        ? {
            __typename: 'StaffType',
            accountId: profile.accountId,
            createdAt: DEFAULT_TIMESTAMP,
            departmentId: profile.identity.departmentId ?? 'staff-department',
            employmentStatus: profile.identity.employmentStatus ?? 'ACTIVE',
            id: profile.identity.id ?? `staff-${profile.accountId}`,
            jobTitle: profile.identity.jobTitle ?? null,
            name: profile.identity.name ?? profile.displayName,
            remark: profile.identity.remark ?? null,
            updatedAt: DEFAULT_TIMESTAMP,
          }
        : profile.identity?.kind === 'STUDENT'
          ? {
              __typename: 'StudentType',
              accountId: profile.accountId,
              classId: profile.identity.classId ?? null,
              createdAt: DEFAULT_TIMESTAMP,
              id: profile.identity.id ?? `student-${profile.accountId}`,
              name: profile.identity.name ?? profile.displayName,
              remarks: profile.identity.remarks ?? null,
              studentDepartmentId: profile.identity.departmentId ?? 'student-department',
              studentStatus: profile.identity.studentStatus ?? 'ENROLLED',
              updatedAt: DEFAULT_TIMESTAMP,
            }
          : null,
    userInfo: {
      accessGroup: profile.accessGroup,
      avatarUrl: null,
      email: `${profile.displayName}@example.com`,
      nickname: profile.displayName,
    },
  };
}

async function fulfillGraphQLError(route: Route, message: string) {
  await route.fulfill({
    body: JSON.stringify({
      errors: [{ message }],
    }),
    contentType: 'application/json',
    status: 200,
  });
}

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

export async function mockAuthGraphQL(
  page: Page,
  options: MockAuthGraphQLOptions = {},
): Promise<void> {
  let currentProfile = buildSessionProfile(options.currentSession ?? options.loginSession);
  const meErrorSequence = [...(options.meErrorSequence ?? [])];

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as { query?: string } | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('mutation Login')) {
      if (options.loginErrorMessage) {
        await fulfillGraphQLError(route, options.loginErrorMessage);
        return;
      }

      currentProfile = buildSessionProfile(options.loginSession ?? currentProfile);

      await route.fulfill({
        body: JSON.stringify({
          data: {
            login: buildTokens(currentProfile),
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation Refresh')) {
      if (options.refreshErrorMessage) {
        await fulfillGraphQLError(route, options.refreshErrorMessage);
        return;
      }

      currentProfile = buildSessionProfile(options.refreshSession ?? currentProfile);

      await route.fulfill({
        body: JSON.stringify({
          data: {
            refresh: buildTokens(currentProfile),
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation Logout')) {
      if (options.logoutErrorMessage) {
        await fulfillGraphQLError(route, options.logoutErrorMessage);
        return;
      }

      await route.fulfill({
        body: JSON.stringify({
          data: {
            logout: {
              success: true,
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('query Me')) {
      const nextMeError = meErrorSequence.shift();

      if (nextMeError) {
        await fulfillGraphQLError(route, nextMeError);
        return;
      }

      await route.fulfill({
        body: JSON.stringify({
          data: {
            me: buildMePayload(currentProfile),
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    await route.fallback();
  });
}

export async function seedAuthSession(page: Page, options: SeedAuthSessionOptions): Promise<void> {
  const profile = buildSessionProfile(options);
  const persistedSession = buildPersistedSession(profile);

  await page.addInitScript(
    ({ key, session }) => {
      window.localStorage.setItem(key, JSON.stringify(session));
    },
    {
      key: AUTH_STORAGE_KEY,
      session: persistedSession,
    },
  );
}

export async function openHomeAs(
  page: Page,
  sessionOptions: SeedAuthSessionOptions = { primaryAccessGroup: 'ADMIN' },
): Promise<void> {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, { currentSession: sessionOptions });
  await seedAuthSession(page, sessionOptions);
  await page.goto(routes.home);
  await expect(page.getByRole('heading', { name: 'aigc-friendly-frontend' })).toBeVisible();
}

export async function openHome(page: Page): Promise<void> {
  await openHomeAs(page, { primaryAccessGroup: 'ADMIN' });
}

export async function openHomeAsAdmin(page: Page): Promise<void> {
  await openHome(page);
}

export async function openHomeWithSearch(page: Page, search: string): Promise<void> {
  await mockApiHealth(page);
  await mockAuthGraphQL(page, { currentSession: { primaryAccessGroup: 'ADMIN' } });
  await seedAuthSession(page, { primaryAccessGroup: 'ADMIN' });
  await page.goto(`${routes.home}${search}`);
  await expect(page.getByRole('heading', { name: 'aigc-friendly-frontend' })).toBeVisible();
}

export async function openEntrySidecar(page: Page): Promise<void> {
  await getEntrySidecarTrigger(page).click();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
}

export function getEntrySidecarTrigger(page: Page) {
  return page.locator('button[aria-keyshortcuts="Alt+K"]');
}
