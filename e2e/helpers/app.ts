import { expect, type Page, type Route } from '@playwright/test';

import { routes } from '../fixtures/routes';

type AuthAccessGroup = 'ADMIN' | 'GUEST' | 'REGISTRANT' | 'STAFF' | 'STUDENT';
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
  identityHint?: AuthAccessGroup | null;
  needsProfileCompletion?: boolean;
  primaryAccessGroup?: SessionIdentityKind;
  slotGroup?: readonly string[];
};

type SessionProfile = {
  accessGroup: readonly AuthAccessGroup[];
  accountId: number;
  displayName: string;
  identity: SessionIdentitySeed;
  identityHint: AuthAccessGroup | null;
  needsProfileCompletion: boolean;
  primaryAccessGroup: SessionIdentityKind;
  slotGroup: readonly string[];
};

type MockAuthGraphQLOptions = {
  batchUpdateAccountStatusErrorMessage?: string;
  adminUsersErrorMessage?: string;
  adminUsersItems?: readonly AdminUserListSeed[];
  completeProfileErrorMessage?: string;
  completeProfileSession?: SeedAuthSessionOptions;
  currentSession?: SeedAuthSessionOptions;
  loginErrorMessage?: string;
  loginSession?: SeedAuthSessionOptions;
  meDelayMs?: number;
  meErrorSequence?: readonly string[];
  refreshErrorMessage?: string;
  refreshSession?: SeedAuthSessionOptions;
};

const AUTH_STORAGE_KEY = 'aigc-friendly-frontend.auth.session.v2';
const DEFAULT_TIMESTAMP = '2026-04-03T00:00:00.000Z';

type AdminUserListSeed = {
  account: {
    createdAt: string;
    id: number;
    identityHint: AuthAccessGroup | null;
    loginEmail: string | null;
    loginName: string | null;
    status: AdminUserAccountStatusSeed;
  };
  staff: {
    departmentId: string | null;
    employmentStatus: 'ACTIVE' | 'LEFT' | 'SUSPENDED';
    id: string;
    jobTitle: string | null;
    name: string;
  } | null;
  userInfo: {
    accessGroup: readonly AuthAccessGroup[];
    avatarUrl: string | null;
    nickname: string;
    phone: string | null;
    userState: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';
  };
};

type AdminUserAccountStatusSeed =
  | 'ACTIVE'
  | 'BANNED'
  | 'DELETED'
  | 'INACTIVE'
  | 'PENDING'
  | 'SUSPENDED';

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

  if (options.accessGroup?.includes('REGISTRANT')) {
    return 'REGISTRANT';
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
        : primaryAccessGroup === 'REGISTRANT'
          ? ['REGISTRANT']
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
    identityHint:
      options.identityHint === undefined ? primaryAccessGroup : (options.identityHint ?? null),
    needsProfileCompletion:
      options.needsProfileCompletion ??
      (defaultAccessGroup.includes('REGISTRANT') ||
        (defaultAccessGroup.length === 1 &&
          defaultAccessGroup[0] === 'ADMIN' &&
          !options.identity &&
          (options.identityHint === 'STAFF' || options.identityHint === 'STUDENT'))),
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
      identityHint: profile.identityHint,
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
              id: profile.identity.id ?? `student-${profile.accountId}`,
              kind: 'STUDENT',
              name: profile.identity.name ?? profile.displayName,
              remarks: profile.identity.remarks ?? null,
              studentStatus: profile.identity.studentStatus ?? 'ENROLLED',
              updatedAt: DEFAULT_TIMESTAMP,
            }
          : null,
    needsProfileCompletion: profile.needsProfileCompletion,
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
      identityHint: profile.identityHint,
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
              studentStatus: profile.identity.studentStatus ?? 'ENROLLED',
              updatedAt: DEFAULT_TIMESTAMP,
            }
          : null,
    needsProfileCompletion: profile.needsProfileCompletion,
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

function cloneAdminUserListSeed(item: AdminUserListSeed): AdminUserListSeed {
  return {
    account: { ...item.account },
    staff: item.staff ? { ...item.staff } : null,
    userInfo: {
      ...item.userInfo,
      accessGroup: [...item.userInfo.accessGroup],
    },
  };
}

function isAdminUserAccountStatusSeed(value: string): value is AdminUserAccountStatusSeed {
  return (
    value === 'ACTIVE' ||
    value === 'BANNED' ||
    value === 'DELETED' ||
    value === 'INACTIVE' ||
    value === 'PENDING' ||
    value === 'SUSPENDED'
  );
}

function buildDefaultAdminUserListSeeds(): readonly AdminUserListSeed[] {
  return [
    {
      account: {
        createdAt: '2026-04-12T08:00:00.000Z',
        id: 1012,
        identityHint: 'STUDENT',
        loginEmail: 'student.mu@example.com',
        loginName: 'student.mu',
        status: 'DELETED',
      },
      staff: null,
      userInfo: {
        accessGroup: ['STUDENT'],
        avatarUrl: null,
        nickname: 'Mu',
        phone: null,
        userState: 'INACTIVE',
      },
    },
    {
      account: {
        createdAt: '2026-04-11T08:00:00.000Z',
        id: 1011,
        identityHint: 'STAFF',
        loginEmail: 'staff.lambda@example.com',
        loginName: 'staff.lambda',
        status: 'ACTIVE',
      },
      staff: {
        departmentId: 'd-lambda',
        employmentStatus: 'ACTIVE',
        id: 'staff-1011',
        jobTitle: '辅导员',
        name: 'Lambda Xu',
      },
      userInfo: {
        accessGroup: ['STAFF'],
        avatarUrl: null,
        nickname: 'Lambda',
        phone: '13800000011',
        userState: 'ACTIVE',
      },
    },
    {
      account: {
        createdAt: '2026-04-10T08:00:00.000Z',
        id: 1010,
        identityHint: 'GUEST',
        loginEmail: 'guest.kappa@example.com',
        loginName: 'guest.kappa',
        status: 'INACTIVE',
      },
      staff: null,
      userInfo: {
        accessGroup: ['GUEST'],
        avatarUrl: null,
        nickname: 'Kappa',
        phone: null,
        userState: 'INACTIVE',
      },
    },
    {
      account: {
        createdAt: '2026-04-09T08:00:00.000Z',
        id: 1009,
        identityHint: 'STAFF',
        loginEmail: 'staff.iota@example.com',
        loginName: 'staff.iota',
        status: 'ACTIVE',
      },
      staff: {
        departmentId: 'd-iota',
        employmentStatus: 'ACTIVE',
        id: 'staff-1009',
        jobTitle: '教研秘书',
        name: 'Grace Lin',
      },
      userInfo: {
        accessGroup: ['STAFF'],
        avatarUrl: null,
        nickname: 'Iota',
        phone: '13800000009',
        userState: 'ACTIVE',
      },
    },
    {
      account: {
        createdAt: '2026-04-08T08:00:00.000Z',
        id: 1008,
        identityHint: 'REGISTRANT',
        loginEmail: 'noinfo.theta@example.com',
        loginName: 'noinfo.theta',
        status: 'ACTIVE',
      },
      staff: null,
      userInfo: {
        accessGroup: ['REGISTRANT'],
        avatarUrl: null,
        nickname: '',
        phone: null,
        userState: 'PENDING',
      },
    },
    {
      account: {
        createdAt: '2026-04-07T08:00:00.000Z',
        id: 1007,
        identityHint: 'STAFF',
        loginEmail: 'staff.eta@example.com',
        loginName: 'staff.eta',
        status: 'BANNED',
      },
      staff: {
        departmentId: 'd-eta',
        employmentStatus: 'SUSPENDED',
        id: 'staff-1007',
        jobTitle: '辅导员',
        name: 'Eta Huang',
      },
      userInfo: {
        accessGroup: ['STAFF'],
        avatarUrl: null,
        nickname: 'Eta',
        phone: '13800000007',
        userState: 'SUSPENDED',
      },
    },
    {
      account: {
        createdAt: '2026-04-06T08:00:00.000Z',
        id: 1006,
        identityHint: 'STAFF',
        loginEmail: 'staff.zeta@example.com',
        loginName: 'staff.zeta',
        status: 'SUSPENDED',
      },
      staff: {
        departmentId: 'd-zeta',
        employmentStatus: 'LEFT',
        id: 'staff-1006',
        jobTitle: '实验员',
        name: 'Zeta Li',
      },
      userInfo: {
        accessGroup: ['STAFF'],
        avatarUrl: null,
        nickname: 'Zeta',
        phone: '13800000006',
        userState: 'SUSPENDED',
      },
    },
    {
      account: {
        createdAt: '2026-04-05T08:00:00.000Z',
        id: 1005,
        identityHint: 'ADMIN',
        loginEmail: 'multi.epsilon@example.com',
        loginName: 'multi.epsilon',
        status: 'ACTIVE',
      },
      staff: {
        departmentId: 'd-epsilon',
        employmentStatus: 'ACTIVE',
        id: 'staff-1005',
        jobTitle: '管理员',
        name: 'Epsilon Wu',
      },
      userInfo: {
        accessGroup: ['ADMIN', 'STAFF'],
        avatarUrl: null,
        nickname: 'Epsilon',
        phone: '13800000005',
        userState: 'ACTIVE',
      },
    },
    {
      account: {
        createdAt: '2026-04-04T08:00:00.000Z',
        id: 1004,
        identityHint: 'REGISTRANT',
        loginEmail: 'registrant.delta@example.com',
        loginName: 'registrant.delta',
        status: 'PENDING',
      },
      staff: null,
      userInfo: {
        accessGroup: ['REGISTRANT'],
        avatarUrl: null,
        nickname: 'Delta',
        phone: null,
        userState: 'PENDING',
      },
    },
    {
      account: {
        createdAt: '2026-04-03T08:00:00.000Z',
        id: 1003,
        identityHint: 'STUDENT',
        loginEmail: 'student.gamma@example.com',
        loginName: 'student.gamma',
        status: 'INACTIVE',
      },
      staff: null,
      userInfo: {
        accessGroup: ['STUDENT'],
        avatarUrl: null,
        nickname: 'Gamma',
        phone: null,
        userState: 'INACTIVE',
      },
    },
    {
      account: {
        createdAt: '2026-04-02T08:00:00.000Z',
        id: 1002,
        identityHint: 'STAFF',
        loginEmail: 'staff.beta@example.com',
        loginName: 'staff.beta',
        status: 'ACTIVE',
      },
      staff: {
        departmentId: 'd-beta',
        employmentStatus: 'ACTIVE',
        id: 'staff-1002',
        jobTitle: '讲师',
        name: 'Beta Wang',
      },
      userInfo: {
        accessGroup: ['STAFF'],
        avatarUrl: null,
        nickname: 'Beta',
        phone: '13800000002',
        userState: 'ACTIVE',
      },
    },
    {
      account: {
        createdAt: '2026-04-01T08:00:00.000Z',
        id: 1001,
        identityHint: 'ADMIN',
        loginEmail: 'admin.alpha@example.com',
        loginName: 'admin.alpha',
        status: 'ACTIVE',
      },
      staff: {
        departmentId: 'd-admin',
        employmentStatus: 'ACTIVE',
        id: 'staff-1001',
        jobTitle: '系统管理员',
        name: 'Alpha Chen',
      },
      userInfo: {
        accessGroup: ['ADMIN'],
        avatarUrl: null,
        nickname: 'Alpha',
        phone: '13800000001',
        userState: 'ACTIVE',
      },
    },
  ];
}

function matchAdminUserQuery(item: AdminUserListSeed, query: string | undefined) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    item.account.loginName ?? '',
    item.account.loginEmail ?? '',
    item.userInfo.nickname,
    item.staff?.name ?? '',
  ].some((candidate) => candidate.toLowerCase().includes(normalizedQuery));
}

function sortAdminUserItems(
  items: readonly AdminUserListSeed[],
  sortBy: string | undefined,
  sortOrder: string | undefined,
) {
  const direction = sortOrder === 'ASC' ? 1 : -1;
  const normalizedSortBy = sortBy === 'id' || sortBy === 'loginName' ? sortBy : 'createdAt';

  return [...items].sort((left, right) => {
    if (normalizedSortBy === 'id') {
      return (left.account.id - right.account.id) * direction;
    }

    if (normalizedSortBy === 'loginName') {
      return (
        (left.account.loginName ?? '').localeCompare(right.account.loginName ?? '') * direction
      );
    }

    return left.account.createdAt.localeCompare(right.account.createdAt) * direction;
  });
}

function buildAdminUsersPayload(
  items: readonly AdminUserListSeed[],
  variables: Record<string, unknown>,
) {
  const filteredItems = sortAdminUserItems(
    items.filter((item) => {
      const query = typeof variables.query === 'string' ? variables.query : undefined;
      const status = typeof variables.status === 'string' ? variables.status : undefined;
      const accessGroups = Array.isArray(variables.accessGroups)
        ? variables.accessGroups.filter(
            (value): value is AuthAccessGroup => typeof value === 'string',
          )
        : [];
      const hasStaff =
        typeof variables.hasStaff === 'boolean' ? (variables.hasStaff as boolean) : undefined;

      if (!matchAdminUserQuery(item, query)) {
        return false;
      }

      if (status && item.account.status !== status) {
        return false;
      }

      if (accessGroups.length > 0) {
        const matchesAccessGroup = accessGroups.some((accessGroup) =>
          item.userInfo.accessGroup.includes(accessGroup),
        );

        if (!matchesAccessGroup) {
          return false;
        }
      }

      if (hasStaff === true && !item.staff) {
        return false;
      }

      if (hasStaff === false && item.staff) {
        return false;
      }

      return true;
    }),
    typeof variables.sortBy === 'string' ? variables.sortBy : undefined,
    typeof variables.sortOrder === 'string' ? variables.sortOrder : undefined,
  );

  const page = typeof variables.page === 'number' ? Math.max(Math.trunc(variables.page), 1) : 1;
  const limit =
    typeof variables.limit === 'number'
      ? Math.min(Math.max(Math.trunc(variables.limit), 1), 100)
      : 10;
  const startIndex = (page - 1) * limit;

  return {
    current: page,
    list: filteredItems.slice(startIndex, startIndex + limit),
    pageSize: limit,
    total: filteredItems.length,
  };
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
  const adminUsersItems = (options.adminUsersItems ?? buildDefaultAdminUserListSeeds()).map(
    cloneAdminUserListSeed,
  );

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as
      | { query?: string; variables?: Record<string, unknown> }
      | undefined;
    const query = typeof payload?.query === 'string' ? payload.query : '';
    const variables = payload?.variables ?? {};

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

    if (query.includes('mutation CompleteMyProfile')) {
      if (options.completeProfileErrorMessage) {
        await fulfillGraphQLError(route, options.completeProfileErrorMessage);
        return;
      }

      currentProfile = buildSessionProfile(options.completeProfileSession ?? currentProfile);

      await route.fulfill({
        body: JSON.stringify({
          data: {
            completeMyProfile: {
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

      if (options.meDelayMs && options.meDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.meDelayMs));
      }

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

    if (query.includes('query AdminUsers')) {
      if (options.adminUsersErrorMessage) {
        await fulfillGraphQLError(route, options.adminUsersErrorMessage);
        return;
      }

      await route.fulfill({
        body: JSON.stringify({
          data: {
            adminUsers: buildAdminUsersPayload(adminUsersItems, variables),
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    if (query.includes('mutation BatchUpdateAccountStatus')) {
      if (options.batchUpdateAccountStatusErrorMessage) {
        await fulfillGraphQLError(route, options.batchUpdateAccountStatusErrorMessage);
        return;
      }

      const accountIds = Array.isArray(
        (variables as { input?: { accountIds?: unknown[] } }).input?.accountIds,
      )
        ? (variables as { input: { accountIds: unknown[] } }).input.accountIds.filter(
            (value): value is number => typeof value === 'number' && Number.isInteger(value),
          )
        : [];
      const nextStatus =
        typeof (variables as { input?: { status?: unknown } }).input?.status === 'string' &&
        isAdminUserAccountStatusSeed((variables as { input: { status: string } }).input.status)
          ? (variables as { input: { status: AdminUserAccountStatusSeed } }).input.status
          : null;
      const updatedAt = '2026-04-13T08:00:00.000Z';

      let updatedCount = 0;

      const accounts = accountIds
        .map((accountId) => adminUsersItems.find((item) => item.account.id === accountId))
        .filter((item): item is AdminUserListSeed => Boolean(item))
        .map((item) => {
          const isUpdated = nextStatus !== null && item.account.status !== nextStatus;

          if (isUpdated) {
            item.account.status = nextStatus;
            updatedCount += 1;
          }

          return {
            createdAt: item.account.createdAt,
            id: item.account.id,
            identityHint: item.account.identityHint,
            loginEmail: item.account.loginEmail,
            loginName: item.account.loginName,
            status: item.account.status,
            updatedAt,
          };
        });

      await route.fulfill({
        body: JSON.stringify({
          data: {
            batchUpdateAccountStatus: {
              requestedCount: accountIds.length,
              updatedCount,
              isUpdated: nextStatus !== null && updatedCount > 0,
              accounts,
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
  await expect(page.getByRole('heading', { name: '默认工作台' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: '默认工作台' })).toBeVisible();
}

export async function openEntrySidecar(page: Page): Promise<void> {
  await getEntrySidecarTrigger(page).click();
  await expect(page.getByRole('dialog', { name: '从这里开始' })).toBeVisible();
}

export function getEntrySidecarTrigger(page: Page) {
  return page.locator('button[aria-keyshortcuts="Alt+K"]');
}
